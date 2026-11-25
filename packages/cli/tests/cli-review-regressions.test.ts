import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  computeSceneCacheHash,
  runAudioCommand,
  runMusicShortcutCommand,
  runSfxShortcutCommand,
} from '../src/commands/audio';
import { runDoctorCommand } from '../src/commands/doctor';
import { REQUIRED_RUNTIME_PACKAGES } from '../src/commands/init';
import {
  registerCompositionInRootTsx,
  runNewProductionCommand,
} from '../src/commands/new-production';
import { runOnboardCommand } from '../src/commands/onboard';
import {
  readVoiceoverManifestLiteral,
  resolveCompositionSourceFromRoot,
} from '../src/commands/qa-contact-sheet';
import { detectCompositionUsesThree } from '../src/commands/render';
import { runStudioCommand } from '../src/commands/studio';
import { runStyleNewCommand } from '../src/commands/styles';
import { loadMakePicturesConfig } from '../src/commands/workspace-paths';
import { runCli } from '../src/index';
import {
  createMakePicturesApp,
  parseArgs,
  runCreateCli,
} from '../../create-make-pictures/src/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

test('[P0 #4] onboard never deletes user .env.local secrets and enforces 0o600 on template copy', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-env-preserve-'));
  try {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'existing-secrets-app',
        private: true,
        dependencies: { '@make-pictures/remotion': '^3.0.0', remotion: '^4.0.545' },
        scripts: { onboard: 'make-pictures onboard' },
      })
    );
    for (const pkg of [['remotion'], ['@make-pictures', 'remotion']]) {
      const p = path.join(tmpDir, 'node_modules', ...pkg);
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, 'package.json'), '{"version":"1.0.0"}');
    }

    const envLocalPath = path.join(tmpDir, '.env.local');
    fs.writeFileSync(
      envLocalPath,
      'DATABASE_URL=postgres://user:pass@localhost/db\nGEMINI_API_KEY=gm_secret_123\nELEVENLABS_API_KEY=your_elevenlabs_api_key_here\n',
      'utf8'
    );

    let outBuf = '';
    await runOnboardCommand({
      cwd: tmpDir,
      json: true,
      deps: {
        stdout: { isTTY: false, write: (c) => ((outBuf += String(c)), true) },
        env: {},
        checkFfmpeg: () => true,
      },
    });
    assert.match(outBuf, /onboard -- connect/);
    assert.equal(fs.existsSync(envLocalPath), true, '.env.local must NEVER be deleted');
    const afterOnboard = fs.readFileSync(envLocalPath, 'utf8');
    assert.match(afterOnboard, /DATABASE_URL=postgres:\/\/user:pass@localhost\/db/);
    assert.match(afterOnboard, /GEMINI_API_KEY=gm_secret_123/);
    assert.doesNotMatch(afterOnboard, /your_elevenlabs_api_key_here/);

    // Doctor --setup copies .env.example with 0o600 mode on POSIX
    const docDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-doctor-chmod-'));
    try {
      fs.writeFileSync(
        path.join(docDir, '.env.example'),
        'ELEVENLABS_API_KEY=your_elevenlabs_api_key_here\n',
        { mode: 0o644 }
      );
      await assert.rejects(() => runDoctorCommand({ cwd: docDir, setup: true }));
      const copiedEnv = path.join(docDir, '.env.local');
      assert.equal(fs.existsSync(copiedEnv), true);
      if (process.platform !== 'win32') {
        const mode = fs.statSync(copiedEnv).mode & 0o777;
        assert.equal(mode, 0o600);
      }
    } finally {
      fs.rmSync(docDir, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('[P0 #5 + P1 #4] detectCompositionUsesThree and resolveCompositionSourceFromRoot handle barrels, 3D/2D demos, calculateMetadata >, id={...}, and ns.Foo', () => {
  const entryPoint = path.join(MONOREPO_ROOT, 'src', 'index.ts');
  const rootFile = path.join(MONOREPO_ROOT, 'src', 'Root.tsx');

  // All 3 flagship 3D demos MUST detect Three.js === true
  for (const id3d of [
    'PaperDioramaDemo',
    'IsometricDialogueDemo',
    'Tactile3DShowcase',
  ]) {
    assert.equal(
      detectCompositionUsesThree(MONOREPO_ROOT, entryPoint, id3d),
      true,
      `Expected detectCompositionUsesThree(${id3d}) === true`
    );
    const resolved = resolveCompositionSourceFromRoot(rootFile, id3d);
    assert.ok(resolved, `Expected resolved source file for ${id3d}`);
    assert.ok(
      resolved.endsWith('.tsx'),
      `Expected ${id3d} to chase barrel to .tsx, got ${resolved}`
    );
    assert.notEqual(path.basename(resolved), 'index.ts');
  }

  // All 2D demos + StyleLab MUST detect Three.js === false
  for (const id2d of [
    'StarterStory',
    'StarterStoryVertical',
    'ProductPromo',
    'StyleLab',
  ]) {
    assert.equal(
      detectCompositionUsesThree(MONOREPO_ROOT, entryPoint, id2d),
      false,
      `Expected detectCompositionUsesThree(${id2d}) === false`
    );
  }

  // Edge cases: comments, `>` inside JSX expression, `id={'Foo'}`, `component={ns.Foo}`, `export { X } from`
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-comp-resolver-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'src', 'scenes'), { recursive: true });
    const target3d = path.join(tmpDir, 'src', 'scenes', 'Real3DScene.tsx');
    fs.writeFileSync(
      target3d,
      `import { ThreeCanvas } from '@remotion/three';\nexport const Real3DScene = () => <ThreeCanvas width={100} height={100} />;\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'scenes', 'index.ts'),
      `export { Real3DScene as ExportedScene } from './Real3DScene';\n`
    );
    const customRoot = path.join(tmpDir, 'src', 'Root.tsx');
    fs.writeFileSync(
      customRoot,
      `import * as Scenes from './scenes';
// <Composition id={'NsThree'} component={Fake} />
export const RemotionRoot = () => (
  <Composition
    id={'NsThree'}
    calculateMetadata={({ props }) => ({ durationInFrames: props.len > 10 ? 300 : 180 })}
    component={Scenes.ExportedScene}
    durationInFrames={300}
    fps={60}
    width={1920}
    height={1080}
  />
);
`
    );
    const resolved = resolveCompositionSourceFromRoot(customRoot, 'NsThree');
    assert.equal(resolved, target3d);
    assert.equal(
      detectCompositionUsesThree(tmpDir, path.join(tmpDir, 'src', 'index.ts'), 'NsThree'),
      true
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('[P0 #7 + #9] @remotion/zod-types is in REQUIRED_RUNTIME_PACKAGES + onboard saas, and cli peerDependenciesMeta marks Remotion peers optional', async () => {
  assert.ok(
    (REQUIRED_RUNTIME_PACKAGES as readonly string[]).includes('@remotion/zod-types')
  );

  const cliPkg = JSON.parse(
    fs.readFileSync(path.join(MONOREPO_ROOT, 'packages', 'cli', 'package.json'), 'utf8')
  ) as { peerDependenciesMeta?: Record<string, { optional?: boolean }> };
  for (const peer of [
    'remotion',
    '@remotion/cli',
    '@remotion/bundler',
    '@remotion/renderer',
  ]) {
    assert.equal(cliPkg.peerDependenciesMeta?.[peer]?.optional, true);
  }

  // Onboard --mode=saas includes @remotion/zod-types and safely quotes spaces in --dir
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-onboard-saas-quote-'));
  try {
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify({ name: 'saas-app', dependencies: { next: '15.0.0' } })
    );
    let out = '';
    await runOnboardCommand({
      cwd: appDir,
      mode: 'saas',
      dir: 'my videos',
      json: true,
      deps: {
        stdout: { isTTY: false, write: (c) => ((out += String(c)), true) },
        env: {},
        checkFfmpeg: () => true,
      },
    });
    const payload = JSON.parse(out.trim()) as { run?: string };
    assert.match(payload.run ?? '', /@remotion\/zod-types/);
    assert.match(payload.run ?? '', /'--dir=my videos'/);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
});

test('[P0 #10] create-make-pictures handles --no-install <dir>, validates --style, infers space from --kit, and defaults EN voice to Liam', async () => {
  const parsed = parseArgs(['--no-install', '--force', 'my-app', '--lang=en']);
  assert.deepEqual(parsed.positionals, ['my-app']);
  assert.equal(parsed.flags['no-install'], true);
  assert.equal(parsed.flags.force, true);

  const tmpParent = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-flags-'));
  const prevCwd = process.cwd();
  try {
    process.chdir(tmpParent);
    await runCreateCli([
      '--no-install',
      'flag-order-app',
      '--kit=paper-diorama-3d',
      '--style=tactile-craft',
      '--lang=en',
    ]);
    const appDir = path.join(tmpParent, 'flag-order-app');
    assert.ok(fs.existsSync(path.join(appDir, 'package.json')));
    const envEx = fs.readFileSync(path.join(appDir, '.env.example'), 'utf8');
    assert.match(envEx, /ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ/);
    const rootTsx = fs.readFileSync(path.join(appDir, 'src', 'Root.tsx'), 'utf8');
    assert.match(rootTsx, /styleId: "tactile-craft"/);
    assert.match(rootTsx, /space: "2\.5d"/);

    // Invalid --style fails fast
    await assert.rejects(
      () =>
        createMakePicturesApp({
          targetDir: path.join(tmpParent, 'bad-style-app'),
          style: 'totally-invalid-style',
          install: false,
        }),
      /Unknown --style/i
    );
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmpParent, { recursive: true, force: true });
  }
});

test('[P1 #1, #2, #3 + P2] CLI respects make-pictures.json lang, validates numeric flags & studio host, handles semi:false & single-element Root.tsx, localizes EN copy, and rejects unknown styles', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-new-fixes-'));
  try {
    // 1. make-pictures.json with lang: "pl" and custom entryPoint
    fs.writeFileSync(
      path.join(tmpDir, 'make-pictures.json'),
      JSON.stringify({ entryPoint: 'video/index.ts', lang: 'pl', fps: 60 })
    );
    fs.mkdirSync(path.join(tmpDir, 'video'), { recursive: true });
    // Semicolon-less, single-element Root.tsx (no <>...</>)
    const customRoot = path.join(tmpDir, 'video', 'Root.tsx');
    fs.writeFileSync(
      customRoot,
      `import React from 'react'
import { Composition } from 'remotion'
import { ExistingComp } from './ExistingComp'

export const RemotionRoot: React.FC = () => (
  <Composition id="ExistingComp" component={ExistingComp} durationInFrames={120} fps={60} width={1920} height={1080} />
)
`,
      'utf8'
    );

    // Omitting --lang on `new` MUST inherit `lang: "pl"` from make-pictures.json
    await runCli(['new', 'polish-inherited', `--cwd=${tmpDir}`]);
    const audioJson = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'src', 'videos', 'polish-inherited', 'audio.json'),
        'utf8'
      )
    ) as { lang: string };
    assert.equal(audioJson.lang, 'pl');

    // Custom entryPoint Root.tsx was updated cleanly without corrupting imports and wrapped in <>...</>
    const updatedRoot = fs.readFileSync(customRoot, 'utf8');
    const importLineIdx = updatedRoot.indexOf(
      "import { PolishInherited, PolishInheritedSchema, defaultPolishInheritedProps }"
    );
    const fnIdx = updatedRoot.indexOf('export const RemotionRoot');
    assert.ok(importLineIdx !== -1 && importLineIdx < fnIdx, 'Import must be placed before component body');
    assert.match(updatedRoot, /<>/);
    assert.match(updatedRoot, /id="ExistingComp"/);
    assert.match(updatedRoot, /id="PolishInherited"/);
    assert.match(updatedRoot, /<\/>/);

    // Explicit --lang=en produces English template labels (no Polish hardcoded copy)
    await runNewProductionCommand({
      cwd: tmpDir,
      slug: 'english-story',
      kit: 'vector-scene-2d',
      lang: 'en',
    });
    const enTsx = fs.readFileSync(
      path.join(tmpDir, 'src', 'videos', 'english-story', 'EnglishStory.tsx'),
      'utf8'
    );
    assert.match(enTsx, /Focal point/);
    assert.match(enTsx, /Starting point/);
    assert.doesNotMatch(enTsx, /Punkt skupienia|Punkt wyjścia|Kolory & Styl/);

    // Unknown --style / --from throw actionable errors instead of silent fallback
    await assert.rejects(
      () =>
        runNewProductionCommand({
          cwd: tmpDir,
          slug: 'bad-style',
          style: 'does-not-exist',
        }),
      /Unknown style/i
    );
    await assert.rejects(
      () =>
        runStyleNewCommand({
          cwd: tmpDir,
          slug: 'my-style',
          from: 'does-not-exist',
        }),
      /Unknown base style/i
    );

    // Invalid numeric CLI flags fail fast
    for (const badArgs of [
      ['music', 'ambient', '--duration=abc', '--mock', `--cwd=${tmpDir}`],
      ['sfx', 'pop', '--duration=NaN', '--mock', `--cwd=${tmpDir}`],
      ['qa', 'Foo', '--duration=xyz', `--cwd=${tmpDir}`],
      ['render', 'Foo', '--timeout=abc', `--cwd=${tmpDir}`],
      ['studio', '--port=notaport', `--cwd=${tmpDir}`],
    ]) {
      await assert.rejects(() => runCli(badArgs), /Invalid --/i);
    }

    // Invalid --host rejected in studio
    await assert.rejects(
      () =>
        runStudioCommand({
          cwd: MONOREPO_ROOT,
          host: '127.0.0.1 && echo pwned',
        }),
      /Invalid --host/i
    );

    // Unrecognized Root.tsx returns warning instead of silently pretending success
    const weirdRoot = path.join(tmpDir, 'WeirdRoot.tsx');
    fs.writeFileSync(weirdRoot, 'export const RemotionRoot = () => null;\n', 'utf8');
    const weirdRes = registerCompositionInRootTsx({
      rootTsxPath: weirdRoot,
      compositionId: 'ExtraComp',
      importRelPath: './ExtraComp',
    });
    assert.equal(weirdRes.updated, false);
    assert.ok(weirdRes.warning);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('[P1 #5] readVoiceoverManifestLiteral parses voiceover strings containing { and } braces', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-vo-braces-'));
  try {
    const manifestTs = path.join(tmpDir, 'audio-manifest.ts');
    fs.writeFileSync(
      manifestTs,
      `export const VOICEOVER_MANIFEST: Record<string, any> = ${JSON.stringify(
        {
          s1: {
            sceneId: 's1',
            durationInSeconds: 4.2,
            text: 'Use unmatched } and { braces and nested {a: {b: 1}} safely.',
          },
        },
        null,
        2
      )};\n`,
      'utf8'
    );
    const parsed = readVoiceoverManifestLiteral(manifestTs);
    assert.ok(parsed);
    assert.equal(
      parsed.s1?.text,
      'Use unmatched } and { braces and nested {a: {b: 1}} safely.'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('[P1 #6 + workspace-paths] audio.ts rejects path traversal & malformed manifests, forwards manifest.voiceSettings, and music/sfx fail on unknown slug', async () => {
  // Top-level voiceSettings changes cache hash
  const hashDefault = computeSceneCacheHash({
    id: 's1',
    durationInSeconds: 3,
    text: 'Hello world.',
  });
  const hashWithManifestSettings = computeSceneCacheHash(
    { id: 's1', durationInSeconds: 3, text: 'Hello world.' },
    { effectiveVoiceSettings: { stability: 0.5, speed: 0.98 } }
  );
  assert.notEqual(hashDefault, hashWithManifestSettings);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-audio-sec-'));
  try {
    // Path traversal in scene.id
    const badSceneDir = path.join(tmpDir, 'src', 'videos', 'bad-scene');
    fs.mkdirSync(badSceneDir, { recursive: true });
    fs.writeFileSync(
      path.join(badSceneDir, 'audio.json'),
      JSON.stringify({
        id: 'bad-scene',
        scenes: [{ id: '../../evil', text: 'Traversal attempt.' }],
      })
    );
    await assert.rejects(
      () => runAudioCommand({ cwd: tmpDir, productionSlug: 'bad-scene', mock: true }),
      /Unsafe|traversal/i
    );

    // Malformed audio.json (missing scenes array)
    const badSchemaDir = path.join(tmpDir, 'src', 'videos', 'bad-schema');
    fs.mkdirSync(badSchemaDir, { recursive: true });
    fs.writeFileSync(
      path.join(badSchemaDir, 'audio.json'),
      JSON.stringify({ id: 'bad-schema', title: 'No scenes' })
    );
    await assert.rejects(
      () => runAudioCommand({ cwd: tmpDir, productionSlug: 'bad-schema', mock: true }),
      /scenes/i
    );

    // Unknown --production in music and sfx MUST throw instead of silently falling through
    await assert.rejects(
      () =>
        runMusicShortcutCommand({
          cwd: tmpDir,
          productionSlug: 'nonexistent-slug',
          mock: true,
        }),
      /Audio manifest not found/i
    );
    await assert.rejects(
      () =>
        runSfxShortcutCommand({
          cwd: tmpDir,
          productionSlug: 'nonexistent-slug',
          mock: true,
        }),
      /Audio manifest not found/i
    );

    // loadMakePicturesConfig validates invalid fields & falls back to rootDir when --dir has no config
    const subDir = path.join(tmpDir, 'videos');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'make-pictures.json'),
      JSON.stringify({ lang: 'pl', fps: 30 })
    );
    const inherited = loadMakePicturesConfig(subDir, tmpDir);
    assert.equal(inherited.lang, 'pl');
    assert.equal(inherited.fps, 30);

    fs.writeFileSync(
      path.join(subDir, 'make-pictures.json'),
      JSON.stringify({ lang: 'fr' })
    );
    assert.throws(() => loadMakePicturesConfig(subDir), /Invalid "lang"/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
