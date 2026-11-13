import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  makePicturesStudioServerPlugin,
  readStudioScenesFromDisk,
  saveStudioSceneToDisk,
} from '../../studio/src/server/index';

function sha256Trimmed(text: string): string {
  return crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

function createSampleWorkspace(studioDir: string): void {
  const rootScenes = {
    project: {
      title: 'Root Studio Demo',
      fps: 60,
      defaultResolution: { width: 1920, height: 1080 },
      uhdResolution: { width: 3840, height: 2160 },
    },
    scenes: [
      {
        id: 'intro-root',
        title: 'Intro Root',
        component: 'IntroScene',
        durationInSeconds: 5,
        durationInFrames: 300,
        speaker: 'Narrator',
        voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
        recordingFile: 'recordings/demo.mp4',
        triggerWords: { start: 'hello' },
        cues: { revealCard: 42 },
        text: 'Witamy w głównym projekcie make.pictures.',
      },
    ],
  };

  fs.writeFileSync(
    path.join(studioDir, 'scenes.json'),
    `${JSON.stringify(rootScenes, null, 2)}\n`,
    'utf8'
  );

  // Create two capsules out of alphabetical order to verify slug sorting
  for (const slug of ['zeta-film', 'alfa-kronika']) {
    const prodDir = path.join(studioDir, 'productions', slug);
    const voDir = path.join(prodDir, 'assets', 'voiceovers');
    fs.mkdirSync(voDir, { recursive: true });

    const initialText = `Tekst otwierający kapsułę ${slug}.`;
    const prodManifest = {
      id: slug,
      title: slug === 'alfa-kronika' ? 'Alfa Kronika' : 'Zeta Film',
      fps: 60,
      scenes: [
        {
          id: `${slug}-scena-1`,
          title: 'Akt I',
          component: 'ChapterOne',
          durationInSeconds: 4.5,
          durationInFrames: 270,
          speaker: 'Lektor PL',
          cues: { badgeEnter: 18, chartHighlight: 96 },
          triggerWords: { metric: 'wzrost' },
          text: initialText,
        },
      ],
      sfx: [
        {
          id: 'card-whoosh',
          prompt: 'subtle paper whoosh',
          fallbackPreset: 'whoosh',
        },
      ],
      score: {
        id: 'main-score',
        mode: 'procedural-fallback',
        moodPreset: 'warm-story',
        baseVolume: 0.22,
        duckedVolume: 0.08,
      },
    };

    fs.writeFileSync(
      path.join(prodDir, 'production.json'),
      `${JSON.stringify(prodManifest, null, 2)}\n`,
      'utf8'
    );

    if (slug === 'alfa-kronika') {
      fs.writeFileSync(path.join(voDir, 'alfa-kronika-scena-1.mp3'), 'ID3-mock', 'utf8');
      fs.writeFileSync(
        path.join(voDir, 'alfa-kronika-scena-1.json'),
        JSON.stringify(
          {
            sceneId: 'alfa-kronika-scena-1',
            text: initialText,
            textHash: sha256Trimmed(initialText),
            voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
            modelId: 'eleven_multilingual_v2',
            provider: 'elevenlabs',
            fps: 60,
            durationInSeconds: 4.5,
            audioFile: 'alfa-kronika-scena-1.mp3',
            generatedAt: '2026-11-12T12:00:00.000Z',
            words: [
              {
                word: 'Tekst',
                normalizedWord: 'tekst',
                start: 0,
                end: 0.4,
                startFrame: 0,
                endFrame: 24,
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );
    }
  }
}

test('readStudioScenesFromDisk reads root scenes.json and sorted productions/<slug>/production.json capsules with audioStatus', () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-scenes-read-'));
  try {
    createSampleWorkspace(studioDir);
    fs.writeFileSync(
      path.join(studioDir, '.env.local'),
      'ELEVENLABS_API_KEY=sk_test_valid_key_123\n',
      'utf8'
    );

    const res = readStudioScenesFromDisk(studioDir, studioDir);
    assert.equal(res.ok, true);
    assert.equal(res.hasApiKey, true);
    assert.deepEqual(
      res.groups.map((g) => ({
        id: g.id,
        origin: g.origin,
        manifestFile: g.manifestFile,
        fps: g.fps,
      })),
      [
        {
          id: 'root',
          origin: 'root',
          manifestFile: 'scenes.json',
          fps: 60,
        },
        {
          id: 'alfa-kronika',
          origin: 'production',
          manifestFile: 'productions/alfa-kronika/production.json',
          fps: 60,
        },
        {
          id: 'zeta-film',
          origin: 'production',
          manifestFile: 'productions/zeta-film/production.json',
          fps: 60,
        },
      ]
    );

    assert.equal(res.groups[0]?.title, 'Root Studio Demo');
    assert.equal(res.groups[1]?.title, 'Alfa Kronika');
    assert.equal(res.audioStatus['alfa-kronika-scena-1']?.isHashCurrent, true);
    assert.equal(res.audioStatus['alfa-kronika-scena-1']?.provider, 'elevenlabs');
    assert.equal(res.audioStatus['intro-root']?.provider, 'missing');
    assert.equal(res.audioStatus['intro-root']?.isHashCurrent, false);
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('saveStudioSceneToDisk updates allowed fields, syncs durationInFrames, and preserves cues/sfx/score/recordingFile untouched', () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-scenes-save-'));
  try {
    createSampleWorkspace(studioDir);

    const capsuleSave = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'alfa-kronika',
      sceneId: 'alfa-kronika-scena-1',
      patch: {
        text: 'Zmieniony skrypt narracji w kapsule produkcyjnej.',
        title: 'Akt I — Nowe Otwarcie',
        speaker: 'Narrator Archiwalny',
        voiceId: 'JBFqnCBsd6RMkjVDRZzb',
        durationInSeconds: 6.25,
        voiceEffect: 'radio-walkie',
        voiceSettings: {
          stability: 0.45,
          similarityBoost: 0.82,
          style: 0.25,
          speed: 1.12,
          useSpeakerBoost: true,
        },
      },
    });

    assert.equal(capsuleSave.statusCode, 200);
    assert.equal(capsuleSave.body.ok, true);
    assert.equal(capsuleSave.body.targetId, 'alfa-kronika');
    assert.equal(
      capsuleSave.body.manifestFile,
      'productions/alfa-kronika/production.json'
    );

    const rawCapsuleDisk = fs.readFileSync(
      path.join(studioDir, 'productions', 'alfa-kronika', 'production.json'),
      'utf8'
    );
    assert.ok(
      rawCapsuleDisk.endsWith('\n'),
      'Expected trailing newline on saved manifest'
    );

    const parsedCapsule = JSON.parse(rawCapsuleDisk) as Record<string, unknown>;
    assert.deepEqual(parsedCapsule.sfx, [
      {
        id: 'card-whoosh',
        prompt: 'subtle paper whoosh',
        fallbackPreset: 'whoosh',
      },
    ]);
    assert.deepEqual(parsedCapsule.score, {
      id: 'main-score',
      mode: 'procedural-fallback',
      moodPreset: 'warm-story',
      baseVolume: 0.22,
      duckedVolume: 0.08,
    });

    const savedScene = (parsedCapsule.scenes as Array<Record<string, unknown>>)[0]!;
    assert.equal(
      savedScene.text,
      'Zmieniony skrypt narracji w kapsule produkcyjnej.'
    );
    assert.equal(savedScene.title, 'Akt I — Nowe Otwarcie');
    assert.equal(savedScene.speaker, 'Narrator Archiwalny');
    assert.equal(savedScene.voiceId, 'JBFqnCBsd6RMkjVDRZzb');
    assert.equal(savedScene.durationInSeconds, 6.25);
    assert.equal(savedScene.durationInFrames, 375); // Math.round(6.25 * 60)
    assert.equal(savedScene.voiceEffect, 'radio-walkie');
    assert.deepEqual(savedScene.voiceSettings, {
      stability: 0.45,
      similarityBoost: 0.82,
      style: 0.25,
      speed: 1.12,
      useSpeakerBoost: true,
    });
    // Untouched fields on scene
    assert.equal(savedScene.component, 'ChapterOne');
    assert.deepEqual(savedScene.cues, { badgeEnter: 18, chartHighlight: 96 });
    assert.deepEqual(savedScene.triggerWords, { metric: 'wzrost' });

    // Also test clearing optional fields (empty speaker, undefined voiceEffect) on root scenes.json
    const rootSave = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: {
        speaker: '',
        durationInSeconds: 7.4,
        voiceEffect: 'telephone',
      },
    });
    assert.equal(rootSave.statusCode, 200);
    assert.equal(rootSave.body.manifestFile, 'scenes.json');

    const clearEffectSave = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: {
        voiceEffect: undefined,
      },
    });
    assert.equal(clearEffectSave.statusCode, 200);

    // Also verify empty string voiceEffect ('') deletes voiceEffect per Spec §6.1
    const setMegaphone = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: {
        voiceEffect: 'megaphone',
      },
    });
    assert.equal(setMegaphone.statusCode, 200);

    const clearEffectByEmptyString = saveStudioSceneToDisk(
      studioDir,
      studioDir,
      {
        targetId: 'root',
        sceneId: 'intro-root',
        patch: {
          voiceEffect: '',
        },
      }
    );
    assert.equal(clearEffectByEmptyString.statusCode, 200);

    const parsedRoot = JSON.parse(
      fs.readFileSync(path.join(studioDir, 'scenes.json'), 'utf8')
    ) as {
      project: Record<string, unknown>;
      scenes: Array<Record<string, unknown>>;
    };
    assert.equal(parsedRoot.project.title, 'Root Studio Demo');
    const rootScene = parsedRoot.scenes[0]!;
    assert.equal('speaker' in rootScene, false);
    assert.equal('voiceEffect' in rootScene, false);
    assert.equal(rootScene.durationInSeconds, 7.4);
    assert.equal(rootScene.durationInFrames, 444); // Math.round(7.4 * 60)
    assert.equal(rootScene.recordingFile, 'recordings/demo.mp4');
    assert.deepEqual(rootScene.cues, { revealCard: 42 });
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('saveStudioSceneToDisk rejects path traversal, unknown sceneId (404), invalid durations (400), invalid voiceEffect (400), and root collisions', () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-scenes-guard-'));
  try {
    createSampleWorkspace(studioDir);

    for (const badTarget of ['../etc', '../../scenes', 'nested/prod', 'UpperSlug', '-bad', '']) {
      const res = saveStudioSceneToDisk(studioDir, studioDir, {
        targetId: badTarget,
        sceneId: 'intro-root',
        patch: { text: 'Próba obejścia ścieżki' },
      });
      assert.equal(res.statusCode, 400, `Expected 400 for targetId="${badTarget}"`);
      assert.equal(res.body.ok, false);
    }

    const unknownCapsule = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'nieistniejaca-kapsula',
      sceneId: 'scena-1',
      patch: { text: 'Tekst' },
    });
    assert.equal(unknownCapsule.statusCode, 404);

    const unknownScene = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'alfa-kronika',
      sceneId: 'brak-takiej-sceny',
      patch: { text: 'Tekst' },
    });
    assert.equal(unknownScene.statusCode, 404);
    assert.equal(unknownScene.body.ok, false);

    for (const badDuration of [-3, 0, 0.2, 0.05, 600.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const res = saveStudioSceneToDisk(studioDir, studioDir, {
        targetId: 'root',
        sceneId: 'intro-root',
        patch: { durationInSeconds: badDuration },
      });
      assert.equal(res.statusCode, 400, `Expected 400 for duration=${String(badDuration)}`);
      assert.equal(res.body.ok, false);
    }

    const emptyText = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: { text: '   ' },
    });
    assert.equal(emptyText.statusCode, 400);

    const badEffect = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: { voiceEffect: 'underwater-flanger' },
    });
    assert.equal(badEffect.statusCode, 400);
    assert.equal(badEffect.body.ok, false);

    const badVoiceSettings = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: { voiceSettings: { stability: 1.5 } },
    });
    assert.equal(badVoiceSettings.statusCode, 400);

    const badSpeed = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: { voiceSettings: { speed: 3.0 } },
    });
    assert.equal(badSpeed.statusCode, 400);

    // Simulate a collision directory `productions/root` — `targetId: 'root'` rejects, `'__root__'` succeeds cleanly
    fs.mkdirSync(path.join(studioDir, 'productions', 'root'), { recursive: true });
    const rootCollision = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'root',
      sceneId: 'intro-root',
      patch: { text: 'Ambiguous root' },
    });
    assert.equal(rootCollision.statusCode, 400);

    const explicitRoot = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: '__root__',
      sceneId: 'intro-root',
      patch: { text: 'Explicit __root__ target works cleanly.' },
    });
    assert.equal(explicitRoot.statusCode, 200);
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('makePicturesStudioServerPlugin serves GET and POST /api/studio/scenes and flips isHashCurrent to false after text edit', async () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-scenes-http-'));
  try {
    createSampleWorkspace(studioDir);

    const plugin = makePicturesStudioServerPlugin({
      rootDir: studioDir,
      studioDir,
    });

    type MiddlewareFn = (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: unknown) => void
    ) => void;
    let middleware: MiddlewareFn | null = null;

    const fakeServer = {
      middlewares: {
        use(fn: MiddlewareFn) {
          middleware = fn;
        },
      },
    };
    const hook = plugin.configureServer;
    if (typeof hook === 'function') {
      (hook as (server: unknown) => void)(fakeServer);
    } else if (hook && typeof hook === 'object' && 'handler' in hook) {
      (hook.handler as (server: unknown) => void)(fakeServer);
    }
    assert.ok(middleware, 'Expected server middleware to be registered');

    const invokeHttp = (
      method: string,
      url: string,
      bodyObj?: Record<string, unknown>
    ): Promise<{ statusCode: number; json: Record<string, unknown> }> =>
      new Promise((resolve, reject) => {
        const reqEmitter = new EventEmitter() as IncomingMessage;
        reqEmitter.method = method;
        reqEmitter.url = url;

        let chunks = '';
        const mockRes = {
          statusCode: 200,
          writableEnded: false,
          setHeader() {},
          end(payload?: string) {
            mockRes.writableEnded = true;
            if (payload) chunks += payload;
            try {
              resolve({
                statusCode: mockRes.statusCode,
                json: JSON.parse(chunks) as Record<string, unknown>,
              });
            } catch (err) {
              reject(err);
            }
          },
        };
        const res = mockRes as unknown as ServerResponse;

        middleware!(reqEmitter, res, (err) => {
          reject(err ?? new Error('Unexpected next() call'));
        });

        if (bodyObj !== undefined) {
          reqEmitter.emit('data', Buffer.from(JSON.stringify(bodyObj), 'utf8'));
        }
        reqEmitter.emit('end');
      });

    // 1. Initial GET /api/studio/scenes — voiceover hash matches initial text
    const initialGet = await invokeHttp('GET', '/api/studio/scenes');
    assert.equal(initialGet.statusCode, 200);
    assert.equal(initialGet.json.ok, true);
    const initialAudioStatus = initialGet.json.audioStatus as Record<
      string,
      { isHashCurrent: boolean; provider: string }
    >;
    assert.equal(
      initialAudioStatus['alfa-kronika-scena-1']?.isHashCurrent,
      true
    );

    // 2. Reject invalid POST via HTTP middleware
    const badPost = await invokeHttp('POST', '/api/studio/scenes', {
      targetId: 'alfa-kronika',
      sceneId: 'alfa-kronika-scena-1',
      patch: { voiceEffect: 'bad-preset' },
    });
    assert.equal(badPost.statusCode, 400);
    assert.equal(badPost.json.ok, false);

    // 3. Edit scene text via POST /api/studio/scenes
    const okPost = await invokeHttp('POST', '/api/studio/scenes', {
      targetId: 'alfa-kronika',
      sceneId: 'alfa-kronika-scena-1',
      patch: {
        text: 'Zupełnie nowe zdanie lektora wymagające regeneracji MP3.',
        durationInSeconds: 5.5,
      },
    });
    assert.equal(okPost.statusCode, 200);
    assert.equal(okPost.json.ok, true);
    assert.equal(
      (okPost.json.scene as { durationInFrames: number }).durationInFrames,
      330
    );

    // 4. Subsequent GET /api/studio/scenes shows updated text AND isHashCurrent === false
    const afterGet = await invokeHttp('GET', '/api/studio/scenes');
    assert.equal(afterGet.statusCode, 200);
    const afterGroups = afterGet.json.groups as Array<{
      id: string;
      scenes: Array<{ id: string; text: string; durationInFrames: number }>;
    }>;
    const updatedAlfa = afterGroups.find((g) => g.id === 'alfa-kronika');
    assert.equal(
      updatedAlfa?.scenes[0]?.text,
      'Zupełnie nowe zdanie lektora wymagające regeneracji MP3.'
    );
    assert.equal(updatedAlfa?.scenes[0]?.durationInFrames, 330);

    const afterAudioStatus = afterGet.json.audioStatus as Record<
      string,
      { isHashCurrent: boolean; mp3Exists: boolean; jsonExists: boolean }
    >;
    assert.equal(afterAudioStatus['alfa-kronika-scena-1']?.mp3Exists, true);
    assert.equal(afterAudioStatus['alfa-kronika-scena-1']?.jsonExists, true);
    assert.equal(
      afterAudioStatus['alfa-kronika-scena-1']?.isHashCurrent,
      false,
      'Expected isHashCurrent to flip to false after scene text changed'
    );

    // 5. Verify existing GET /api/studio/status remains intact
    const statusRes = await invokeHttp('GET', '/api/studio/status');
    assert.equal(statusRes.statusCode, 200);
    assert.equal(
      (
        statusRes.json.scenes as Record<string, { isHashCurrent: boolean }>
      )['alfa-kronika-scena-1']?.isHashCurrent,
      false
    );
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});
