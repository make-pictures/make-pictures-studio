import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BUILT_IN_STYLES,
  StylePresetSchema,
  type StylePreset,
} from '@make-pictures/remotion/style/presets';
import {
  defaultKitAndStyleForSpace,
  runNewProductionCommand,
} from '../src/commands/new-production';
import { runStylesListCommand } from '../src/commands/styles';
import { runCli } from '../src/index';

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

test('defaultKitAndStyleForSpace, runNewProductionCommand, and runCli wire --space=2d|2.5d|3d on new and validate invalid --space', async () => {
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
    const clayTsx = fs.readFileSync(
      path.join(clayProd.productionDir, 'ClayDemo.tsx'),
      'utf8'
    );
    assert.match(clayTsx, /"styleId": "soft-clay"/);

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
    const cutoutTsx = fs.readFileSync(
      path.join(cutoutProd.productionDir, 'ApolloCutout.tsx'),
      'utf8'
    );
    assert.match(cutoutTsx, /"styleId": "tactile-craft"/);

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
      path.join(tmpDir, 'src', 'videos', 'retro-net', 'index.ts'),
      'utf8'
    );
    assert.match(retroIndex, /kit: 'motion-diagrams-2d'/);
    const retroTsx = fs.readFileSync(
      path.join(tmpDir, 'src', 'videos', 'retro-net', 'RetroNet.tsx'),
      'utf8'
    );
    assert.match(retroTsx, /"styleId": "retro-pc"/);

    // 4. Invalid --space values fail fast with a helpful validation message
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

    // 5. --help documents v3.0 commands, 10 built-in Art Direction styles, --space=2d|2.5d|3d, and elements build
    const helpOut = await captureConsoleOutput(async () => {
      await runCli(['--help']);
    });
    assert.match(helpOut, /10 built-in Art Direction styles/);
    assert.match(helpOut, /--space=2d\|2\.5d\|3d/);
    assert.match(helpOut, /elements build/);
    assert.doesNotMatch(helpOut, /Studio Web|\.props\.json/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
