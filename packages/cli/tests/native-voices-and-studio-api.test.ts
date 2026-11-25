import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CURATED_VOICES,
  DEFAULT_ELEVENLABS_MODEL_ID,
  VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG,
  getCuratedVoices,
  getDefaultVoiceIdForArchetype,
  getDefaultVoiceIdForLang,
  getKnownEnglishVoiceName,
  isKnownEnglishPremadeVoice,
  supportsLanguageCodeParam,
} from '@make-pictures/remotion/audio/voices';
import { BUILT_IN_STYLES } from '@make-pictures/remotion/style/presets';
import {
  lintManifestVoiceovers,
  lintPolishVoiceSelection,
} from '../src/audio/phonetics-lint';
import { computeSceneCacheHash, runAudioCommand } from '../src/commands/audio';
import { buildScaffoldProductionManifest } from '../src/commands/new-production';
import { runVoicesCommand } from '../src/commands/voices';

test('voice catalog provides native PL voices for all archetypes and distinguishes languageCode model support', () => {
  const plDefault = getDefaultVoiceIdForLang('pl');
  const enDefault = getDefaultVoiceIdForLang('en');

  assert.equal(plDefault, 'C8ZVSJxcymeT86xT429O'); // Luiza (native PL)
  assert.equal(enDefault, 'TX3LPaxmHKxFdv7VOQHJ'); // Liam (native EN)
  assert.equal(isKnownEnglishPremadeVoice(plDefault), false);
  assert.equal(isKnownEnglishPremadeVoice(enDefault), true);
  assert.equal(getKnownEnglishVoiceName('TX3LPaxmHKxFdv7VOQHJ'), 'Liam');
  assert.equal(getKnownEnglishVoiceName('EXAVITQu4vr4xnSDxMaL'), 'Sarah');
  assert.equal(getKnownEnglishVoiceName('C8ZVSJxcymeT86xT429O'), null);

  for (const archetype of [
    'crisp-tech',
    'calm-editorial',
    'documentary-warm',
    'storyteller-expressive',
  ] as const) {
    const plVoice = getDefaultVoiceIdForArchetype(archetype, 'pl');
    assert.equal(
      isKnownEnglishPremadeVoice(plVoice),
      false,
      `Polish archetype ${archetype} must never map to an English premade voice (${plVoice})`
    );
    assert.equal(
      plVoice,
      VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG.pl[archetype]
    );
  }

  assert.ok(getCuratedVoices({ lang: 'pl' }).length >= 4);
  assert.ok(getCuratedVoices({ lang: 'pl', gender: 'female' }).length >= 3);
  assert.ok(getCuratedVoices({ lang: 'pl', gender: 'male' }).length >= 1);
  assert.ok(CURATED_VOICES.length >= 8);

  assert.equal(DEFAULT_ELEVENLABS_MODEL_ID, 'eleven_v4');
  assert.equal(supportsLanguageCodeParam(DEFAULT_ELEVENLABS_MODEL_ID), true);
  assert.equal(supportsLanguageCodeParam('eleven_multilingual_v2'), false);
  assert.equal(supportsLanguageCodeParam('eleven_v3'), true);
  assert.equal(supportsLanguageCodeParam('eleven_v4'), true);
  assert.equal(supportsLanguageCodeParam('eleven_turbo_v2_5'), true);
  assert.equal(supportsLanguageCodeParam('eleven_flash_v2_5'), true);
});

test('buildScaffoldProductionManifest assigns native PL voices for --lang=pl across all built-in styles', () => {
  for (const style of Object.values(BUILT_IN_STYLES)) {
    const plManifest = buildScaffoldProductionManifest(
      `pl-${style.id}`,
      'Test Polski',
      'vector-scene-2d',
      'pl',
      { style }
    );
    for (const scene of plManifest.scenes) {
      assert.equal(
        isKnownEnglishPremadeVoice(scene.voiceId),
        false,
        `PL scaffold for style ${style.id} used English premade voice ${scene.voiceId}`
      );
    }

    const enManifest = buildScaffoldProductionManifest(
      `en-${style.id}`,
      'English Test',
      'vector-scene-2d',
      'en',
      { style }
    );
    for (const scene of enManifest.scenes) {
      assert.equal(
        isKnownEnglishPremadeVoice(scene.voiceId),
        true,
        `EN scaffold for style ${style.id} expected native EN voice, got ${scene.voiceId}`
      );
    }
  }
});

test('phonetics-lint warns when a Polish production uses an English-native premade voice (Liam/Sarah) and passes native PL voices', () => {
  const liamWarnings = lintPolishVoiceSelection('s1', 'TX3LPaxmHKxFdv7VOQHJ');
  assert.equal(liamWarnings.length, 1);
  assert.match(liamWarnings[0], /Liam/);
  assert.match(liamWarnings[0], /voices --lang=pl/);

  const plWithSarah = lintManifestVoiceovers({
    lang: 'pl',
    scenes: [
      {
        id: 's1',
        durationInSeconds: 5,
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        text: 'Czterysta czterdzieści cztery tysiące pięćset pięćdziesiąt pięć.',
      },
    ],
  });
  assert.ok(
    plWithSarah.some((w) => w.includes('Sarah') && w.includes('anglojęzyczny'))
  );

  // Also catches inherited English defaultVoiceId when scene.voiceId is omitted
  const plWithInheritedLiam = lintManifestVoiceovers(
    {
      lang: 'pl',
      scenes: [
        {
          id: 's1',
          durationInSeconds: 5,
          text: 'Spokojna polska narracja bez błędów.',
        },
      ],
    },
    { defaultVoiceId: 'TX3LPaxmHKxFdv7VOQHJ' }
  );
  assert.ok(plWithInheritedLiam.some((w) => w.includes('Liam')));

  // Clean native Polish voice produces zero warnings
  const plWithLuiza = lintManifestVoiceovers({
    lang: 'pl',
    scenes: [
      {
        id: 's1',
        durationInSeconds: 5,
        voiceId: 'C8ZVSJxcymeT86xT429O',
        text: 'Spokojna polska narracja z naturalnym głosem.',
      },
    ],
  });
  assert.deepEqual(plWithLuiza, []);

  // English production with Liam produces zero warnings
  const enWithLiam = lintManifestVoiceovers({
    lang: 'en',
    scenes: [
      {
        id: 's1',
        durationInSeconds: 5,
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        text: 'Clean English narration with native voice.',
      },
    ],
  });
  assert.deepEqual(enWithLiam, []);
});

test('audio cache invalidates when scene.modelId or languageCode changes (without --force)', async () => {
  const hashNoLang = computeSceneCacheHash({
    id: 's1',
    durationInSeconds: 3,
    text: 'Test modelu.',
  });
  const hashPlLang = computeSceneCacheHash(
    {
      id: 's1',
      durationInSeconds: 3,
      text: 'Test modelu.',
    },
    { effectiveLanguageCode: 'pl' }
  );
  assert.notEqual(hashNoLang, hashPlLang);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-audio-model-cache-'));
  try {
    const prodDir = path.join(tmpDir, 'src', 'videos', 'model-check');
    fs.mkdirSync(prodDir, { recursive: true });
    const manifestPath = path.join(prodDir, 'audio.json');
    const writeManifest = (modelId: string) => {
      fs.writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            id: 'model-check',
            title: 'Model Check',
            fps: 60,
            lang: 'pl',
            modelId,
            scenes: [
              {
                id: 's1',
                durationInSeconds: 2.5,
                voiceId: 'C8ZVSJxcymeT86xT429O',
                text: 'Pierwsza scena z natywnym głosem.',
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );
    };

    writeManifest('eleven_multilingual_v2');
    await runAudioCommand({
      cwd: tmpDir,
      productionSlug: 'model-check',
      mock: true,
    });
    const voJsonPath = path.join(
      tmpDir,
      'public',
      'audio',
      'model-check',
      'voiceovers',
      's1.json'
    );
    const first = JSON.parse(fs.readFileSync(voJsonPath, 'utf8')) as {
      modelId: string;
      voiceId: string;
    };
    assert.equal(first.modelId, 'eleven_multilingual_v2');
    assert.equal(first.voiceId, 'C8ZVSJxcymeT86xT429O');

    // Switch modelId without --force -> must invalidate cache and update modelId
    writeManifest('eleven_v3');
    await runAudioCommand({
      cwd: tmpDir,
      productionSlug: 'model-check',
      mock: true,
    });
    const second = JSON.parse(fs.readFileSync(voJsonPath, 'utf8')) as {
      modelId: string;
    };
    assert.equal(second.modelId, 'eleven_v3');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('runVoicesCommand discovers curated/account/shared native voices, filters English premades for PL, and supports --audition', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-voices-cmd-'));
  try {
    // 1. Offline mode returns curated native PL voices cleanly
    const offlineLogs: string[] = [];
    const offlineRes = await runVoicesCommand({
      cwd: tmpDir,
      lang: 'pl',
      gender: 'female',
      json: true,
      deps: {
        hasApiKey: () => false,
        log: (l) => offlineLogs.push(l),
      },
    });
    assert.equal(offlineRes.configured, false);
    assert.ok(offlineRes.recommended.length >= 3);
    assert.ok(offlineRes.recommended.every((v) => v.lang === 'pl' && v.gender === 'female'));
    assert.ok(offlineRes.warning);

    // 2. Live mode filters out English premades from account voices for --lang=pl
    const liveRes = await runVoicesCommand({
      cwd: tmpDir,
      lang: 'pl',
      json: true,
      deps: {
        hasApiKey: () => true,
        fetchAccountVoices: async () => [
          {
            voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
            name: 'Liam',
            source: 'account',
            language: 'pl',
            gender: 'male',
          },
          {
            voiceId: 'CLuTGacrAhcIhaJslbXt',
            name: 'Rafał',
            source: 'account',
            language: 'pl',
            gender: 'male',
            previewUrl: 'https://example.com/rafal.mp3',
          },
        ],
        fetchSharedVoices: async () => [
          {
            voiceId: 'C8ZVSJxcymeT86xT429O',
            name: 'Luiza',
            source: 'shared',
            language: 'pl',
            gender: 'female',
            previewUrl: 'https://example.com/luiza.mp3',
            freeUsersAllowed: true,
          },
        ],
        log: () => {},
      },
    });
    assert.equal(liveRes.configured, true);
    assert.equal(liveRes.account.length, 1);
    assert.equal(liveRes.account[0].voiceId, 'CLuTGacrAhcIhaJslbXt');
    assert.equal(liveRes.shared.length, 1);
    assert.equal(liveRes.shared[0].voiceId, 'C8ZVSJxcymeT86xT429O');

    // 3. Audition mode writes sample MP3 and passes languageCode for eleven_v3
    const capturedCalls: Array<{
      voiceId: string;
      modelId: string;
      languageCode?: string;
      text: string;
    }> = [];
    const auditionRes = await runVoicesCommand({
      cwd: tmpDir,
      lang: 'pl',
      voice: 'C8ZVSJxcymeT86xT429O',
      model: 'eleven_v3',
      audition: 'Czterysta czterdzieści cztery tysiące.',
      json: true,
      deps: {
        hasApiKey: () => true,
        synthesizeAudition: async (params) => {
          capturedCalls.push(params);
          return Buffer.from('FAKE_MP3_BYTES');
        },
        log: () => {},
      },
    });
    assert.ok(auditionRes.audition);
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].voiceId, 'C8ZVSJxcymeT86xT429O');
    assert.equal(capturedCalls[0].modelId, 'eleven_v3');
    assert.equal(capturedCalls[0].languageCode, 'pl');
    assert.equal(
      fs.existsSync(path.join(tmpDir, auditionRes.audition!.outFile)),
      true
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
