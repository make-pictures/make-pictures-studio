import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { AudioSceneSpec, SceneVoiceoverData } from '@make-pictures/remotion/types';
import { lintManifestVoiceovers } from '../src/audio/phonetics-lint';
import {
  buildSyntheticDialogueTimestamps,
  computeSceneCacheHash,
  extractWordsFromAlignment,
  isDialogueScene,
  resolveEffectiveDialogueModelId,
  runAudioCommand,
  synthesizeSceneDialogueViaSdk,
  type TextToDialogueClientLike,
} from '../src/commands/audio';

test('computeSceneCacheHash includes dialogueInputs and invalidates on turn text, voiceId, or speaker changes', () => {
  const baseScene: AudioSceneSpec = {
    id: 's4-pl',
    durationInSeconds: 6.4,
    text: 'Luiza + Rafał',
    modelId: 'eleven_v3',
    languageCode: 'pl',
    voiceSettings: { stability: 0.5 },
    dialogueInputs: [
      {
        text: '[playful] Chcesz pogadać z widzem?',
        voiceId: 'C8ZVSJxcymeT86xT429O',
        speaker: 'Luiza',
      },
      {
        text: '[warmly] Światło, uśmiech i dobra zabawa!',
        voiceId: 'CLuTGacrAhcIhaJslbXt',
        speaker: 'Rafał',
      },
    ],
  };

  assert.equal(isDialogueScene(baseScene), true);
  assert.equal(
    isDialogueScene({ id: 'single', durationInSeconds: 4, text: 'Hello' }),
    false
  );

  const hashBase = computeSceneCacheHash(baseScene, {
    effectiveLanguageCode: 'pl',
  });
  const hashChangedText = computeSceneCacheHash(
    {
      ...baseScene,
      dialogueInputs: [
        baseScene.dialogueInputs![0]!,
        {
          ...baseScene.dialogueInputs![1]!,
          text: '[warmly] Światło i radość!',
        },
      ],
    },
    { effectiveLanguageCode: 'pl' }
  );
  const hashChangedVoice = computeSceneCacheHash(
    {
      ...baseScene,
      dialogueInputs: [
        baseScene.dialogueInputs![0]!,
        {
          ...baseScene.dialogueInputs![1]!,
          voiceId: 'Bz1e1clEKwgN71Vx7cxj',
        },
      ],
    },
    { effectiveLanguageCode: 'pl' }
  );
  const hashChangedSpeaker = computeSceneCacheHash(
    {
      ...baseScene,
      dialogueInputs: [
        baseScene.dialogueInputs![0]!,
        {
          ...baseScene.dialogueInputs![1]!,
          speaker: 'HostB',
        },
      ],
    },
    { effectiveLanguageCode: 'pl' }
  );

  assert.notEqual(hashBase, hashChangedText);
  assert.notEqual(hashBase, hashChangedVoice);
  assert.notEqual(hashBase, hashChangedSpeaker);
});

test('resolveEffectiveDialogueModelId defaults legacy v2 fallback to eleven_v4 while honoring explicit modelId', () => {
  assert.equal(
    resolveEffectiveDialogueModelId(undefined, 'eleven_multilingual_v2'),
    'eleven_v4'
  );
  assert.equal(
    resolveEffectiveDialogueModelId(undefined, 'eleven_v3'),
    'eleven_v3'
  );
  assert.equal(
    resolveEffectiveDialogueModelId(undefined, 'eleven_v4'),
    'eleven_v4'
  );
  assert.equal(
    resolveEffectiveDialogueModelId('eleven_v3_custom', 'eleven_multilingual_v2'),
    'eleven_v3_custom'
  );
});

test('buildSyntheticDialogueTimestamps builds proportional monotonic voiceSegments and strips eleven_v3 tags', () => {
  const result = buildSyntheticDialogueTimestamps(
    [
      {
        text: '[playful] Chcesz pogadać z widzem? Wskakujemy prosto do ciepłego studia trzy de!',
        voiceId: 'C8ZVSJxcymeT86xT429O',
        speaker: 'Luiza',
      },
      {
        text: '[warmly] Światło, uśmiech i dobra zabawa w jednym miejscu.',
        voiceId: 'CLuTGacrAhcIhaJslbXt',
        speaker: 'Rafał',
      },
    ],
    6.4,
    60
  );

  assert.equal(result.voiceSegments.length, 2);
  const [seg0, seg1] = result.voiceSegments;
  assert.equal(seg0!.voiceId, 'C8ZVSJxcymeT86xT429O');
  assert.equal(seg0!.speaker, 'Luiza');
  assert.equal(seg0!.dialogueInputIndex, 0);
  assert.equal(seg1!.voiceId, 'CLuTGacrAhcIhaJslbXt');
  assert.equal(seg1!.speaker, 'Rafał');
  assert.equal(seg1!.dialogueInputIndex, 1);

  // First turn has more characters/words, so it gets proportionally more time
  const dur0 = seg0!.endTimeSeconds - seg0!.startTimeSeconds;
  const dur1 = seg1!.endTimeSeconds - seg1!.startTimeSeconds;
  assert.ok(dur0 > dur1, `Expected turn 0 (${dur0}s) > turn 1 (${dur1}s)`);
  assert.ok(seg0!.startTimeSeconds >= 0);
  assert.ok(seg0!.endTimeSeconds < seg1!.startTimeSeconds);
  assert.ok(seg1!.endTimeSeconds < 6.4);

  // Tags must be stripped from words and character alignment
  assert.ok(!result.words.some((w) => w.word.includes('[')));
  const alignedText = result.alignment.characters.join('');
  assert.doesNotMatch(alignedText, /\[|\]/);
  assert.ok(alignedText.startsWith('Chcesz pogadać'));
  assert.ok(alignedText.endsWith('miejscu.'));

  // Character indices slice exact turn text
  const turn0Slice = result.alignment.characters
    .slice(seg0!.characterStartIndex, seg0!.characterEndIndex)
    .join('');
  const turn1Slice = result.alignment.characters
    .slice(seg1!.characterStartIndex, seg1!.characterEndIndex)
    .join('');
  assert.equal(
    turn0Slice,
    'Chcesz pogadać z widzem? Wskakujemy prosto do ciepłego studia trzy de!'
  );
  assert.equal(
    turn1Slice,
    'Światło, uśmiech i dobra zabawa w jednym miejscu.'
  );
});

test('extractWordsFromAlignment splits adjacent turns cleanly at voiceSegments character boundaries', () => {
  const text = 'Hello!Great.';
  const chars = Array.from(text);
  const words = extractWordsFromAlignment(
    {
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.1),
    },
    60,
    [0, 6]
  );

  assert.deepEqual(
    words.map((w) => w.word),
    ['Hello!', 'Great.']
  );
});

test('synthesizeSceneDialogueViaSdk sends snapped stability, inputs, languageCode, outputFormat and maps voiceSegments', async () => {
  const capturedRequests: unknown[] = [];

  const mockClient: TextToDialogueClientLike = {
    textToDialogue: {
      convertWithTimestamps: ((request: unknown) => {
        capturedRequests.push(request);
        return Promise.resolve({
          audioBase64: Buffer.from('mock-mp3-bytes').toString('base64'),
          alignment: {
            characters: Array.from('Hi there!'),
            characterStartTimesSeconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
            characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
          },
          voiceSegments: [
            {
              voiceId: 'EXAVITQu4vr4xnSDxMaL',
              startTimeSeconds: 0.05,
              endTimeSeconds: 0.25,
              characterStartIndex: 0,
              characterEndIndex: 2,
              dialogueInputIndex: 0,
            },
            {
              voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
              startTimeSeconds: 0.35,
              endTimeSeconds: 0.9,
              characterStartIndex: 3,
              characterEndIndex: 9,
              dialogueInputIndex: 1,
            },
          ],
        });
      }) as unknown as TextToDialogueClientLike['textToDialogue']['convertWithTimestamps'],
    },
  };

  const result = await synthesizeSceneDialogueViaSdk({
    dialogueInputs: [
      {
        text: '[playful] Hi',
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        speaker: 'Sarah',
      },
      {
        text: '[warmly] there!',
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        speaker: 'Liam',
      },
    ],
    modelId: 'eleven_v3',
    languageCode: 'EN',
    voiceSettings: { stability: 0.38 },
    client: mockClient,
  });

  assert.equal(capturedRequests.length, 1);
  assert.deepEqual(capturedRequests[0], {
    inputs: [
      { text: '[playful] Hi', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
      { text: '[warmly] there!', voiceId: 'TX3LPaxmHKxFdv7VOQHJ' },
    ],
    modelId: 'eleven_v3',
    languageCode: 'en',
    settings: { stability: 0.5 },
    outputFormat: 'mp3_44100_128',
  });

  assert.equal(result.voiceSegments.length, 2);
  assert.equal(result.voiceSegments[0]!.speaker, 'Sarah');
  assert.equal(result.voiceSegments[0]!.dialogueInputIndex, 0);
  assert.equal(result.voiceSegments[1]!.speaker, 'Liam');
  assert.equal(result.voiceSegments[1]!.dialogueInputIndex, 1);
  assert.equal(result.alignment?.characters.join(''), 'Hi there!');
});

test('runAudioCommand (--mock) persists voiceSegments in cache JSON + audio-manifest.ts and caches cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-dialogue-mock-'));
  try {
    const prodDir = path.join(tmpDir, 'src', 'videos', 'dialogue-demo');
    fs.mkdirSync(prodDir, { recursive: true });
    const manifestPath = path.join(prodDir, 'audio.json');
    const manifest = {
      id: 'dialogue-demo',
      title: 'Dialogue Demo',
      fps: 60,
      modelId: 'eleven_v3',
      scenes: [
        {
          id: 's4-pl',
          durationInSeconds: 6.4,
          modelId: 'eleven_v3',
          languageCode: 'pl',
          voiceSettings: { stability: 0.5, speed: 0.99 },
          text: '[playful] Chcesz pogadać z widzem? [warmly] Światło i uśmiech!',
          dialogueInputs: [
            {
              text: '[playful] Chcesz pogadać z widzem?',
              voiceId: 'C8ZVSJxcymeT86xT429O',
              speaker: 'Luiza',
            },
            {
              text: '[warmly] Światło i uśmiech!',
              voiceId: 'CLuTGacrAhcIhaJslbXt',
              speaker: 'Rafał',
            },
          ],
        },
      ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    await runAudioCommand({
      cwd: tmpDir,
      productionSlug: 'dialogue-demo',
      mock: true,
    });

    const jsonPath = path.join(
      tmpDir,
      'public',
      'audio',
      'dialogue-demo',
      'voiceovers',
      's4-pl.json'
    );
    const mp3Path = path.join(
      tmpDir,
      'public',
      'audio',
      'dialogue-demo',
      'voiceovers',
      's4-pl.mp3'
    );
    const generatedManifestPath = path.join(
      prodDir,
      'generated',
      'audio-manifest.ts'
    );

    assert.equal(fs.existsSync(mp3Path), true);
    assert.equal(fs.existsSync(jsonPath), true);
    assert.equal(fs.existsSync(generatedManifestPath), true);

    const firstData = JSON.parse(
      fs.readFileSync(jsonPath, 'utf8')
    ) as SceneVoiceoverData;
    assert.equal(firstData.modelId, 'eleven_v3');
    assert.equal(firstData.voiceSegments?.length, 2);
    assert.equal(firstData.voiceSegments?.[0]?.speaker, 'Luiza');
    assert.equal(firstData.voiceSegments?.[1]?.speaker, 'Rafał');
    assert.ok(firstData.words.length >= 7);

    const generatedTs = fs.readFileSync(generatedManifestPath, 'utf8');
    assert.ok(generatedTs.includes('"voiceSegments"'));
    assert.ok(generatedTs.includes('"dialogueInputIndex": 1'));

    // Second run with identical dialogueInputs hits cache (generatedAt unchanged)
    await runAudioCommand({
      cwd: tmpDir,
      productionSlug: 'dialogue-demo',
      mock: true,
    });
    const cachedData = JSON.parse(
      fs.readFileSync(jsonPath, 'utf8')
    ) as SceneVoiceoverData;
    assert.equal(cachedData.generatedAt, firstData.generatedAt);

    // Mutating a turn invalidates cache
    manifest.scenes[0]!.dialogueInputs[1]!.text =
      '[warmly] Światło, uśmiech i energia!';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    await runAudioCommand({
      cwd: tmpDir,
      productionSlug: 'dialogue-demo',
      mock: true,
    });
    const regeneratedData = JSON.parse(
      fs.readFileSync(jsonPath, 'utf8')
    ) as SceneVoiceoverData;
    assert.notEqual(regeneratedData.textHash, firstData.textHash);
    assert.equal(regeneratedData.voiceSegments?.length, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('lintManifestVoiceovers lints every dialogueInputs turn and respects per-scene languageCode in bilingual manifests', () => {
  // 1. Clean bilingual manifest with PL & EN Text-to-Dialogue scenes -> 0 warnings
  const cleanBilingual = lintManifestVoiceovers({
    modelId: 'eleven_v3',
    scenes: [
      {
        id: 's4-pl',
        durationInSeconds: 6.4,
        languageCode: 'pl',
        voiceSettings: { stability: 0.5, speed: 0.99 },
        text: 'Luiza + Rafał',
        dialogueInputs: [
          {
            text: '[playful] Chcesz pogadać z widzem? Wskakujemy do studia trzy de!',
            voiceId: 'C8ZVSJxcymeT86xT429O',
            speaker: 'Luiza',
          },
          {
            text: '[warmly] Światło, uśmiech i dobre api w jednym miejscu.',
            voiceId: 'CLuTGacrAhcIhaJslbXt',
            speaker: 'Rafał',
          },
        ],
      },
      {
        id: 's4-en',
        durationInSeconds: 6.4,
        languageCode: 'en',
        voiceSettings: { stability: 0.5, speed: 0.99 },
        text: 'Sarah + Liam',
        dialogueInputs: [
          {
            text: '[playful] Ready to talk to your audience?',
            voiceId: 'EXAVITQu4vr4xnSDxMaL',
            speaker: 'Sarah',
          },
          {
            text: '[warmly] Light, charm, and API magic in one place.',
            voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
            speaker: 'Liam',
          },
        ],
      },
    ],
  });
  assert.deepEqual(cleanBilingual, []);

  // 2. Polish dialogue scene with English voice, non-discrete stability, raw API & USB acronyms
  const plIssues = lintManifestVoiceovers({
    lang: 'pl',
    modelId: 'eleven_v3',
    scenes: [
      {
        id: 's4-bad',
        durationInSeconds: 6.0,
        voiceSettings: { stability: 0.35, speed: 0.99 },
        text: 'Dialogue',
        dialogueInputs: [
          {
            text: '[playful] Łączymy nasze API bezpiecznie.',
            voiceId: 'C8ZVSJxcymeT86xT429O',
            speaker: 'Luiza',
          },
          {
            text: '[warmly] I przesyłamy obraz przez port USB.',
            voiceId: 'TX3LPaxmHKxFdv7VOQHJ', // Liam (English premade!)
            speaker: 'Liam',
          },
        ],
      },
    ],
  });

  assert.equal(
    plIssues.filter((w) => w.includes('[v3-stability]')).length,
    1,
    'Should emit [v3-stability] once for scene voiceSettings'
  );
  assert.ok(
    plIssues.some((w) => w.includes('s4-bad[turn:0:Luiza]') && w.includes('"API"'))
  );
  assert.ok(
    plIssues.some((w) => w.includes('s4-bad[turn:1:Liam]') && w.includes('"USB"'))
  );
  assert.ok(
    plIssues.some(
      (w) =>
        w.includes('s4-bad[turn:1:Liam]') &&
        w.includes('Liam') &&
        w.includes('anglojęzyczny')
    )
  );

  // 3. v3 audio tags on non-v3 model caught across dialogue turns
  const v2Tags = lintManifestVoiceovers({
    lang: 'en',
    modelId: 'eleven_multilingual_v2',
    scenes: [
      {
        id: 's4-v2',
        durationInSeconds: 5.0,
        text: 'Dialogue',
        dialogueInputs: [
          {
            text: '[playful] First turn.',
            voiceId: 'EXAVITQu4vr4xnSDxMaL',
            speaker: 'Sarah',
          },
          {
            text: '[warmly] Second turn.',
            voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
            speaker: 'Liam',
          },
        ],
      },
    ],
  });
  assert.equal(v2Tags.filter((w) => w.includes('[v3-audio-tags]')).length, 2);
});
