import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
  type StylePreset,
} from '../../core/src/index';
import {
  defaultKitAndStyleForSpace,
  runNewProductionCommand,
} from '../src/commands/new-production';
import { runStylesListCommand } from '../src/commands/styles';
import { runCli } from '../src/index';
import {
  ProjectPickerPopover,
  STYLE_LAB_DURATION_IN_FRAMES,
  STYLE_LAB_FPS,
  StyleLabPreviewComposition,
  StyleLabShowcase,
} from '../../studio/src/client/index';
import {
  defaultPreviewKitForSpace,
  resolveKitDimensionalSpace,
} from '../../studio/src/client/components/StyleLabShowcase';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

async function captureConsoleOutput(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  };
  console.warn = (...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(' '));
  };
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return lines.join('\n');
}

test('runStylesListCommand lists 10 built-in styles, prints [spaces] tags, and filters built-in + custom styles via space=2d|2.5d|3d', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-v5-styles-space-'));
  try {
    const stylesDir = path.join(tmpDir, 'styles');
    fs.mkdirSync(stylesDir, { recursive: true });

    const custom3DOnly: StylePreset = StylePresetSchema.parse({
      ...BUILT_IN_STYLES['soft-clay'],
      id: 'clay-brand-3d',
      name: 'Clay Brand 3D',
      preferredSpace: '3d',
      spaces: ['3d'],
    });
    const customOmni: StylePreset = StylePresetSchema.parse({
      ...BUILT_IN_STYLES['minimal-product'],
      id: 'omni-brand',
      name: 'Omni Brand',
      preferredSpace: '2d',
      spaces: ['2d', '2.5d', '3d'],
    });
    const custom2DOnly: StylePreset = StylePresetSchema.parse({
      ...BUILT_IN_STYLES['brutalist-poster'],
      id: 'poster-2d-only',
      name: 'Poster 2D Only',
      preferredSpace: '2d',
      spaces: ['2d'],
    });

    for (const preset of [custom3DOnly, customOmni, custom2DOnly]) {
      fs.writeFileSync(
        path.join(stylesDir, `${preset.id}.style.json`),
        `${JSON.stringify(preset, null, 2)}\n`,
        'utf8'
      );
    }

    const allListed = await runStylesListCommand({ cwd: tmpDir, json: true });
    assert.equal(allListed.builtInStyles.length, 10);
    assert.equal(allListed.customStyles.length, 3);

    const listed3D = await runStylesListCommand({
      cwd: tmpDir,
      space: '3d',
      json: true,
    });
    assert.deepEqual(
      new Set(listed3D.builtInStyles.map((s) => s.id)),
      new Set(['cyber-telemetry', 'retro-pc', 'soft-clay', 'glass-studio'])
    );
    assert.deepEqual(
      new Set(listed3D.customStyles.map((s) => s.id)),
      new Set(['clay-brand-3d', 'omni-brand'])
    );

    const listed25D = await runStylesListCommand({
      cwd: tmpDir,
      space: '2.5d',
      json: true,
    });
    assert.ok(listed25D.builtInStyles.some((s) => s.id === 'tactile-craft'));
    assert.ok(listed25D.builtInStyles.some((s) => s.id === 'editorial-press'));
    assert.ok(!listed25D.builtInStyles.some((s) => s.id === 'soft-clay'));
    assert.deepEqual(
      listed25D.customStyles.map((s) => s.id),
      ['omni-brand']
    );

    const listed2D = await runStylesListCommand({
      cwd: tmpDir,
      space: '2d',
      json: true,
    });
    assert.ok(listed2D.builtInStyles.some((s) => s.id === 'retro-pc'));
    assert.ok(listed2D.builtInStyles.some((s) => s.id === 'glass-studio'));
    assert.ok(!listed2D.builtInStyles.some((s) => s.id === 'soft-clay'));
    assert.deepEqual(
      new Set(listed2D.customStyles.map((s) => s.id)),
      new Set(['omni-brand', 'poster-2d-only'])
    );

    const humanOutAll = await captureConsoleOutput(async () => {
      await runCli(['styles', `--cwd=${tmpDir}`]);
    });
    assert.match(humanOutAll, /Built-in Art Direction Styles \(10\)/);
    assert.match(humanOutAll, /\[2d, 3d\]/);
    assert.match(humanOutAll, /\[3d\]/);

    const humanOut3D = await captureConsoleOutput(async () => {
      await runCli(['styles', '--space=3d', `--cwd=${tmpDir}`]);
    });
    assert.match(humanOut3D, /Built-in Art Direction Styles.*\(4\)/);
    assert.match(humanOut3D, /soft-clay/);
    assert.doesNotMatch(humanOut3D, /brutalist-poster/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('defaultKitAndStyleForSpace, runNewProductionCommand, and runCli wire --space=2d|2.5d|3d on new/init and validate invalid --space', async () => {
  assert.deepEqual(defaultKitAndStyleForSpace('2d'), {
    kit: 'motion-diagrams-2d',
    styleId: 'minimal-product',
  });
  assert.deepEqual(defaultKitAndStyleForSpace('2.5d'), {
    kit: 'paper-diorama-3d',
    styleId: 'tactile-craft',
  });
  assert.deepEqual(defaultKitAndStyleForSpace('3d'), {
    kit: 'isometric-3d',
    styleId: 'soft-clay',
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-v5-new-space-'));
  try {
    // 1. --space=3d defaults to isometric-3d + soft-clay
    const clayProd = await runNewProductionCommand({
      cwd: tmpDir,
      slug: 'clay-demo',
      space: '3d',
      lang: 'pl',
    });
    const clayIndex = fs.readFileSync(
      path.join(clayProd.productionDir, 'index.ts'),
      'utf8'
    );
    assert.match(clayIndex, /kit: 'isometric-3d'/);
    const clayProps = JSON.parse(
      fs.readFileSync(
        path.join(clayProd.productionDir, 'compositions', 'ClayDemo.props.json'),
        'utf8'
      )
    ) as { styleId: string };
    assert.equal(clayProps.styleId, 'soft-clay');

    // 2. --space=2.5d defaults to paper-diorama-3d + tactile-craft
    const cutoutProd = await runNewProductionCommand({
      cwd: tmpDir,
      slug: 'apollo-cutout',
      space: '2.5d',
      lang: 'pl',
    });
    const cutoutIndex = fs.readFileSync(
      path.join(cutoutProd.productionDir, 'index.ts'),
      'utf8'
    );
    assert.match(cutoutIndex, /kit: 'paper-diorama-3d'/);
    const cutoutProps = JSON.parse(
      fs.readFileSync(
        path.join(
          cutoutProd.productionDir,
          'compositions',
          'ApolloCutout.props.json'
        ),
        'utf8'
      )
    ) as { styleId: string };
    assert.equal(cutoutProps.styleId, 'tactile-craft');

    // 3. --space=2d defaults to motion-diagrams-2d + minimal-product, while explicit --style overrides style
    await runCli([
      'new',
      'retro-net',
      '--space=2d',
      '--style=retro-pc',
      '--lang=pl',
      `--cwd=${tmpDir}`,
    ]);
    const retroIndex = fs.readFileSync(
      path.join(tmpDir, 'productions', 'retro-net', 'index.ts'),
      'utf8'
    );
    assert.match(retroIndex, /kit: 'motion-diagrams-2d'/);
    const retroProps = JSON.parse(
      fs.readFileSync(
        path.join(
          tmpDir,
          'productions',
          'retro-net',
          'compositions',
          'RetroNet.props.json'
        ),
        'utf8'
      )
    ) as { styleId: string };
    assert.equal(retroProps.styleId, 'retro-pc');

    // 4. init --space=3d --dir=videos scaffolds hello-studio with isometric-3d + soft-clay
    const saasDir = path.join(tmpDir, 'saas-app');
    fs.mkdirSync(saasDir, { recursive: true });
    await runCli([
      'init',
      '--space=3d',
      '--dir=videos',
      '--lang=pl',
      `--cwd=${saasDir}`,
    ]);
    const initHelloIndex = fs.readFileSync(
      path.join(saasDir, 'videos', 'productions', 'hello-studio', 'index.ts'),
      'utf8'
    );
    assert.match(initHelloIndex, /kit: 'isometric-3d'/);
    const initHelloProps = JSON.parse(
      fs.readFileSync(
        path.join(
          saasDir,
          'videos',
          'productions',
          'hello-studio',
          'compositions',
          'HelloStudio.props.json'
        ),
        'utf8'
      )
    ) as { styleId: string };
    assert.equal(initHelloProps.styleId, 'soft-clay');

    // 5. Invalid --space values fail fast with a helpful validation message
    for (const badArgs of [
      ['styles', '--space=4d', `--cwd=${tmpDir}`],
      ['new', 'bad-film', '--space=invalid', `--cwd=${tmpDir}`],
      ['init', '--space=1d', `--cwd=${tmpDir}`],
    ]) {
      await assert.rejects(
        () => runCli(badArgs),
        /--space.*2d.*2\.5d.*3d/i
      );
    }

    // 6. --help documents 10 built-in Art Direction styles and --space=2d|2.5d|3d
    const helpOut = await captureConsoleOutput(async () => {
      await runCli(['--help']);
    });
    assert.match(helpOut, /10 built-in Art Direction styles/);
    assert.match(helpOut, /--space=2d\|2\.5d\|3d/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('ProjectPickerPopover renders [ Wszystkie ] [ 2D ] [ 2.5D ] [ 3D ] filter bar, space badges, and preserves custom style section', () => {
  const builtIns = BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]);
  const custom2D: StylePreset = {
    ...BUILT_IN_STYLES['editorial-press'],
    id: 'kronika-2d',
    name: 'Kronika 2D',
    preferredSpace: '2d',
    spaces: ['2d'],
  };
  const custom3D: StylePreset = {
    ...BUILT_IN_STYLES['soft-clay'],
    id: 'studio-glina',
    name: 'Studio Glina',
    preferredSpace: '3d',
    spaces: ['3d'],
  };

  const allMarkup = renderToStaticMarkup(
    React.createElement(ProjectPickerPopover, {
      isOpen: true,
      onClose: () => {},
      viewMode: 'styles',
      builtInStyles: builtIns,
      customStyles: [custom2D, custom3D],
      activeStyleId: 'soft-clay',
      onSelectStyle: () => {},
      onDuplicateStyle: () => {},
    })
  );

  assert.match(allMarkup, /data-space-filter="all"/);
  assert.match(allMarkup, /data-space-filter="2d"/);
  assert.match(allMarkup, /data-space-filter="2\.5d"/);
  assert.match(allMarkup, /data-space-filter="3d"/);
  assert.match(allMarkup, /Wszystkie/);
  assert.match(allMarkup, /Style wbudowane \(10\)/);
  assert.match(allMarkup, /data-style-space="2d"[^>]*>2D</);
  assert.match(allMarkup, /data-style-space="2\.5d"[^>]*>2\.5D</);
  assert.match(allMarkup, /data-style-space="3d"[^>]*>3D</);
  assert.match(allMarkup, /Twoje style \(styles\/\*\.style\.json\)/);
  assert.match(allMarkup, /\+ Duplikuj jako własny styl/);

  // Filtered to 3D: shows only 3D-compatible built-in & custom styles, while keeping custom styles section + duplicate CTA visible!
  const filtered3DMarkup = renderToStaticMarkup(
    React.createElement(ProjectPickerPopover, {
      isOpen: true,
      onClose: () => {},
      viewMode: 'styles',
      spaceFilter: '3d',
      builtInStyles: builtIns,
      customStyles: [custom2D],
      activeStyleId: 'soft-clay',
      onSelectStyle: () => {},
      onDuplicateStyle: () => {},
    })
  );

  assert.match(filtered3DMarkup, /Soft-Clay 3D/);
  assert.match(filtered3DMarkup, /Glass Studio/);
  assert.match(filtered3DMarkup, /Retro-PC/);
  assert.doesNotMatch(filtered3DMarkup, /Brutalist Poster/);
  assert.doesNotMatch(filtered3DMarkup, /Kronika 2D/);
  assert.match(filtered3DMarkup, /Twoje style \(styles\/\*\.style\.json\)/);
  assert.match(filtered3DMarkup, /\+ Duplikuj jako własny styl/);
});

test('StyleLabShowcase renders [ 2D ] [ 2.5D ] [ 3D ] space switcher and Isometric 3D soft-clay podcast studio preview with Clean Frame 0 and zero three imports', () => {
  assert.equal(resolveKitDimensionalSpace('isometric-3d'), '3d');
  assert.equal(resolveKitDimensionalSpace('paper-diorama-3d'), '2.5d');
  assert.equal(resolveKitDimensionalSpace('motion-diagrams-2d'), '2d');
  assert.equal(resolveKitDimensionalSpace('editorial-collage'), '2d');
  assert.equal(resolveKitDimensionalSpace('vector-scene-2d'), '2d');
  assert.equal(resolveKitDimensionalSpace('kinetic-typography'), '2d');
  assert.equal(resolveKitDimensionalSpace('data-storytelling'), '2d');

  assert.equal(defaultPreviewKitForSpace('2d'), 'motion-diagrams-2d');
  assert.equal(defaultPreviewKitForSpace('2.5d'), 'paper-diorama-3d');
  assert.equal(defaultPreviewKitForSpace('3d'), 'isometric-3d');

  const showcaseMarkup = renderToStaticMarkup(
    React.createElement(StyleLabShowcase, {
      activeStyle: BUILT_IN_STYLES['soft-clay'],
      activeKit: 'isometric-3d',
      onSelectKit: () => {},
      aspectRatio: '16:9',
      onChangeAspectRatio: () => {},
      overlays: {
        goldenSafeBox: false,
        ruleOfThirds: false,
        safeMargins: false,
      },
      onToggleOverlay: () => {},
    })
  );

  const spaceSwitcherIdx = showcaseMarkup.indexOf('mp-stylelab-space-switcher');
  const kitStripIdx = showcaseMarkup.indexOf('mp-stylelab-kit-strip');
  assert.ok(spaceSwitcherIdx > 0, 'Expected .mp-stylelab-space-switcher in top bar');
  assert.ok(
    spaceSwitcherIdx < kitStripIdx,
    'Expected [ 2D ] [ 2.5D ] [ 3D ] switcher right before .mp-stylelab-kit-strip'
  );
  assert.match(
    showcaseMarkup,
    /data-space-pill="3d"[^>]*aria-pressed="true"/
  );

  for (const styleId of ['soft-clay', 'glass-studio', 'retro-pc'] as const) {
    const preset = BUILT_IN_STYLES[styleId];
    const BoundPreview: React.FC = () =>
      React.createElement(StyleLabPreviewComposition, {
        style: preset,
        kit: 'isometric-3d',
      });

    // Clean Frame 0 check
    const frame0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: BoundPreview,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
        fps: STYLE_LAB_FPS,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(frame0, /ON AIR/);
    assert.doesNotMatch(frame0, /data-clay-avatar="true"/);
    assert.doesNotMatch(frame0, /data-lighting-rig=/);

    // Active frame 64 in 16:9 and 9:16
    for (const [w, h] of [
      [1920, 1080],
      [1080, 1920],
    ] as const) {
      const frame64 = renderToStaticMarkup(
        React.createElement(Thumbnail, {
          component: BoundPreview,
          compositionWidth: w,
          compositionHeight: h,
          durationInFrames: STYLE_LAB_DURATION_IN_FRAMES,
          fps: STYLE_LAB_FPS,
          frameToDisplay: 64,
        })
      );
      assert.match(frame64, /ON AIR/);
      assert.match(frame64, /data-on-air-badge="true"/);
      assert.match(frame64, /data-clay-avatar="true"/);
      assert.match(frame64, /data-clay-headphones="true"/);
      assert.match(frame64, /data-podcast-mics="true"/);
    }
  }

  // Strictly zero three / r3f imports in packages/studio
  for (const rel of [
    'packages/studio/src/client/components/StyleLabShowcase.tsx',
    'packages/studio/src/client/components/ProjectPickerPopover.tsx',
  ]) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(src, /from\s+['"]three['"]|@react-three\/fiber/);
    assert.doesNotMatch(src, /Math\.random\s*\(/);
  }
});

test('canonical skills document 2-axis DimensionalSpace × 10 styles, --space CLI flag, and natural mejk pikczers / retro pi si phonetics', () => {
  const styleSkill = fs.readFileSync(
    path.join(
      REPO_ROOT,
      'plugins/make-pictures/skills/style-and-art-direction/SKILL.md'
    ),
    'utf8'
  );
  assert.match(styleSkill, /DimensionalSpace/);
  assert.match(styleSkill, /retro-pc/);
  assert.match(styleSkill, /soft-clay/);
  assert.match(styleSkill, /glass-studio/);
  assert.match(styleSkill, /material3d/);

  const directorSkill = fs.readFileSync(
    path.join(
      REPO_ROOT,
      'plugins/make-pictures/skills/make-pictures-director/SKILL.md'
    ),
    'utf8'
  );
  assert.match(directorSkill, /--space=2d\|2\.5d\|3d/);

  const soundSkill = fs.readFileSync(
    path.join(
      REPO_ROOT,
      'plugins/make-pictures/skills/sound-and-music-design/SKILL.md'
    ),
    'utf8'
  );
  assert.match(soundSkill, /mejk pikczers/);
  assert.match(soundSkill, /make pictures/);
  assert.match(soundSkill, /retro pi si/);
  assert.match(soundSkill, /retro pee see/);
});
