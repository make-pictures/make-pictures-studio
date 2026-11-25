import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkspaceContext } from './workspace-paths';

export interface CleanScanOptions {
  bleedPct?: number;
  cornerRadiusPct?: number;
  darkThreshold?: number;
  fillColor?: string;
}

export interface CleanScanResult {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  cleanedPixels: number;
  fillRgb: [number, number, number];
}

export interface AssetsCleanScanCommandOptions extends CleanScanOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  inputPath: string;
  outPath: string;
}

export interface AssetsCleanScanCommandResult {
  outputPath: string;
  width: number;
  height: number;
  cleanedPixels: number;
  fillRgb: [number, number, number];
}

export interface AssetSheetGrid {
  cols: number;
  rows: number;
  canvasWidth: number;
  canvasHeight: number;
  headerHeight: number;
  pad: number;
}

export interface AssetsSheetCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  dirPath: string;
  outPath?: string;
  cols?: number;
  tileWidth?: number;
  tileHeight?: number;
}

export interface AssetsSheetCommandResult {
  outputPath: string;
  itemCount: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  files: string[];
}

const ASSET_SHEET_PAD = 16;
const ASSET_SHEET_LABEL_HEIGHT = 32;
const ASSET_SHEET_HEADER_HEIGHT = 44;
const ASSET_SHEET_MIN_TILE_PX = 64;
const ASSET_SHEET_MAX_TILE_PX = 2048;
const ASSET_SHEET_MAX_CANVAS_PIXELS = 64_000_000;
const SUPPORTED_IMAGE_EXT_RE = /\.(png|jpe?g|webp)$/i;

function execFfmpegChecked(
  args: string[],
  options: Parameters<typeof execFileSync>[2]
): Buffer {
  try {
    return execFileSync('ffmpeg', args, options) as Buffer;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      throw new Error(
        'FFmpeg binary not found on PATH.\nInstall FFmpeg and retry:\n  • macOS:   brew install ffmpeg\n  • Ubuntu:  sudo apt install ffmpeg\n  • Windows: winget install Gyan.FFmpeg'
      );
    }
    throw err;
  }
}

function decodeBitmapToRgbaViaFfmpeg(filePath: string): {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const pamBuf = execFfmpegChecked(
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
    { maxBuffer: 512 * 1024 * 1024 }
  );

  const endHdrMarker = Buffer.from('ENDHDR\n', 'ascii');
  const hdrEndIdx = pamBuf.indexOf(endHdrMarker);
  if (hdrEndIdx === -1) {
    throw new Error(`Failed to decode PAM header from image: ${filePath}`);
  }
  const headerText = pamBuf.subarray(0, hdrEndIdx).toString('ascii');
  const wMatch = headerText.match(/\bWIDTH\s+(\d+)/);
  const hMatch = headerText.match(/\bHEIGHT\s+(\d+)/);
  if (!wMatch || !hMatch) {
    throw new Error(`Invalid PAM dimensions while decoding: ${filePath}`);
  }
  const width = Number(wMatch[1]);
  const height = Number(hMatch[1]);
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `Invalid PAM dimensions (${width}x${height}) while decoding: ${filePath}`
    );
  }
  const pixelOffset = hdrEndIdx + endHdrMarker.length;
  const expectedBytes = width * height * 4;
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
    throw new Error(
      `Decoded image dimensions overflow RGBA buffer (${width}x${height}): ${filePath}`
    );
  }
  if (pamBuf.length < pixelOffset + expectedBytes) {
    throw new Error(`Truncated RGBA buffer decoded from: ${filePath}`);
  }
  const rgba = new Uint8ClampedArray(expectedBytes);
  rgba.set(pamBuf.subarray(pixelOffset, pixelOffset + expectedBytes));
  if (rgba.length < expectedBytes) {
    throw new Error(`Truncated RGBA buffer allocated for: ${filePath}`);
  }
  return { rgba, width, height };
}

function writeRgbaPngViaFfmpeg(
  outPath: string,
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  execFfmpegChecked(
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
      '-f',
      'image2',
      '-c:v',
      'png',
      outPath,
    ],
    {
      input: Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength),
      maxBuffer: 128 * 1024 * 1024,
    }
  );
}

function medianOfSorted(vals: number[]): number {
  if (vals.length === 0) return 248;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function rgbLuma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function parseHexRgb(hex: string): [number, number, number] {
  const trimmed = hex.trim();
  const match = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) {
    throw new Error(
      `Invalid fillColor hex "${hex}". Expected 6-digit hex color like "#F4ECDC".`
    );
  }
  const digits = match[1]!;
  return [
    parseInt(digits.slice(0, 2), 16),
    parseInt(digits.slice(2, 4), 16),
    parseInt(digits.slice(4, 6), 16),
  ];
}

/**
 * Samples pixels along a narrow interior border ring (skipping the outer 12% near
 * corners where scanner shadows live), prefers light paper pixels (`luma >= 90`),
 * and returns the channel-wise median `[R, G, B]`.
 */
export function sampleBorderPaperColor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): [number, number, number] {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    rgba.length < width * height * 4
  ) {
    return [248, 244, 236];
  }

  const minDim = Math.min(width, height);
  const maxInset = Math.max(0, Math.floor((minDim - 1) / 2));
  const inset = Math.min(maxInset, Math.max(2, Math.round(minDim * 0.015)));

  const xStart = Math.floor(width * 0.12);
  const xEnd = Math.max(xStart, Math.ceil(width * 0.88) - 1);
  const yStart = Math.floor(height * 0.12);
  const yEnd = Math.max(yStart, Math.ceil(height * 0.88) - 1);

  const brightR: number[] = [];
  const brightG: number[] = [];
  const brightB: number[] = [];
  const allR: number[] = [];
  const allG: number[] = [];
  const allB: number[] = [];

  const collect = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const a = rgba[idx + 3] ?? 255;
    if (a < 128) return;
    const r = rgba[idx] ?? 0;
    const g = rgba[idx + 1] ?? 0;
    const b = rgba[idx + 2] ?? 0;
    allR.push(r);
    allG.push(g);
    allB.push(b);
    if (rgbLuma(r, g, b) >= 90) {
      brightR.push(r);
      brightG.push(g);
      brightB.push(b);
    }
  };

  const topY = inset;
  const botY = Math.max(0, height - 1 - inset);
  for (let x = xStart; x <= xEnd; x++) {
    collect(x, topY);
    if (botY !== topY) collect(x, botY);
  }

  const leftX = inset;
  const rightX = Math.max(0, width - 1 - inset);
  for (let y = yStart; y <= yEnd; y++) {
    collect(leftX, y);
    if (rightX !== leftX) collect(rightX, y);
  }

  if (brightR.length > 0) {
    return [
      medianOfSorted(brightR),
      medianOfSorted(brightG),
      medianOfSorted(brightB),
    ];
  }
  if (allR.length > 0) {
    return [
      medianOfSorted(allR),
      medianOfSorted(allG),
      medianOfSorted(allB),
    ];
  }
  return [248, 244, 236];
}

/**
 * Removes dark scanner corner/rim artifacts via Exterior Perimeter BFS Flood-Fill
 * while keeping dark ink inside the center of the scan 100% untouched.
 */
export function cleanScanCornerArtifacts(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: CleanScanOptions = {}
): CleanScanResult {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `Invalid image dimensions (${String(width)}x${String(height)}). Expected positive finite integers.`
    );
  }
  const requiredBytes = width * height * 4;
  if (!Number.isSafeInteger(requiredBytes) || rgba.length < requiredBytes) {
    throw new Error(
      `RGBA buffer too short (${rgba.length} bytes) for ${width}x${height} image (expected at least ${requiredBytes} bytes).`
    );
  }

  const bleedPct = options.bleedPct ?? 2.0;
  const cornerRadiusPct = options.cornerRadiusPct ?? 8.0;
  const darkThreshold = options.darkThreshold ?? 75;

  if (!Number.isFinite(bleedPct) || bleedPct < 0 || bleedPct > 10) {
    throw new Error(
      `Invalid bleedPct "${String(options.bleedPct)}". Expected a number in [0, 10].`
    );
  }
  if (
    !Number.isFinite(cornerRadiusPct) ||
    cornerRadiusPct < 0 ||
    cornerRadiusPct > 25
  ) {
    throw new Error(
      `Invalid cornerRadiusPct "${String(options.cornerRadiusPct)}". Expected a number in [0, 25].`
    );
  }
  if (
    !Number.isFinite(darkThreshold) ||
    darkThreshold < 0 ||
    darkThreshold > 255
  ) {
    throw new Error(
      `Invalid darkThreshold "${String(options.darkThreshold)}". Expected a number in [0, 255].`
    );
  }

  const explicitFillRgb = options.fillColor
    ? parseHexRgb(options.fillColor)
    : undefined;

  let cropX = bleedPct > 0 ? Math.floor((width * bleedPct) / 100) : 0;
  let cropY = bleedPct > 0 ? Math.floor((height * bleedPct) / 100) : 0;
  if (width - cropX * 2 < 1) cropX = 0;
  if (height - cropY * 2 < 1) cropY = 0;

  const w = width - cropX * 2;
  const h = height - cropY * 2;
  const out = new Uint8ClampedArray(w * h * 4);

  if (cropX === 0 && cropY === 0) {
    out.set(rgba.subarray(0, w * h * 4));
  } else {
    for (let y = 0; y < h; y++) {
      const srcRowStart = ((y + cropY) * width + cropX) * 4;
      const dstRowStart = y * w * 4;
      out.set(rgba.subarray(srcRowStart, srcRowStart + w * 4), dstRowStart);
    }
  }

  const fillRgb = explicitFillRgb ?? sampleBorderPaperColor(out, w, h);

  if (cornerRadiusPct === 0 || w === 0 || h === 0) {
    return { rgba: out, width: w, height: h, cleanedPixels: 0, fillRgb };
  }

  const minDim = Math.min(w, h);
  const rawCornerZonePx = Math.round(minDim * (cornerRadiusPct / 100));
  const cornerZonePx =
    minDim < 16
      ? Math.min(Math.floor(minDim / 3), Math.max(1, rawCornerZonePx))
      : Math.max(4, rawCornerZonePx);
  if (cornerZonePx <= 0) {
    return { rgba: out, width: w, height: h, cleanedPixels: 0, fillRgb };
  }
  const cornerZoneSq = cornerZonePx * cornerZonePx;
  const rimPx =
    minDim < 16
      ? Math.min(
          Math.floor(minDim / 4),
          Math.max(1, Math.round(cornerZonePx * 0.25))
        )
      : Math.max(2, Math.round(cornerZonePx * 0.25));

  const inCornerOrRimZone = (x: number, y: number): boolean => {
    const dx = Math.min(x, w - 1 - x);
    const dy = Math.min(y, h - 1 - y);
    if (dx < rimPx || dy < rimPx) return true;
    return dx * dx + dy * dy <= cornerZoneSq;
  };

  const lumaAt = (pos: number): number => {
    const idx = pos * 4;
    return rgbLuma(out[idx]!, out[idx + 1]!, out[idx + 2]!);
  };

  const total = w * h;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (x: number, y: number) => {
    if (!inCornerOrRimZone(x, y)) return;
    const pos = y * w + x;
    if (visited[pos]) return;
    if (out[pos * 4 + 3]! < 128) return;
    if (lumaAt(pos) <= darkThreshold) {
      visited[pos] = 1;
      queue[tail++] = pos;
    }
  };

  // Seed strictly from outer perimeter pixels
  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    if (h > 1) trySeed(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    trySeed(0, y);
    if (w > 1) trySeed(w - 1, y);
  }

  let cleanedPixels = 0;
  while (head < tail) {
    const pos = queue[head++]!;
    cleanedPixels += 1;
    const x = pos % w;
    const y = (pos - x) / w;

    if (x > 0) trySeed(x - 1, y);
    if (x + 1 < w) trySeed(x + 1, y);
    if (y > 0) trySeed(x, y - 1);
    if (y + 1 < h) trySeed(x, y + 1);
  }

  // Replace flooded artifact pixels with sampled/explicit opaque paper fill
  for (let pos = 0; pos < total; pos++) {
    if (!visited[pos]) continue;
    const idx = pos * 4;
    out[idx] = fillRgb[0];
    out[idx + 1] = fillRgb[1];
    out[idx + 2] = fillRgb[2];
    out[idx + 3] = 255;
  }

  // 1-px soft boundary anti-alias blend (50%) for immediate dark-ish rim neighbors
  const softLimit = darkThreshold + 35;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pos = y * w + x;
      if (visited[pos]) continue;
      if (!inCornerOrRimZone(x, y)) continue;
      const touchesArtifact =
        (x > 0 && visited[pos - 1]) ||
        (x + 1 < w && visited[pos + 1]) ||
        (y > 0 && visited[pos - w]) ||
        (y + 1 < h && visited[pos + w]);
      if (!touchesArtifact) continue;

      const idx = pos * 4;
      if (out[idx + 3]! < 128) continue;
      if (lumaAt(pos) <= softLimit) {
        out[idx] = Math.round((out[idx]! + fillRgb[0]) * 0.5);
        out[idx + 1] = Math.round((out[idx + 1]! + fillRgb[1]) * 0.5);
        out[idx + 2] = Math.round((out[idx + 2]! + fillRgb[2]) * 0.5);
      }
    }
  }

  return {
    rgba: out,
    width: w,
    height: h,
    cleanedPixels,
    fillRgb,
  };
}

export function runAssetsCleanScanCommand(
  options: AssetsCleanScanCommandOptions
): AssetsCleanScanCommandResult {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const baseDir = options.dir?.trim() ? studioDir : rootDir;

  const resolvedInput = path.resolve(baseDir, options.inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(
      `Scan source file not found: ${path.relative(baseDir, resolvedInput) || options.inputPath}`
    );
  }
  if (!fs.statSync(resolvedInput).isFile()) {
    throw new Error(
      `Scan source path is not a file: ${path.relative(baseDir, resolvedInput) || options.inputPath}`
    );
  }

  const resolvedOut = path.resolve(baseDir, options.outPath);
  const decoded = decodeBitmapToRgbaViaFfmpeg(resolvedInput);
  const cleaned = cleanScanCornerArtifacts(
    decoded.rgba,
    decoded.width,
    decoded.height,
    {
      bleedPct: options.bleedPct,
      cornerRadiusPct: options.cornerRadiusPct,
      darkThreshold: options.darkThreshold,
      fillColor: options.fillColor,
    }
  );

  writeRgbaPngViaFfmpeg(resolvedOut, cleaned.rgba, cleaned.width, cleaned.height);

  const hexFill = `#${cleaned.fillRgb
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
  console.log(
    `✅ Cleaned scan (${cleaned.width}x${cleaned.height}, ${cleaned.cleanedPixels} artifact px filled with ${hexFill}): ${path.relative(rootDir, resolvedOut)}`
  );

  return {
    outputPath: resolvedOut,
    width: cleaned.width,
    height: cleaned.height,
    cleanedPixels: cleaned.cleanedPixels,
    fillRgb: cleaned.fillRgb,
  };
}

export function computeAssetSheetGrid(
  itemCount: number,
  cols = 4,
  tileWidth = 420,
  tileHeight = 300
): AssetSheetGrid {
  if (!Number.isFinite(itemCount) || itemCount < 0) {
    throw new Error(
      `Invalid itemCount "${String(itemCount)}". Expected a non-negative finite number.`
    );
  }
  if (!Number.isFinite(cols) || cols < 1) {
    throw new Error(
      `Invalid cols "${String(cols)}". Expected a finite number >= 1.`
    );
  }
  if (
    !Number.isFinite(tileWidth) ||
    tileWidth < ASSET_SHEET_MIN_TILE_PX ||
    tileWidth > ASSET_SHEET_MAX_TILE_PX
  ) {
    throw new Error(
      `Invalid tileWidth "${String(tileWidth)}". Expected a finite number in [${ASSET_SHEET_MIN_TILE_PX}, ${ASSET_SHEET_MAX_TILE_PX}].`
    );
  }
  if (
    !Number.isFinite(tileHeight) ||
    tileHeight < ASSET_SHEET_MIN_TILE_PX ||
    tileHeight > ASSET_SHEET_MAX_TILE_PX
  ) {
    throw new Error(
      `Invalid tileHeight "${String(tileHeight)}". Expected a finite number in [${ASSET_SHEET_MIN_TILE_PX}, ${ASSET_SHEET_MAX_TILE_PX}].`
    );
  }

  const safeCount = Math.floor(itemCount);
  const requestedCols = Math.round(cols);
  const maxCols = Math.min(12, Math.max(1, safeCount));
  const clampedCols = Math.max(1, Math.min(maxCols, requestedCols));
  const rows = safeCount === 0 ? 1 : Math.ceil(safeCount / clampedCols);
  const safeTileW = Math.round(tileWidth);
  const safeTileH = Math.round(tileHeight);

  const pad = ASSET_SHEET_PAD;
  const headerHeight = ASSET_SHEET_HEADER_HEIGHT;
  const labelHeight = ASSET_SHEET_LABEL_HEIGHT;

  const canvasWidth = clampedCols * safeTileW + (clampedCols + 1) * pad;
  const canvasHeight =
    headerHeight + rows * (safeTileH + labelHeight) + (rows + 1) * pad;

  const totalPixels = canvasWidth * canvasHeight;
  if (
    !Number.isSafeInteger(totalPixels) ||
    totalPixels > ASSET_SHEET_MAX_CANVAS_PIXELS
  ) {
    throw new Error(
      `Asset contact sheet canvas (${canvasWidth}x${canvasHeight} = ${totalPixels} px) exceeds maximum allowed ${ASSET_SHEET_MAX_CANVAS_PIXELS} pixels. Reduce --tile-width/--tile-height or split the directory.`
    );
  }

  return {
    cols: clampedCols,
    rows,
    canvasWidth,
    canvasHeight,
    headerHeight,
    pad,
  };
}

// Built-in 5x7 uppercase bitmap font (zero external font / ffmpeg drawtext dependency)
const BITMAP_FONT_5X7: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['#...#', '#...#', '#...#', '#####', '....#', '....#', '....#'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '####.', '#...#', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '..#..', '.#...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
};

function fillRectRgba(
  canvas: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  color: [number, number, number]
): void {
  const sx = Math.max(0, x0);
  const sy = Math.max(0, y0);
  const ex = Math.min(canvasW, x0 + w);
  const ey = Math.min(canvasH, y0 + h);
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      const idx = (y * canvasW + x) * 4;
      canvas[idx] = color[0];
      canvas[idx + 1] = color[1];
      canvas[idx + 2] = color[2];
      canvas[idx + 3] = 255;
    }
  }
}

export function normalizeBitmapLabelText(text: string): string {
  return text
    .replace(/[łŁ]/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function drawBitmapText5x7(
  canvas: Uint8ClampedArray,
  canvasW: number,
  canvasH: number,
  text: string,
  startX: number,
  startY: number,
  scale: number,
  color: [number, number, number],
  maxWidthPx: number
): void {
  const charAdvance = 6 * scale;
  const maxChars = Math.max(1, Math.floor(maxWidthPx / charAdvance));
  const upper = normalizeBitmapLabelText(text);
  const display =
    upper.length <= maxChars
      ? upper
      : maxChars > 3
        ? `${upper.slice(0, maxChars - 3)}...`
        : upper.slice(0, maxChars);

  let cursorX = startX;
  for (let cIdx = 0; cIdx < display.length; cIdx++) {
    const ch = display[cIdx]!;
    const glyph = BITMAP_FONT_5X7[ch] ?? BITMAP_FONT_5X7['?']!;
    for (let gy = 0; gy < 7; gy++) {
      const row = glyph[gy]!;
      for (let gx = 0; gx < 5; gx++) {
        if (row[gx] !== '#') continue;
        fillRectRgba(
          canvas,
          canvasW,
          canvasH,
          cursorX + gx * scale,
          startY + gy * scale,
          scale,
          scale,
          color
        );
      }
    }
    cursorX += charAdvance;
  }
}

function drawCheckerboardTile(
  canvas: Uint8ClampedArray,
  canvasW: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  checkerSize = 12
): void {
  const darkA: [number, number, number] = [15, 23, 42]; // #0F172A
  const darkB: [number, number, number] = [30, 41, 59]; // #1E293B
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color =
        (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0
          ? darkA
          : darkB;
      const idx = ((y0 + y) * canvasW + (x0 + x)) * 4;
      canvas[idx] = color[0];
      canvas[idx + 1] = color[1];
      canvas[idx + 2] = color[2];
      canvas[idx + 3] = 255;
    }
  }
}

export function compositeLetterboxedImage(
  canvas: Uint8ClampedArray,
  canvasW: number,
  tileX: number,
  tileY: number,
  tileW: number,
  tileH: number,
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number
): void {
  if (srcW <= 0 || srcH <= 0) return;
  const scale = Math.min(tileW / srcW, tileH / srcH);
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));
  const offX = tileX + Math.floor((tileW - dstW) / 2);
  const offY = tileY + Math.floor((tileH - dstH) / 2);

  for (let dy = 0; dy < dstH; dy++) {
    const syFloat = ((dy + 0.5) / dstH) * srcH - 0.5;
    const sy0 = Math.max(0, Math.min(srcH - 1, Math.floor(syFloat)));
    const sy1 = Math.max(0, Math.min(srcH - 1, sy0 + 1));
    const ty = Math.max(0, Math.min(1, syFloat - sy0));

    for (let dx = 0; dx < dstW; dx++) {
      const sxFloat = ((dx + 0.5) / dstW) * srcW - 0.5;
      const sx0 = Math.max(0, Math.min(srcW - 1, Math.floor(sxFloat)));
      const sx1 = Math.max(0, Math.min(srcW - 1, sx0 + 1));
      const tx = Math.max(0, Math.min(1, sxFloat - sx0));

      const i00 = (sy0 * srcW + sx0) * 4;
      const i10 = (sy0 * srcW + sx1) * 4;
      const i01 = (sy1 * srcW + sx0) * 4;
      const i11 = (sy1 * srcW + sx1) * 4;

      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;

      // Premultiplied-alpha bilinear interpolation to prevent dark fringe halos
      // along transparent cutout edges (e.g. opaque white adjacent to (0,0,0,0)).
      const wa00 = w00 * (src[i00 + 3]! / 255);
      const wa10 = w10 * (src[i10 + 3]! / 255);
      const wa01 = w01 * (src[i01 + 3]! / 255);
      const wa11 = w11 * (src[i11 + 3]! / 255);

      const a = wa00 + wa10 + wa01 + wa11;
      const premulR =
        src[i00]! * wa00 +
        src[i10]! * wa10 +
        src[i01]! * wa01 +
        src[i11]! * wa11;
      const premulG =
        src[i00 + 1]! * wa00 +
        src[i10 + 1]! * wa10 +
        src[i01 + 1]! * wa01 +
        src[i11 + 1]! * wa11;
      const premulB =
        src[i00 + 2]! * wa00 +
        src[i10 + 2]! * wa10 +
        src[i01 + 2]! * wa01 +
        src[i11 + 2]! * wa11;

      const dstIdx = ((offY + dy) * canvasW + (offX + dx)) * 4;
      const invA = 1 - a;
      canvas[dstIdx] = Math.round(premulR + canvas[dstIdx]! * invA);
      canvas[dstIdx + 1] = Math.round(premulG + canvas[dstIdx + 1]! * invA);
      canvas[dstIdx + 2] = Math.round(premulB + canvas[dstIdx + 2]! * invA);
      canvas[dstIdx + 3] = 255;
    }
  }
}

export function runAssetsSheetCommand(
  options: AssetsSheetCommandOptions
): AssetsSheetCommandResult {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const baseDir = options.dir?.trim() ? studioDir : rootDir;

  const resolvedDir = path.resolve(baseDir, options.dirPath);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    throw new Error(
      `Assets directory not found: ${path.relative(baseDir, resolvedDir) || options.dirPath}`
    );
  }

  const resolvedOut = options.outPath
    ? path.resolve(baseDir, options.outPath)
    : path.join(resolvedDir, '_qa-assets-contact-sheet.png');

  const files = fs
    .readdirSync(resolvedDir, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isFile()) return false;
      if (!SUPPORTED_IMAGE_EXT_RE.test(entry.name)) return false;
      if (/^_qa-/i.test(entry.name)) return false;
      if (path.resolve(resolvedDir, entry.name) === path.resolve(resolvedOut)) {
        return false;
      }
      return true;
    })
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    throw new Error(
      `No image assets (.png, .jpg, .jpeg, .webp) found in: ${path.relative(baseDir, resolvedDir) || '.'}`
    );
  }

  const rawTileWidth = options.tileWidth ?? 420;
  const rawTileHeight = options.tileHeight ?? 300;
  const grid = computeAssetSheetGrid(
    files.length,
    options.cols ?? 4,
    rawTileWidth,
    rawTileHeight
  );
  const tileWidth = Math.round(rawTileWidth);
  const tileHeight = Math.round(rawTileHeight);

  const canvas = new Uint8ClampedArray(grid.canvasWidth * grid.canvasHeight * 4);
  // Dark slate backdrop (#0B1120)
  fillRectRgba(
    canvas,
    grid.canvasWidth,
    grid.canvasHeight,
    0,
    0,
    grid.canvasWidth,
    grid.canvasHeight,
    [11, 17, 32]
  );

  // Header bar (#111827) + divider (#334155)
  fillRectRgba(
    canvas,
    grid.canvasWidth,
    grid.canvasHeight,
    0,
    0,
    grid.canvasWidth,
    grid.headerHeight,
    [17, 24, 39]
  );
  fillRectRgba(
    canvas,
    grid.canvasWidth,
    grid.canvasHeight,
    0,
    grid.headerHeight - 1,
    grid.canvasWidth,
    1,
    [51, 65, 85]
  );

  const headerTitle = `ASSETS QA SHEET | ${files.length} FILES | ${grid.cols}X${grid.rows}`;
  drawBitmapText5x7(
    canvas,
    grid.canvasWidth,
    grid.canvasHeight,
    headerTitle,
    grid.pad,
    Math.floor((grid.headerHeight - 14) / 2),
    2,
    [226, 232, 240],
    grid.canvasWidth - grid.pad * 2
  );

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]!;
    const fullPath = path.join(resolvedDir, fileName);
    let decoded: { rgba: Uint8ClampedArray; width: number; height: number };
    try {
      decoded = decodeBitmapToRgbaViaFfmpeg(fullPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to decode asset "${fileName}": ${msg}`);
    }

    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    const tileX = grid.pad + col * (tileWidth + grid.pad);
    const tileY =
      grid.headerHeight +
      grid.pad +
      row * (tileHeight + ASSET_SHEET_LABEL_HEIGHT + grid.pad);

    // Subtle 1px tile frame (#334155)
    fillRectRgba(
      canvas,
      grid.canvasWidth,
      grid.canvasHeight,
      tileX - 1,
      tileY - 1,
      tileWidth + 2,
      tileHeight + ASSET_SHEET_LABEL_HEIGHT + 2,
      [51, 65, 85]
    );

    // Dark checkerboard under image area so transparency defects stand out immediately
    drawCheckerboardTile(
      canvas,
      grid.canvasWidth,
      tileX,
      tileY,
      tileWidth,
      tileHeight,
      12
    );

    // Proportional letterbox composite
    compositeLetterboxedImage(
      canvas,
      grid.canvasWidth,
      tileX,
      tileY,
      tileWidth,
      tileHeight,
      decoded.rgba,
      decoded.width,
      decoded.height
    );

    // Tile footer bar (#111827) + 5x7 bitmap filename & resolution label
    fillRectRgba(
      canvas,
      grid.canvasWidth,
      grid.canvasHeight,
      tileX,
      tileY + tileHeight,
      tileWidth,
      ASSET_SHEET_LABEL_HEIGHT,
      [17, 24, 39]
    );

    const label = `${fileName} (${decoded.width}x${decoded.height})`;
    const textScale = tileWidth >= 260 ? 2 : 1;
    const textH = 7 * textScale;
    drawBitmapText5x7(
      canvas,
      grid.canvasWidth,
      grid.canvasHeight,
      label,
      tileX + 8,
      tileY + tileHeight + Math.floor((ASSET_SHEET_LABEL_HEIGHT - textH) / 2),
      textScale,
      [226, 232, 240],
      tileWidth - 16
    );
  }

  writeRgbaPngViaFfmpeg(resolvedOut, canvas, grid.canvasWidth, grid.canvasHeight);

  console.log(
    `🔍 Assets QA contact sheet (${files.length} files, ${grid.cols}x${grid.rows}, ${grid.canvasWidth}x${grid.canvasHeight}): ${path.relative(rootDir, resolvedOut)}`
  );

  return {
    outputPath: resolvedOut,
    itemCount: files.length,
    cols: grid.cols,
    rows: grid.rows,
    width: grid.canvasWidth,
    height: grid.canvasHeight,
    files,
  };
}
