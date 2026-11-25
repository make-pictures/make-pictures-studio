import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Converts a PascalCase/mixed composition ID into a kebab-case slug.
 * Example: `PaperDioramaDemo` -> `paper-diorama-demo`, `Tactile3DShowcase` -> `tactile-3d-showcase`.
 */
export function toKebabSlug(compId: string): string {
  return compId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function getNpxCommand(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

export function getNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

const SAFE_SHELL_TOKEN_RE = /^[A-Za-z0-9._/@:=-]+$/;

/**
 * Validates and safely quotes an argument before interpolating it into a shell command string.
 * Leaves benign path/flag tokens unquoted for readability while POSIX-quoting paths with spaces
 * or metacharacters and rejecting control characters / NUL bytes.
 */
export function shellQuoteArg(value: string, label = 'argument'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid empty ${label}.`);
  }
  if (/[\0\r\n]/.test(trimmed)) {
    throw new Error(`Invalid ${label}: control characters or newlines are not allowed.`);
  }
  if (SAFE_SHELL_TOKEN_RE.test(trimmed)) {
    return trimmed;
  }
  return `'${trimmed.replace(/'/g, `'\\''`)}'`;
}

/**
 * Rejects path traversal segments (`..`, `/`, `\`, NUL bytes, leading dots) for audio/asset IDs
 * that are interpolated into output filenames and subdirectories.
 */
export function assertSafeIdSegment(value: string, fieldName: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error(`Invalid ${fieldName}: expected a non-empty identifier.`);
  }
  if (
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('..') ||
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed.includes('\0') ||
    path.isAbsolute(trimmed)
  ) {
    throw new Error(
      `Unsafe ${fieldName} "${value}": path separators and traversal segments ("..", "/", "\\") are not allowed.`
    );
  }
  return trimmed;
}

/**
 * Shared compact 5x7 pixel font (`'1'` = ink, `'0'` = background) for zero-dependency
 * RGBA overlays in both `qa` contact sheets and `assets sheet` contact sheets.
 */
export const BITMAP_FONT_5X7: Readonly<Record<string, readonly string[]>> = {
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['10001', '10001', '10001', '11111', '00001', '00001', '00001'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  f: ['00110', '01000', '11110', '01000', '01000', '01000', '01000'],
  s: ['00000', '01111', '10000', '01110', '00001', '11110', '00000'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '/': ['00001', '00010', '00100', '00100', '01000', '10000', '00000'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01111'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  ',': ['00000', '00000', '00000', '00000', '00110', '00100', '01000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '•': ['00000', '00100', '01110', '01110', '00100', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

export function execFfmpegChecked(
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

export function decodeBitmapToRgbaViaFfmpeg(filePath: string): {
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

export function writeRgbaPngViaFfmpeg(
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
