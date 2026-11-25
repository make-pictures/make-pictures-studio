import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCENES_KIT_IDS,
  VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG,
  runNewProductionCommand,
} from '../src/commands/new-production';
import {
  loadWorkspaceCustomStyles,
  runStyleNewCommand,
  runStylesListCommand,
} from '../src/commands/styles';
import {
  FALLBACK_AGENTS_MD,
  loadMakePicturesConfig,
} from '../src/commands/workspace-paths';
import { auditCompositionDirection } from '../src/director/audit-direction';
import { runCli } from '../src/index';

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
    assert.equal(listed.builtInStyles.length, 10);
    assert.equal(listed.customStyles.length, 1);
    assert.equal(listed.visualKits.length, 7);

    // Human-readable output via runCli(['styles'])
    await runCli(['styles', `--cwd=${tmpDir}`]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadMakePicturesConfig reads optional make-pictures.json with zero lock-in defaults', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-config-'));
  try {
    const defaults = loadMakePicturesConfig(tmpDir);
    assert.deepEqual(defaults, {
      entryPoint: 'src/index.ts',
      publicDir: 'public',
      videosDir: 'src/videos',
      stylesDir: 'styles',
      lang: 'en',
      fps: 60,
    });

    fs.writeFileSync(
      path.join(tmpDir, 'make-pictures.json'),
      JSON.stringify({
        entryPoint: 'remotion/index.ts',
        videosDir: 'remotion/films',
        stylesDir: 'remotion/styles',
        lang: 'pl',
        fps: 30,
      }),
      'utf8'
    );
    const custom = loadMakePicturesConfig(tmpDir);
    assert.deepEqual(custom, {
      entryPoint: 'remotion/index.ts',
      publicDir: 'public',
      videosDir: 'remotion/films',
      stylesDir: 'remotion/styles',
      lang: 'pl',
      fps: 30,
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('make-pictures new defaults to vector-scene-2d + minimal-product, generates 7 distinct TSX templates in src/videos/<slug>/, and registers in src/Root.tsx', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-new-7kits-'));
  try {
    const defProd = await runNewProductionCommand({
      cwd: tmpDir,
      slug: 'default-film',
      lang: 'pl',
    });
    assert.equal(
      defProd.productionDir,
      path.join(tmpDir, 'src', 'videos', 'default-film')
    );

    const defIndex = fs.readFileSync(
      path.join(defProd.productionDir, 'index.ts'),
      'utf8'
    );
    assert.match(defIndex, /vector-scene-2d/);
    assert.doesNotMatch(defIndex, /paper-diorama-3d/);
    assert.doesNotMatch(defIndex, /defineProduction/);

    const defTsx = fs.readFileSync(
      path.join(defProd.productionDir, 'DefaultFilm.tsx'),
      'utf8'
    );
    assert.match(defTsx, /VectorSceneStage2D/);
    assert.match(defTsx, /foregroundCallouts/);
    assert.match(defTsx, /focusShiftFrame=\{150\}/);
    assert.match(defTsx, /"styleId": "minimal-product"/);
    assert.match(defTsx, /@make-pictures\/remotion/);

    const rootTsx = fs.readFileSync(
      path.join(tmpDir, 'src', 'Root.tsx'),
      'utf8'
    );
    assert.match(rootTsx, /id="DefaultFilm"/);
    assert.match(rootTsx, /component=\{DefaultFilm\}/);
    assert.match(rootTsx, /defaultProps=\{defaultDefaultFilmProps\}/);

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
      const tsxPath = path.join(res.productionDir, `${res.compositionId}.tsx`);
      assert.equal(fs.existsSync(tsxPath), true);
      const tsx = fs.readFileSync(tsxPath, 'utf8');
      assert.match(tsx, /StyleProvider/);
      assert.match(tsx, /renderBackdrop/);
      assert.match(tsx, /style=\{props\.styleId\}/);
      assert.match(tsx, /<VoiceoverTrack\b/);
      assert.match(tsx, /<SoundCue\b/);
      assert.match(tsx, /ContinuousSceneFlow/);
      assert.match(tsx, /crossDissolveFrames=\{48\}/);
      assert.doesNotMatch(tsx, /@make-pictures\/core|@make-pictures\/kits/);
      assert.doesNotMatch(tsx, /PaperMountainBackdrop3D/);
      assert.doesNotMatch(tsx, /warm-parquet/);
      assert.doesNotMatch(tsx, /codeMorphFrame/);
      assert.doesNotMatch(tsx, /MOD 01/);

      if (kitId === 'paper-diorama-3d') {
        assert.match(tsx, /DioramaStage3D/);
        assert.match(tsx, /SunburstArchCutout3D/);
        assert.match(tsx, /MountainRangeCutout3D/);
        assert.match(tsx, /AtelierDeskCutout3D/);
      }
      if (kitId === 'isometric-3d') {
        assert.match(tsx, /StudioHdrRig3D/);
        assert.match(tsx, /PodcastStudioSet3D/);
        assert.match(tsx, /from '@make-pictures\/remotion\/camera'/);
        assert.match(tsx, /DirectorCamera3D/);
        assert.match(tsx, /ClayCharacter3D/);
        assert.doesNotMatch(tsx, /showGrid/);
        assert.doesNotMatch(tsx, /frame\s*\*\s*0\.16/);
      }
      if (kitId === 'motion-diagrams-2d') {
        assert.match(tsx, /MotionDiagramStage2D/);
        assert.match(tsx, /SystemNode/);
        assert.match(tsx, /DataFlowEdge/);
      }
      if (kitId === 'editorial-collage') {
        assert.match(tsx, /EditorialDeskStage/);
        assert.match(tsx, /focusShiftFrame/);
      }
      if (kitId === 'kinetic-typography') {
        assert.match(tsx, /ScenicBackdropLayers/);
        assert.match(tsx, /StageLightingRig/);
        assert.match(tsx, /OpticalStage2D/);
      }
      if (kitId === 'vector-scene-2d') {
        assert.match(tsx, /VectorSceneStage2D/);
        assert.match(tsx, /foregroundCallouts/);
        assert.match(tsx, /<AnnotatedCallout2D/);
        assert.match(
          tsx,
          /target=\{isVertical \? \[360, 650\] : \[960, 560\]\}/
        );
        assert.match(
          tsx,
          /labelPosition=\{isVertical \? \[590, 860\] : \[1180, 790\]\}/
        );
        assert.match(tsx, /focusShiftFrame=\{150\}/);
      }
      if (kitId === 'data-storytelling') {
        assert.match(tsx, /DataStoryStage2D/);
        assert.match(tsx, /TimelineTrack/);
      }

      const normalizedTemplate = tsx
        .replaceAll(`kit-${kitId}`, 'SLUG')
        .replaceAll(res.compositionId, 'COMP');
      seenTemplates.add(normalizedTemplate);

      const audioJson = JSON.parse(
        fs.readFileSync(path.join(res.productionDir, 'audio.json'), 'utf8')
      ) as {
        scenes: Array<{ voiceId?: string }>;
        score?: { moodPreset?: string };
      };

      if (kitId === 'editorial-collage') {
        assert.equal(
          audioJson.scenes[0]?.voiceId,
          VOICE_ARCHETYPE_TO_ELEVENLABS_ID_BY_LANG.pl['documentary-warm']
        );
        assert.equal(audioJson.score?.moodPreset, 'warm-story');
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
        path.join(tmpDir, 'src', 'videos', 'voiced-film', 'audio.json'),
        'utf8'
      )
    ) as { scenes: Array<{ voiceId?: string }>; score?: { moodPreset?: string } };
    assert.equal(voicedManifest.scenes[0]?.voiceId, 'customVoice123');
    assert.equal(voicedManifest.score?.moodPreset, 'ambient-tech');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('FALLBACK_AGENTS_MD references v3 skills and --space=2d/2.5d/3d scaffolds pass auditCompositionDirection', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-space-scaffolds-cli-'));
  try {
    assert.match(FALLBACK_AGENTS_MD, /art-direction-and-styles/);
    assert.match(FALLBACK_AGENTS_MD, /kits-2d/);
    assert.match(FALLBACK_AGENTS_MD, /remotion studio/);
    assert.doesNotMatch(
      FALLBACK_AGENTS_MD,
      /@make-pictures\/studio|@make-pictures\/core|@make-pictures\/kits|Studio Web/
    );

    for (const [slug, flags, expectedToken] of [
      ['cli-retro-2d', ['--space=2d', '--style=retro-pc'], 'RetroPcWindowStage2D'],
      ['cli-cutout-25d', ['--space=2.5d'], 'DioramaStage3D'],
      ['cli-clay-3d', ['--space=3d'], 'PodcastStudioSet3D'],
    ] as const) {
      await runCli(['new', slug, ...flags, '--lang=pl', `--cwd=${tmpDir}`]);
      const compId = slug
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
      const videoDir = path.join(tmpDir, 'src', 'videos', slug);
      const compTsx = fs.readFileSync(
        path.join(videoDir, `${compId}.tsx`),
        'utf8'
      );
      assert.match(compTsx, new RegExp(`<${expectedToken}\\b`));

      const audit = auditCompositionDirection({
        studioDir: tmpDir,
        rootDir: tmpDir,
        compositionId: compId,
        origin: 'production',
        capsuleDir: videoDir,
        durationInFrames: 720,
        fps: 60,
        allowFastCuts: false,
      });
      assert.equal(audit.ok, true);
      assert.equal(audit.violations.length, 0);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
