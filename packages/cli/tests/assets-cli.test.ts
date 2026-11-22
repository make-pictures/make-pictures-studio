import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  cleanScanCornerArtifacts,
  computeAssetSheetGrid,
  runAssetsCleanScanCommand,
  runAssetsSheetCommand,
  sampleBorderPaperColor,
} from '../src/commands/assets';
import { runCli } from '../src/index';

function writeRawRgbaAsPng(
  outPath: string,
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-i',
      'pipe:0',
      '-frames:v',
      '1',
      outPath,
    ],
    {
      input: Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength),
      maxBuffer: 32 * 1024 * 1024,
    }
  );
}

function decodePngToRawRgba(filePath: string): {
  rgba: Buffer;
  width: number;
  height: number;
} {
  const pamBuf = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      filePath,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'pam',
      '-pix_fmt',
      'rgba',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const marker = Buffer.from('ENDHDR\n', 'ascii');
  const endIdx = pamBuf.indexOf(marker);
  assert.notEqual(endIdx, -1, `Expected valid PAM header for ${filePath}`);
  const header = pamBuf.subarray(0, endIdx).toString('ascii');
  const width = Number(header.match(/\bWIDTH\s+(\d+)/)?.[1] ?? 0);
  const height = Number(header.match(/\bHEIGHT\s+(\d+)/)?.[1] ?? 0);
  const rgba = pamBuf.subarray(endIdx + marker.length);
  return { rgba, width, height };
}

function makeSyntheticScanRgba(
  width: number,
  height: number,
  paperRgb: [number, number, number] = [244, 236, 220],
  cornerLegPx = 14
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const distX = Math.min(x, width - 1 - x);
      const distY = Math.min(y, height - 1 - y);
      const inDarkCornerTriangle = distX + distY < cornerLegPx;
      const inCenterInk = Math.abs(x - cx) <= 12 && Math.abs(y - cy) <= 12;

      if (inDarkCornerTriangle) {
        rgba[idx] = 10;
        rgba[idx + 1] = 10;
        rgba[idx + 2] = 10;
        rgba[idx + 3] = 255;
      } else if (inCenterInk) {
        rgba[idx] = 15;
        rgba[idx + 1] = 18;
        rgba[idx + 2] = 20;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = paperRgb[0];
        rgba[idx + 1] = paperRgb[1];
        rgba[idx + 2] = paperRgb[2];
        rgba[idx + 3] = 255;
      }
    }
  }
  return rgba;
}

test('sampleBorderPaperColor ignores dark corner artifacts and returns median warm cream paper color', () => {
  const width = 100;
  const height = 100;
  const rgba = makeSyntheticScanRgba(width, height, [244, 236, 220], 10);

  const sampled = sampleBorderPaperColor(rgba, width, height);
  assert.deepEqual(sampled, [244, 236, 220]);
});

test('cleanScanCornerArtifacts removes dark scanner triangles in all 4 corners while keeping center ink 100% untouched', () => {
  const width = 120;
  const height = 120;
  const src = makeSyntheticScanRgba(width, height, [244, 236, 220], 14);

  // 1. Zero-bleed clean with auto-sampled paper fill
  const cleaned = cleanScanCornerArtifacts(src, width, height, {
    bleedPct: 0,
    cornerRadiusPct: 14,
    darkThreshold: 75,
  });

  assert.equal(cleaned.width, width);
  assert.equal(cleaned.height, height);
  assert.deepEqual(cleaned.fillRgb, [244, 236, 220]);
  assert.ok(cleaned.cleanedPixels > 0, 'Expected corner artifact pixels to be cleaned');

  // Verify all 4 extreme corners are now bright paper color
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  for (const [x, y] of corners) {
    const idx = (y * width + x) * 4;
    assert.equal(cleaned.rgba[idx], 244, `Expected bright R at corner (${x},${y})`);
    assert.equal(cleaned.rgba[idx + 1], 236, `Expected bright G at corner (${x},${y})`);
    assert.equal(cleaned.rgba[idx + 2], 220, `Expected bright B at corner (${x},${y})`);
    assert.equal(cleaned.rgba[idx + 3], 255);
  }

  // Verify center dark ink emblem is 100% untouched
  const centerIdx = (60 * width + 60) * 4;
  assert.equal(cleaned.rgba[centerIdx], 15);
  assert.equal(cleaned.rgba[centerIdx + 1], 18);
  assert.equal(cleaned.rgba[centerIdx + 2], 20);
  assert.equal(cleaned.rgba[centerIdx + 3], 255);

  // 2. Symmetric bleedPct crop + explicit #FFF9EC fillColor
  const trimmed = cleanScanCornerArtifacts(src, width, height, {
    bleedPct: 2.5,
    cornerRadiusPct: 14,
    darkThreshold: 75,
    fillColor: '#FFF9EC',
  });
  // floor(120 * 0.025) = 3 px trimmed on each side => 114x114
  assert.equal(trimmed.width, 114);
  assert.equal(trimmed.height, 114);
  assert.deepEqual(trimmed.fillRgb, [255, 249, 236]);
  assert.ok(trimmed.cleanedPixels > 0);
  assert.equal(trimmed.rgba[0], 255);
  assert.equal(trimmed.rgba[1], 249);
  assert.equal(trimmed.rgba[2], 236);

  const trimmedCenterIdx = (57 * 114 + 57) * 4;
  assert.ok(trimmed.rgba[trimmedCenterIdx]! < 30, 'Center dark ink must remain dark after trim');

  // 3. Invalid fillColor or out-of-range options throw cleanly
  assert.throws(
    () => cleanScanCornerArtifacts(src, width, height, { fillColor: 'not-a-hex' }),
    /fillColor|hex/i
  );
  assert.throws(
    () => cleanScanCornerArtifacts(src, width, height, { bleedPct: 15 }),
    /bleed/i
  );
});

test('computeAssetSheetGrid returns exact cols, rows, and canvas dimensions for 1, 5, and 9 items', () => {
  const g1 = computeAssetSheetGrid(1);
  assert.deepEqual(g1, {
    cols: 1,
    rows: 1,
    canvasWidth: 420 + 16 * 2,
    canvasHeight: 44 + (300 + 32) + 16 * 2,
    headerHeight: 44,
    pad: 16,
  });

  const g5 = computeAssetSheetGrid(5);
  assert.deepEqual(g5, {
    cols: 4,
    rows: 2,
    canvasWidth: 4 * 420 + 5 * 16,
    canvasHeight: 44 + 2 * (300 + 32) + 3 * 16,
    headerHeight: 44,
    pad: 16,
  });

  const g9 = computeAssetSheetGrid(9);
  assert.deepEqual(g9, {
    cols: 4,
    rows: 3,
    canvasWidth: 4 * 420 + 5 * 16,
    canvasHeight: 44 + 3 * (300 + 32) + 4 * 16,
    headerHeight: 44,
    pad: 16,
  });

  // Clamps cols > 12 to 12
  const g20 = computeAssetSheetGrid(20, 99, 200, 150);
  assert.equal(g20.cols, 12);
  assert.equal(g20.rows, 2);
});

test('e2e: runAssetsCleanScanCommand, runAssetsSheetCommand, and CLI assets dispatch work in os.tmpdir()', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-assets-cli-'));
  try {
    const assetsDir = path.join(tmpDir, 'scans');
    fs.mkdirSync(assetsDir, { recursive: true });

    // 1. Write synthetic scan PNG with dark corners and dark center emblem
    const scanW = 120;
    const scanH = 100;
    const scanPath = path.join(assetsDir, 'archival-plate.png');
    writeRawRgbaAsPng(
      scanPath,
      makeSyntheticScanRgba(scanW, scanH, [242, 234, 218], 14),
      scanW,
      scanH
    );

    // 2. Write synthetic transparent PNG (transparent border + opaque center badge)
    const iconW = 80;
    const iconH = 80;
    const iconRgba = new Uint8ClampedArray(iconW * iconH * 4);
    for (let y = 20; y < 60; y++) {
      for (let x = 20; x < 60; x++) {
        const idx = (y * iconW + x) * 4;
        iconRgba[idx] = 14;
        iconRgba[idx + 1] = 165;
        iconRgba[idx + 2] = 233;
        iconRgba[idx + 3] = 255;
      }
    }
    const iconPath = path.join(assetsDir, 'transparent-emblem.png');
    writeRawRgbaAsPng(iconPath, iconRgba, iconW, iconH);

    // 3. Write a _qa-* file that MUST be skipped by `assets sheet`
    const ignoredQaPath = path.join(assetsDir, '_qa-previous-sheet.png');
    writeRawRgbaAsPng(ignoredQaPath, iconRgba, iconW, iconH);

    // Test runAssetsCleanScanCommand directly
    const cleanOutRel = 'cleaned/archival-plate-clean.png';
    const cleanRes = runAssetsCleanScanCommand({
      cwd: tmpDir,
      inputPath: scanPath,
      outPath: cleanOutRel,
      bleedPct: 2.0,
      cornerRadiusPct: 14,
      darkThreshold: 75,
    });
    assert.ok(fs.existsSync(cleanRes.outputPath), 'Expected cleaned scan PNG to exist');
    assert.ok(cleanRes.cleanedPixels > 0, 'Expected cleanedPixels > 0');

    const decodedClean = decodePngToRawRgba(cleanRes.outputPath);
    assert.equal(decodedClean.width, cleanRes.width);
    assert.equal(decodedClean.height, cleanRes.height);
    // Top-left corner is bright cream paper
    assert.ok(decodedClean.rgba[0]! > 225, `Expected bright top-left R, got ${decodedClean.rgba[0]}`);
    assert.ok(decodedClean.rgba[1]! > 215, `Expected bright top-left G, got ${decodedClean.rgba[1]}`);
    // Center ink pixel remains dark
    const midX = Math.floor(decodedClean.width / 2);
    const midY = Math.floor(decodedClean.height / 2);
    const midIdx = (midY * decodedClean.width + midX) * 4;
    assert.ok(
      decodedClean.rgba[midIdx]! < 30,
      `Expected dark center ink R < 30, got ${decodedClean.rgba[midIdx]}`
    );

    // Test runAssetsSheetCommand on scans/ directory
    const sheetRes = runAssetsSheetCommand({
      cwd: tmpDir,
      dirPath: 'scans',
      cols: 2,
      tileWidth: 240,
      tileHeight: 180,
    });
    assert.equal(sheetRes.itemCount, 2, 'Should include 2 real assets and skip _qa-* files');
    assert.deepEqual(sheetRes.files, ['archival-plate.png', 'transparent-emblem.png']);
    assert.ok(
      sheetRes.outputPath.endsWith('_qa-assets-contact-sheet.png'),
      `Expected default output filename, got ${sheetRes.outputPath}`
    );
    assert.ok(fs.existsSync(sheetRes.outputPath), 'Expected contact sheet PNG to exist');
    assert.ok(fs.statSync(sheetRes.outputPath).size > 0, 'Expected non-empty contact sheet PNG');

    const expectedGrid = computeAssetSheetGrid(2, 2, 240, 180);
    const decodedSheet = decodePngToRawRgba(sheetRes.outputPath);
    assert.equal(decodedSheet.width, expectedGrid.canvasWidth);
    assert.equal(decodedSheet.height, expectedGrid.canvasHeight);

    // Check dark checkerboard (#0F172A = [15,23,42] / #1E293B = [30,41,59]) inside transparent-emblem tile (col 1, row 0)
    const tile1X = expectedGrid.pad + 1 * (240 + expectedGrid.pad);
    const tile1Y = expectedGrid.headerHeight + expectedGrid.pad;
    const samplePxIdx = ((tile1Y + 4) * decodedSheet.width + (tile1X + 4)) * 4;
    const r = decodedSheet.rgba[samplePxIdx]!;
    const g = decodedSheet.rgba[samplePxIdx + 1]!;
    const b = decodedSheet.rgba[samplePxIdx + 2]!;
    const isCheckerA = r === 15 && g === 23 && b === 42;
    const isCheckerB = r === 30 && g === 41 && b === 59;
    assert.ok(
      isCheckerA || isCheckerB,
      `Expected dark slate checkerboard under transparent tile, got rgb(${r},${g},${b})`
    );

    // Test CLI dispatch via runCli for both `assets clean-scan` and `assets sheet`
    await runCli([
      'assets',
      'clean-scan',
      'scans/archival-plate.png',
      '--out=cleaned/cli-clean.png',
      '--bleed-pct=0',
      '--fill-color=#FFF8EB',
      `--cwd=${tmpDir}`,
    ]);
    assert.ok(fs.existsSync(path.join(tmpDir, 'cleaned', 'cli-clean.png')));

    await runCli([
      'assets',
      'sheet',
      'scans',
      '--out=out/custom-sheet.png',
      '--cols=2',
      `--cwd=${tmpDir}`,
    ]);
    assert.ok(fs.existsSync(path.join(tmpDir, 'out', 'custom-sheet.png')));

    await assert.rejects(
      () => runCli(['assets', 'unknown-sub', `--cwd=${tmpDir}`]),
      /Unknown assets subcommand/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
