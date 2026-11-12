import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCENES_KIT_IDS,
  VOICE_ARCHETYPE_TO_ELEVENLABS_ID,
  runNewProductionCommand,
} from '../src/commands/new-production';
import {
  loadWorkspaceCustomStyles,
  runStyleNewCommand,
  runStylesListCommand,
} from '../src/commands/styles';
import { runInitCommand } from '../src/commands/init';
import { FALLBACK_AGENTS_MD } from '../src/commands/workspace-paths';
import { runCli } from '../src/index';
import {
  createMakePicturesApp,
  runCreateCli,
} from '../../create-make-pictures/src/index';

test('make-pictures style new creates validated styles/<slug>.style.json and blocks built-in IDs and path traversal', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-styles-cli-'));
  try {
    await assert.rejects(
      () =>
        runStyleNewCommand({
          cwd: tmpDir,
          slug: 'minimal-product',
          from: 'editorial-press',
        }),
      /built-in|zarezerwowany/i
    );

    await assert.rejects(
      () =>
        runStyleNewCommand({
          cwd: tmpDir,
          slug: '../escape-dir',
          from: 'editorial-press',
        }),
      /slug|ścieżka|path/i
    );

    const created = await runStyleNewCommand({
      cwd: tmpDir,
      slug: 'neapolitan-chronicle',
      from: 'archival-chronicle',
    });
    assert.equal(fs.existsSync(created.filePath), true);
    assert.equal(created.preset.id, 'neapolitan-chronicle');

    const loaded = loadWorkspaceCustomStyles(tmpDir);
    assert.equal(loaded.warnings.length, 0);
    assert.equal(loaded.styles.length, 1);
    assert.equal(loaded.styles[0]?.id, 'neapolitan-chronicle');

    const listed = await runStylesListCommand({ cwd: tmpDir, json: true });
    assert.equal(listed.builtInStyles.length, 7);
    assert.equal(listed.customStyles.length, 1);
    assert.equal(listed.visualKits.length, 7);

    // Human-readable output via runCli(['styles'])
    await runCli(['styles', `--cwd=${tmpDir}`]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('make-pictures new defaults to vector-scene-2d + minimal-product and generates 7 distinct TSX templates', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-new-7kits-'));
  try {
    const defProd = await runNewProductionCommand({
      cwd: tmpDir,
      slug: 'default-film',
      lang: 'pl',
    });
    const defIndex = fs.readFileSync(
      path.join(defProd.productionDir, 'index.ts'),
      'utf8'
    );
    assert.match(defIndex, /vector-scene-2d/);
    assert.doesNotMatch(defIndex, /paper-diorama-3d/);

    const defProps = JSON.parse(
      fs.readFileSync(
        path.join(
          defProd.productionDir,
          'compositions',
          'DefaultFilm.props.json'
        ),
        'utf8'
      )
    ) as { styleId: string };
    assert.equal(defProps.styleId, 'minimal-product');

    assert.equal(SCENES_KIT_IDS.length, 7);
    const seenTemplates = new Set<string>();

    for (const kitId of SCENES_KIT_IDS) {
      const styleId =
        kitId === 'editorial-collage'
          ? 'archival-chronicle'
          : 'minimal-product';
      const res = await runNewProductionCommand({
        cwd: tmpDir,
        slug: `kit-${kitId}`,
        kit: kitId,
        style: styleId,
        lang: 'pl',
      });
      const compFiles = fs
        .readdirSync(path.join(res.productionDir, 'compositions'))
        .filter((f) => f.endsWith('.tsx'));
      assert.equal(compFiles.length, 1);
      const tsx = fs.readFileSync(
        path.join(res.productionDir, 'compositions', compFiles[0]!),
        'utf8'
      );
      assert.match(tsx, /StyleProvider/);
      assert.match(tsx, /renderBackdrop/);
      assert.match(tsx, /style=\{props\.styleId\}/);
      assert.match(tsx, /<VoiceoverTrack\b/);
      assert.match(tsx, /<SoundCue\b/);
      assert.doesNotMatch(tsx, /PaperMountainBackdrop3D/);
      assert.doesNotMatch(tsx, /warm-parquet/);
      assert.doesNotMatch(tsx, /codeMorphFrame/);

      if (kitId === 'paper-diorama-3d') {
        assert.match(tsx, /DioramaStage3D/);
      }
      if (kitId === 'isometric-3d') {
        assert.match(tsx, /IsometricStage3D/);
      }

      const normalizedTemplate = tsx
        .replaceAll(`kit-${kitId}`, 'SLUG')
        .replaceAll(res.compositionId, 'COMP');
      seenTemplates.add(normalizedTemplate);

      const prodJson = JSON.parse(
        fs.readFileSync(path.join(res.productionDir, 'production.json'), 'utf8')
      ) as {
        scenes: Array<{ voiceId?: string }>;
        score?: { moodPreset?: string };
      };

      if (kitId === 'editorial-collage') {
        assert.equal(
          prodJson.scenes[0]?.voiceId,
          VOICE_ARCHETYPE_TO_ELEVENLABS_ID['documentary-warm']
        );
        assert.equal(prodJson.score?.moodPreset, 'warm-story');
      }
    }

    assert.equal(
      seenTemplates.size,
      7,
      'Each of the 7 kits must generate a distinct TSX composition template'
    );

    // Explicit --voice override via CLI
    await runCli([
      'style',
      'new',
      'custom-brand',
      '--from=cyber-telemetry',
      `--cwd=${tmpDir}`,
    ]);
    await runCli([
      'new',
      'voiced-film',
      '--kit=kinetic-typography',
      '--style=custom-brand',
      '--voice=customVoice123',
      `--cwd=${tmpDir}`,
    ]);
    const voicedManifest = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, 'productions', 'voiced-film', 'production.json'),
        'utf8'
      )
    ) as { scenes: Array<{ voiceId?: string }>; score?: { moodPreset?: string } };
    assert.equal(voicedManifest.scenes[0]?.voiceId, 'customVoice123');
    assert.equal(voicedManifest.score?.moodPreset, 'ambient-tech');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createMakePicturesApp and init scaffold styles/README.md, registerCustomStyles, and default to vector-scene-2d unless --kit is passed', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-create-styles-'));
  const appDir = path.join(tmpDir, 'studio-app');
  const cliKitDir = path.join(tmpDir, 'cli-kit-app');
  const saasRepoDir = path.join(tmpDir, 'saas-repo');
  try {
    await createMakePicturesApp({
      targetDir: appDir,
      lang: 'pl',
      install: false,
    });
    assert.equal(fs.existsSync(path.join(appDir, 'styles', 'README.md')), true);
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    assert.equal(pkgJson.scripts?.styles, 'make-pictures styles');

    const srcIndex = fs.readFileSync(
      path.join(appDir, 'src', 'index.ts'),
      'utf8'
    );
    assert.match(srcIndex, /registerCustomStyles/);
    const helloIndex = fs.readFileSync(
      path.join(appDir, 'productions', 'hello-studio', 'index.ts'),
      'utf8'
    );
    assert.match(helloIndex, /vector-scene-2d/);

    // Explicit --kit flag on create-make-pictures CLI is honored
    await runCreateCli([
      cliKitDir,
      '--kit=paper-diorama-3d',
      '--lang=pl',
      '--no-install',
    ]);
    const cliKitIndex = fs.readFileSync(
      path.join(cliKitDir, 'productions', 'hello-studio', 'index.ts'),
      'utf8'
    );
    assert.match(cliKitIndex, /paper-diorama-3d/);

    // make-pictures init --dir=videos scaffolds styles/README.md + registerCustomStyles + vector-scene-2d
    fs.mkdirSync(saasRepoDir, { recursive: true });
    await runInitCommand({
      cwd: saasRepoDir,
      dir: 'videos',
      lang: 'pl',
    });
    assert.equal(
      fs.existsSync(path.join(saasRepoDir, 'videos', 'styles', 'README.md')),
      true
    );
    const saasEntry = fs.readFileSync(
      path.join(saasRepoDir, 'videos', 'index.ts'),
      'utf8'
    );
    assert.match(saasEntry, /registerCustomStyles/);
    const saasHelloIndex = fs.readFileSync(
      path.join(
        saasRepoDir,
        'videos',
        'productions',
        'hello-studio',
        'index.ts'
      ),
      'utf8'
    );
    assert.match(saasHelloIndex, /vector-scene-2d/);

    // Fallback AGENTS.md includes new skills
    assert.match(FALLBACK_AGENTS_MD, /style-and-art-direction/);
    assert.match(FALLBACK_AGENTS_MD, /kit-editorial-and-vector/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
