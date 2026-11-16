import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCENES_KIT_IDS,
  buildScaffoldProductionManifest,
  runNewProductionCommand,
} from '../src/commands/new-production';
import { auditCompositionDirection } from '../src/director/audit-direction';
import { createMakePicturesApp } from '../../create-make-pictures/src/index';

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

test('buildScaffoldProductionManifest produces calm PL and EN copy (<= 2.2 words/s, zero ! or raw acronyms, >= 90f breathing room per 360f scene)', () => {
  for (const lang of ['pl', 'en'] as const) {
    for (const kit of SCENES_KIT_IDS) {
      const manifest = buildScaffoldProductionManifest(
        `calm-${kit}`,
        'Calm Studio Story',
        kit,
        lang
      );
      assert.equal(manifest.fps, 60);
      assert.equal(manifest.scenes.length, 2);
      assert.equal(manifest.score?.durationSeconds, 12);

      for (const scene of manifest.scenes) {
        assert.ok(
          !scene.text.includes('!'),
          `Expected zero exclamation marks in ${kit}/${lang}: "${scene.text}"`
        );
        assert.doesNotMatch(
          scene.text,
          /\b(?:FPS|LUFS|JSON|API|UI|3D|2D|AI)\b/,
          `Expected zero raw uppercase acronyms in TTS text (${kit}/${lang}): "${scene.text}"`
        );
        const words = countWords(scene.text);
        const wordsPerSec = words / 6.0;
        assert.ok(
          wordsPerSec <= 2.2,
          `Expected <= 2.2 words/s across 6.0s visual scene (${kit}/${lang}), got ${wordsPerSec.toFixed(2)} ("${scene.text}")`
        );

        const spokenFrames =
          scene.durationInFrames ??
          Math.round((scene.durationInSeconds ?? 4.2) * 60);
        const breathingFrames = 360 - spokenFrames;
        assert.ok(
          breathingFrames >= 90,
          `Expected >= 90 frames of breathing room in 360f scene (${kit}/${lang}), got ${breathingFrames}f`
        );
      }
    }
  }
});

test('all 7 new-production kit scaffolds (PL & EN) generate 720-frame ContinuousSceneFlow capsules and pass auditCompositionDirection with 0 violations', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-new-prod-audit-'));
  try {
    for (const lang of ['pl', 'en'] as const) {
      for (const kit of SCENES_KIT_IDS) {
        const slug = `check-${kit}-${lang}`;
        const style =
          kit === 'editorial-collage'
            ? 'editorial-press'
            : kit === 'paper-diorama-3d'
              ? 'tactile-craft'
              : 'minimal-product';

        const { productionDir, compositionId } = await runNewProductionCommand({
          cwd: tmpDir,
          slug,
          kit,
          style,
          lang,
          prepopulateTimestamps: true,
        });

        const indexFile = path.join(productionDir, 'index.ts');
        const tsxFile = path.join(
          productionDir,
          'compositions',
          `${compositionId}.tsx`
        );
        const indexSrc = fs.readFileSync(indexFile, 'utf8');
        const tsxSrc = fs.readFileSync(tsxFile, 'utf8');

        assert.match(indexSrc, /durationInFrames:\s*720\b/);
        assert.match(tsxSrc, /<ContinuousSceneFlow\b/);
        assert.match(tsxSrc, /crossDissolveFrames=\{48\}/);
        assert.doesNotMatch(tsxSrc, /<SceneTransition\b/);
        assert.doesNotMatch(tsxSrc, /MOD 01/);
        assert.doesNotMatch(tsxSrc, /Math\.random\s*\(/);

        const twoScenes = [...tsxSrc.matchAll(/\bdurationInFrames:\s*360\b/g)];
        assert.equal(
          twoScenes.length,
          2,
          `Expected 2 x 360f scenes in ${kit} TSX`
        );

        if (kit === 'paper-diorama-3d') {
          for (const motif of [
            'SunburstArchCutout3D',
            'MountainRangeCutout3D',
            'CloudCanopyCutout3D',
            'PineGroveCutout3D',
            'AtelierDeskCutout3D',
          ]) {
            assert.match(
              tsxSrc,
              new RegExp(`<${motif}\\b`),
              `Expected paper-diorama-3d scaffold to mount <${motif}>`
            );
          }
          assert.doesNotMatch(
            tsxSrc,
            /<PaperCutout3D\b/,
            'Expected paper-diorama-3d scaffold not to use raw rectangular PaperCutout3D text plaques'
          );
        }

        if (kit === 'isometric-3d') {
          assert.match(tsxSrc, /<StudioHdrRig3D\b/);
          assert.match(tsxSrc, /<PodcastStudioSet3D\b/);
          assert.match(tsxSrc, /<ClayCharacter3D\b/);
          assert.doesNotMatch(tsxSrc, /\bshowGrid\b/);
        }

        if (kit === 'motion-diagrams-2d') {
          assert.match(tsxSrc, /<SystemNode\b/);
          assert.match(tsxSrc, /<DataFlowEdge\b/);
          assert.doesNotMatch(tsxSrc, /\bmoduleCode\b/);
        }

        const auditRes = auditCompositionDirection({
          studioDir: tmpDir,
          rootDir: tmpDir,
          compositionId,
          origin: 'production',
          productionId: slug,
          propsFile: `productions/${slug}/compositions/${compositionId}.props.json`,
          durationInFrames: 720,
          fps: 60,
          sceneTimeline: [
            {
              sceneId: `${slug}-intro`,
              fromFrame: 12,
              durationInFrames: 252,
            },
            {
              sceneId: `${slug}-payoff`,
              fromFrame: 360,
              durationInFrames: 252,
            },
          ],
        });

        assert.equal(
          auditRes.ok,
          true,
          `Expected ${kit} (${lang}) scaffold to pass auditCompositionDirection with 0 violations, got: ${JSON.stringify(auditRes.violations)}`
        );
        assert.equal(auditRes.violations.length, 0);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('all 7 create-make-pictures starter kits generate 720-frame HelloStudio capsules passing auditCompositionDirection with 0 violations', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-cmp-7kits-audit-'));
  try {
    for (const kit of SCENES_KIT_IDS) {
      const appDir = path.join(tmpRoot, `app-${kit}`);
      await createMakePicturesApp({
        targetDir: appDir,
        kit,
        lang: 'pl',
        install: false,
      });

      const indexFile = path.join(
        appDir,
        'productions',
        'hello-studio',
        'index.ts'
      );
      const tsxFile = path.join(
        appDir,
        'productions',
        'hello-studio',
        'compositions',
        'HelloStudio.tsx'
      );
      const indexSrc = fs.readFileSync(indexFile, 'utf8');
      const tsxSrc = fs.readFileSync(tsxFile, 'utf8');

      assert.match(indexSrc, /durationInFrames:\s*720\b/);
      assert.match(tsxSrc, /<ContinuousSceneFlow\b/);

      const auditRes = auditCompositionDirection({
        studioDir: appDir,
        rootDir: appDir,
        compositionId: 'HelloStudio',
        origin: 'production',
        productionId: 'hello-studio',
        propsFile: 'productions/hello-studio/compositions/HelloStudio.props.json',
        durationInFrames: 720,
        fps: 60,
        sceneTimeline: [
          {
            sceneId: 'hello-studio-intro',
            fromFrame: 12,
            durationInFrames: 252,
          },
          {
            sceneId: 'hello-studio-payoff',
            fromFrame: 360,
            durationInFrames: 252,
          },
        ],
      });

      assert.equal(
        auditRes.ok,
        true,
        `Expected create-make-pictures (${kit}) HelloStudio to pass auditCompositionDirection cleanly, got: ${JSON.stringify(auditRes.violations)}`
      );
      assert.equal(auditRes.violations.length, 0);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('--space=2d/2.5d/3d scaffolds (including --style=retro-pc, paper-diorama-3d, and soft-clay) pass auditCompositionDirection with allowFastCuts: false', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-space-scaffolds-'));
  try {
    const spaceCases = [
      {
        slug: 'retro-space-2d',
        space: '2d' as const,
        style: 'retro-pc',
        expectedPattern: /<RetroPcWindowStage2D\b/,
      },
      {
        slug: 'diorama-space-25d',
        space: '2.5d' as const,
        style: undefined,
        expectedPattern: /<DioramaStage3D\b/,
      },
      {
        slug: 'clay-space-3d',
        space: '3d' as const,
        style: undefined,
        expectedPattern: /<PodcastStudioSet3D\b/,
      },
    ] as const;

    for (const lang of ['pl', 'en'] as const) {
      for (const tc of spaceCases) {
        const slug = `${tc.slug}-${lang}`;
        const { productionDir, compositionId } = await runNewProductionCommand({
          cwd: tmpDir,
          slug,
          space: tc.space,
          style: tc.style,
          lang,
          prepopulateTimestamps: true,
        });

        const tsxSrc = fs.readFileSync(
          path.join(productionDir, 'compositions', `${compositionId}.tsx`),
          'utf8'
        );
        assert.match(tsxSrc, tc.expectedPattern);
        assert.doesNotMatch(tsxSrc, /Math\.random\s*\(/);

        const propsJson = JSON.parse(
          fs.readFileSync(
            path.join(
              productionDir,
              'compositions',
              `${compositionId}.props.json`
            ),
            'utf8'
          )
        ) as { styleId: string };

        if (tc.space === '2d') assert.equal(propsJson.styleId, 'retro-pc');
        if (tc.space === '2.5d') assert.equal(propsJson.styleId, 'tactile-craft');
        if (tc.space === '3d') assert.equal(propsJson.styleId, 'soft-clay');

        const auditRes = auditCompositionDirection({
          studioDir: tmpDir,
          rootDir: tmpDir,
          compositionId,
          origin: 'production',
          productionId: slug,
          propsFile: `productions/${slug}/compositions/${compositionId}.props.json`,
          durationInFrames: 720,
          fps: 60,
          allowFastCuts: false,
          sceneTimeline: [
            {
              sceneId: `${slug}-intro`,
              fromFrame: 12,
              durationInFrames: 252,
            },
            {
              sceneId: `${slug}-payoff`,
              fromFrame: 360,
              durationInFrames: 252,
            },
          ],
        });
        assert.equal(auditRes.ok, true);
        assert.equal(auditRes.violations.length, 0);
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
