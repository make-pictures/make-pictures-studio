import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CURATED_VOICES,
  getRecommendedVoiceSettings,
  snapStabilityForElevenLabsModel,
} from '../../core/src/index';
import {
  extractElevenLabsV3Tags,
  lintElevenLabsV3Usage,
  lintManifestVoiceovers,
  lintPolishVoiceoverText,
  shouldRunPolishPhoneticsLint,
  stripElevenLabsV3Tags,
} from '../src/audio/phonetics-lint';
import {
  buildSyntheticWordTimestamps,
  runAudioCommand,
} from '../src/commands/audio';

test('extractElevenLabsV3Tags extracts bracketed expression tags and ignores non-tag brackets', () => {
  assert.deepEqual(
    extractElevenLabsV3Tags('[thoughtful] Ten kawałek… [warmly] naprawdę działa.'),
    ['[thoughtful]', '[warmly]']
  );

  assert.deepEqual(
    extractElevenLabsV3Tags('[WARMLY] [very softly] [deep-breath] [API] Tekst.'),
    ['[WARMLY]', '[very softly]', '[deep-breath]', '[API]']
  );

  assert.deepEqual(
    extractElevenLabsV3Tags('Zwykły tekst z przypisem [1] oraz [123] i [a].'),
    []
  );

  // Numeric pause/timing tags and longer descriptive tags (up to ~48 chars)
  assert.deepEqual(
    extractElevenLabsV3Tags(
      '[0.5s] Pierwsza pauza [pauses 1.5s] i kolejna [1.5s pause] oraz [500ms] [speaks warmly with a quiet nostalgic smile].'
    ),
    [
      '[0.5s]',
      '[pauses 1.5s]',
      '[1.5s pause]',
      '[500ms]',
      '[speaks warmly with a quiet nostalgic smile]',
    ]
  );

  // Pure numbers, decimal numbers without units, and overly long editorial notes are ignored
  assert.deepEqual(
    extractElevenLabsV3Tags(
      'Przypisy [1] [123] [1.5] [1a] oraz [this bracketed editorial comment is far too long to be a real audio tag].'
    ),
    []
  );
});

test('stripElevenLabsV3Tags removes tags cleanly and prevents false Polish phonetic/language warnings', () => {
  assert.equal(
    stripElevenLabsV3Tags('[WARMLY] Sprawdzamy [API] i tekst.'),
    'Sprawdzamy i tekst.'
  );

  // Tags like [thoughtful], [WARMLY], [API], [USB] must NOT trigger Polish acronym warnings
  const cleanTaggedPl = lintPolishVoiceoverText(
    's01',
    '[thoughtful] [WARMLY] [API] [USB] Nasz eksporter api zapisuje dane bezpiecznie.',
    { speed: 0.99 }
  );
  assert.deepEqual(cleanTaggedPl, []);

  // Real raw acronyms outside tags are still caught while tags are ignored
  const realAcronymWithTags = lintPolishVoiceoverText(
    's02',
    '[WARMLY] Klucz API przesyła dane przez port USB.'
  );
  assert.equal(realAcronymWithTags.length, 2);
  assert.ok(realAcronymWithTags.some((w) => w.includes('"API"') && w.includes('"api"')));
  assert.ok(realAcronymWithTags.some((w) => w.includes('"USB"') && w.includes('"u-es-be"')));
  assert.ok(!realAcronymWithTags.some((w) => w.includes('WARMLY')));

  // Bracketed tags must not falsely trigger Polish language detection on English scripts
  assert.equal(
    shouldRunPolishPhoneticsLint({
      scenes: [{ text: '[jako] [oraz] Run Jest unit tests for your API and SQL layer.' }],
    }),
    false
  );
});

test('lintElevenLabsV3Usage flags bracketed tags on non-v3/v4 models and non-discrete stability on eleven_v3', () => {
  // 1. Tag on eleven_multilingual_v2 (EN) -> [v3-audio-tags]
  const v2TagWarnings = lintElevenLabsV3Usage(
    's01',
    '[thoughtful] Hello world',
    'eleven_multilingual_v2'
  );
  assert.equal(v2TagWarnings.length, 1);
  assert.match(v2TagWarnings[0]!, /\[v3-audio-tags\]/);
  assert.match(v2TagWarnings[0]!, /s01/);
  assert.match(v2TagWarnings[0]!, /\[thoughtful\]/);

  // Default omitted modelId falls back to eleven_multilingual_v2 -> [v3-audio-tags]
  const defaultModelTagWarnings = lintElevenLabsV3Usage(
    's01b',
    '[warmly] Dzień dobry.'
  );
  assert.equal(defaultModelTagWarnings.length, 1);
  assert.match(defaultModelTagWarnings[0]!, /\[v3-audio-tags\]/);

  // 2. Tag on eleven_v3 with discrete stability -> clean
  assert.deepEqual(
    lintElevenLabsV3Usage('s01', '[thoughtful] Hello world', 'eleven_v3', {
      stability: 0.5,
    }),
    []
  );

  // Tag on eleven_v4 -> clean
  assert.deepEqual(
    lintElevenLabsV3Usage('s01', '[thoughtful] Hello world', 'eleven_v4'),
    []
  );

  // 3. Discrete stability values {0, 0.5, 1} (within 1e-6) pass on eleven_v3
  for (const validStability of [0, 0.5, 1, 0.5 + 5e-7]) {
    assert.deepEqual(
      lintElevenLabsV3Usage('s02', '[playful] Ready!', 'eleven_v3', {
        stability: validStability,
      }),
      [],
      `Expected stability=${validStability} to pass on eleven_v3`
    );
  }

  // Omitted stability on eleven_v3 passes
  assert.deepEqual(
    lintElevenLabsV3Usage('s02b', '[playful] Ready!', 'eleven_v3', {
      speed: 0.99,
    }),
    []
  );

  // 4. Non-discrete stability on eleven_v3 -> [v3-stability]
  for (const badStability of [0.35, 0.75, 0.5001, -0.1, 1.2]) {
    const stabilityWarnings = lintElevenLabsV3Usage(
      's03',
      '[thoughtful] Hello world',
      'eleven_v3',
      { stability: badStability }
    );
    assert.equal(
      stabilityWarnings.length,
      1,
      `Expected [v3-stability] warning for stability=${badStability}`
    );
    assert.match(stabilityWarnings[0]!, /\[v3-stability\]/);
    assert.match(stabilityWarnings[0]!, /s03/);
  }

  // 5. Continuous stability on eleven_multilingual_v2 without tags -> clean
  assert.deepEqual(
    lintElevenLabsV3Usage(
      's04',
      'Plain narration without tags.',
      'eleven_multilingual_v2',
      { stability: 0.42 }
    ),
    []
  );
});

test('lintManifestVoiceovers validates eleven_v3 across EN and PL manifests with modelId precedence and preserves Polish phonetics checks', () => {
  // 1. English manifest with v3 tags on v2 model -> [v3-audio-tags]
  const enV2Tags = lintManifestVoiceovers({
    lang: 'en',
    modelId: 'eleven_multilingual_v2',
    scenes: [
      {
        id: 'en-1',
        durationInSeconds: 4,
        text: '[thoughtful] Connect your API to SQL over LAN.',
      },
    ],
  });
  assert.equal(enV2Tags.length, 1);
  assert.match(enV2Tags[0]!, /\[v3-audio-tags\]/);

  // 2. English manifest with options.defaultModelId='eleven_v3' and invalid stability -> [v3-stability]
  const enDefaultV3BadStability = lintManifestVoiceovers(
    {
      lang: 'en',
      scenes: [
        {
          id: 'en-2',
          durationInSeconds: 4,
          text: '[warmly] Smooth narration for API.',
          voiceSettings: { stability: 0.35 },
        },
      ],
    },
    { defaultModelId: 'eleven_v3' }
  );
  assert.equal(enDefaultV3BadStability.length, 1);
  assert.match(enDefaultV3BadStability[0]!, /\[v3-stability\]/);

  // 3. Per-scene modelId overrides manifest.modelId and options.defaultModelId
  const perSceneOverride = lintManifestVoiceovers(
    {
      lang: 'pl',
      voiceId: 'C8ZVSJxcymeT86xT429O',
      modelId: 'eleven_v3',
      scenes: [
        {
          id: 'pl-ok',
          durationInSeconds: 4,
          text: '[thoughtful] Spokojna polska narracja bez błędów.',
          voiceSettings: { stability: 0.5 },
        },
        {
          id: 'pl-downgraded',
          durationInSeconds: 4,
          modelId: 'eleven_multilingual_v2',
          text: '[warmly] Ten tag zostanie przeczytany na głos.',
        },
      ],
    },
    { defaultModelId: 'eleven_v3' }
  );
  assert.equal(perSceneOverride.length, 1);
  assert.match(perSceneOverride[0]!, /\[v3-audio-tags\]/);
  assert.match(perSceneOverride[0]!, /pl-downgraded/);

  // 4. Polish manifest combines v3 stability, native-voice check, and Polish phonetics without false tag alarms
  const plCombined = lintManifestVoiceovers(
    {
      lang: 'pl',
      scenes: [
        {
          id: 'pl-all',
          durationInSeconds: 5,
          voiceId: 'TX3LPaxmHKxFdv7VOQHJ', // Liam (English premade)
          text: '[WARMLY] [API] Klucz API działa z portem USB.',
          voiceSettings: { stability: 0.35 },
        },
      ],
    },
    { defaultModelId: 'eleven_v3' }
  );
  assert.ok(plCombined.some((w) => w.includes('[v3-stability]')));
  assert.ok(plCombined.some((w) => w.includes('Liam') && w.includes('anglojęzyczny')));
  assert.ok(plCombined.some((w) => w.includes('"API"') && w.includes('"api"')));
  assert.ok(plCombined.some((w) => w.includes('"USB"') && w.includes('"u-es-be"')));
  assert.ok(!plCombined.some((w) => w.includes('[v3-audio-tags]')));
  assert.ok(!plCombined.some((w) => w.includes('WARMLY')));
});

test('runAudioCommand passes capsuleModelId as defaultModelId into lintManifestVoiceovers', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-v3-audio-lint-'));
  const prevModelId = process.env.ELEVENLABS_MODEL_ID;
  const origWarn = console.warn;
  const warnings: string[] = [];

  try {
    const prodDir = path.join(tmpDir, 'productions', 'v3-lint-check');
    fs.mkdirSync(prodDir, { recursive: true });
    fs.writeFileSync(
      path.join(prodDir, 'production.json'),
      JSON.stringify(
        {
          id: 'v3-lint-check',
          title: 'V3 Lint Check',
          fps: 60,
          lang: 'en',
          scenes: [
            {
              id: 's1',
              durationInSeconds: 2.5,
              text: '[thoughtful] Testing default model propagation.',
              voiceSettings: { stability: 0.35 },
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    process.env.ELEVENLABS_MODEL_ID = 'eleven_v3';
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    await runAudioCommand({
      cwd: tmpDir,
      productionSlug: 'v3-lint-check',
      mock: true,
    });

    assert.ok(
      warnings.some((w) => w.includes('[v3-stability]')),
      `Expected [v3-stability] warning when ELEVENLABS_MODEL_ID=eleven_v3, got ${JSON.stringify(warnings)}`
    );
    assert.ok(
      !warnings.some((w) => w.includes('[v3-audio-tags]')),
      `Expected no [v3-audio-tags] warning when ELEVENLABS_MODEL_ID=eleven_v3, got ${JSON.stringify(warnings)}`
    );

    // Mock word timestamps must strip eleven_v3 audio tags so words[] never contain [thoughtful]
    const voJson = JSON.parse(
      fs.readFileSync(
        path.join(prodDir, 'assets', 'voiceovers', 's1.json'),
        'utf8'
      )
    ) as { words: Array<{ word: string }> };
    assert.deepEqual(
      voJson.words.map((w) => w.word),
      ['Testing', 'default', 'model', 'propagation.']
    );
  } finally {
    console.warn = origWarn;
    if (prevModelId === undefined) {
      delete process.env.ELEVENLABS_MODEL_ID;
    } else {
      process.env.ELEVENLABS_MODEL_ID = prevModelId;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('snapStabilityForElevenLabsModel and getRecommendedVoiceSettings enforce discrete {0, 0.5, 1} stability for eleven_v3', () => {
  // Non-v3 models preserve continuous stability untouched
  assert.equal(snapStabilityForElevenLabsModel(0.48), 0.48);
  assert.equal(snapStabilityForElevenLabsModel(0.48, 'eleven_multilingual_v2'), 0.48);
  assert.equal(snapStabilityForElevenLabsModel(0.35, 'eleven_turbo_v2_5'), 0.35);
  assert.equal(snapStabilityForElevenLabsModel(0.56, 'eleven_v4'), 0.56);

  // eleven_v3 (case-insensitive prefix) snaps to nearest {0, 0.5, 1}
  assert.equal(snapStabilityForElevenLabsModel(-0.2, 'eleven_v3'), 0);
  assert.equal(snapStabilityForElevenLabsModel(0, 'eleven_v3'), 0);
  assert.equal(snapStabilityForElevenLabsModel(0.24, 'eleven_v3'), 0);
  assert.equal(snapStabilityForElevenLabsModel(0.25, 'eleven_v3'), 0.5);
  assert.equal(snapStabilityForElevenLabsModel(0.35, 'eleven_v3'), 0.5);
  assert.equal(snapStabilityForElevenLabsModel(0.48, 'eleven_v3'), 0.5);
  assert.equal(snapStabilityForElevenLabsModel(0.58, 'eleven_v3'), 0.5);
  assert.equal(snapStabilityForElevenLabsModel(0.74, 'ELEVEN_V3_alpha'), 0.5);
  assert.equal(snapStabilityForElevenLabsModel(0.75, 'eleven_v3'), 1);
  assert.equal(snapStabilityForElevenLabsModel(0.92, 'eleven_v3'), 1);
  assert.equal(snapStabilityForElevenLabsModel(1.5, 'eleven_v3'), 1);
  assert.equal(snapStabilityForElevenLabsModel(Number.NaN, 'eleven_v3'), 0.5);

  // Curated & unknown voices keep continuous defaults on v2, snap to {0, 0.5, 1} on eleven_v3
  assert.equal(getRecommendedVoiceSettings('C8ZVSJxcymeT86xT429O').stability, 0.48);
  assert.equal(
    getRecommendedVoiceSettings('C8ZVSJxcymeT86xT429O', 'eleven_multilingual_v2').stability,
    0.48
  );
  assert.equal(
    getRecommendedVoiceSettings('C8ZVSJxcymeT86xT429O', 'eleven_v3').stability,
    0.5
  );
  assert.equal(
    getRecommendedVoiceSettings('unknown-voice-id', 'eleven_v3').stability,
    0.5
  );

  for (const voice of CURATED_VOICES) {
    const v3Settings = getRecommendedVoiceSettings(voice.voiceId, 'eleven_v3');
    assert.ok(
      v3Settings.stability === 0 ||
        v3Settings.stability === 0.5 ||
        v3Settings.stability === 1,
      `Expected discrete stability for ${voice.name} on eleven_v3, got ${v3Settings.stability}`
    );
  }
});

test('buildSyntheticWordTimestamps strips eleven_v3 audio and pause tags from words[] and alignment', () => {
  const res = buildSyntheticWordTimestamps(
    '[thoughtful] Hello [0.5s] world [1.5s pause] today.',
    4,
    60
  );
  assert.deepEqual(
    res.words.map((w) => w.word),
    ['Hello', 'world', 'today.']
  );
  const alignedText = res.alignment.characters.join('');
  assert.equal(alignedText, 'Hello world today.');
  assert.doesNotMatch(alignedText, /\[|\]/);
});
