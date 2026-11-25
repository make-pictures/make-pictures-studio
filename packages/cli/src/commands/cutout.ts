import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { resolveWorkspaceContext } from './workspace-paths';

export interface InteriorAlphaHoleReport {
  hasInteriorHoles: boolean;
  holeCount: number;
  holePixelCount: number;
}

export interface CutoutCommandOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  inputPath: string;
  outPath: string;
  qaOutPath?: string;
  page?: number;
  tolerance?: number;
  softRamp?: number;
}

export interface CutoutCommandResult {
  outputPath: string;
  qaSheetPath: string;
  width: number;
  height: number;
  usedNativeSmask: boolean;
  holeReport: InteriorAlphaHoleReport;
}

function medianOfSorted(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function estimateCornerBackgroundRgb(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): [number, number, number] {
  const coords: Array<[number, number]> = [
    [0, 0],
    [Math.max(0, width - 1), 0],
    [0, Math.max(0, height - 1)],
    [Math.max(0, width - 1), Math.max(0, height - 1)],
  ];
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const [x, y] of coords) {
    const idx = (y * width + x) * 4;
    rs.push(rgba[idx] ?? 255);
    gs.push(rgba[idx + 1] ?? 255);
    bs.push(rgba[idx + 2] ?? 255);
  }
  return [medianOfSorted(rs), medianOfSorted(gs), medianOfSorted(bs)];
}

/**
 * Exterior Border Flood-Fill: removes exterior background starting strictly from the outer
 * frame perimeter (`x === 0 || x === W - 1 || y === 0 || y === H - 1`) so 100% of bright/white
 * pixels inside closed product silhouettes retain full `alpha = 255`.
 */
export function removeExteriorLightBackground(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  bgColor: [number, number, number],
  tolerance = 18,
  softRamp = 10
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const colorDist = (idx4: number): number => {
    const dr = out[idx4]! - bgColor[0];
    const dg = out[idx4 + 1]! - bgColor[1];
    const db = out[idx4 + 2]! - bgColor[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const tryEnqueue = (x: number, y: number) => {
    const pos = y * width + x;
    if (visited[pos]) return;
    const dist = colorDist(pos * 4);
    if (dist <= tolerance) {
      visited[pos] = 1;
      queue[tail++] = pos;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    if (height > 1) {
      tryEnqueue(x, height - 1);
    }
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    if (width > 1) {
      tryEnqueue(width - 1, y);
    }
  }

  while (head < tail) {
    const pos = queue[head++]!;
    out[pos * 4 + 3] = 0;
    const x = pos % width;
    const y = (pos - x) / width;

    if (x > 0) tryEnqueue(x - 1, y);
    if (x + 1 < width) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y + 1 < height) tryEnqueue(x, y + 1);
  }

  if (softRamp > 0) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pos = y * width + x;
        if (visited[pos]) continue;
        const touchesExterior =
          (x > 0 && visited[pos - 1]) ||
          (x + 1 < width && visited[pos + 1]) ||
          (y > 0 && visited[pos - width]) ||
          (y + 1 < height && visited[pos + width]);
        if (!touchesExterior) continue;
        const idx4 = pos * 4;
        const dist = colorDist(idx4);
        if (dist < tolerance + softRamp) {
          const factor = Math.max(0, Math.min(1, (dist - tolerance) / softRamp));
          const safeDiv = Math.max(0.08, factor);
          // Unmix background color from anti-aliased boundary pixels to prevent bright halos on dark backdrops
          out[idx4] = Math.round(
            Math.max(0, Math.min(255, (out[idx4]! - (1 - factor) * bgColor[0]) / safeDiv))
          );
          out[idx4 + 1] = Math.round(
            Math.max(0, Math.min(255, (out[idx4 + 1]! - (1 - factor) * bgColor[1]) / safeDiv))
          );
          out[idx4 + 2] = Math.round(
            Math.max(0, Math.min(255, (out[idx4 + 2]! - (1 - factor) * bgColor[2]) / safeDiv))
          );
          out[idx4 + 3] = Math.round(out[idx4 + 3]! * factor);
        }
      }
    }
  }

  return out;
}

/**
 * Detects isolated `alpha < 250` islands inside the object's opaque bounding box
 * that are NOT 4-connected to the outer frame border (catching accidental global white thresholding).
 */
export function detectInteriorAlphaHoles(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): InteriorAlphaHoleReport {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3]! >= 250) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { hasInteriorHoles: false, holeCount: 0, holePixelCount: 0 };
  }

  const total = width * height;
  const exteriorNonOpaque = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isNonOpaque = (pos: number) => rgba[pos * 4 + 3]! < 250;
  const seed = (x: number, y: number) => {
    const pos = y * width + x;
    if (!exteriorNonOpaque[pos] && isNonOpaque(pos)) {
      exteriorNonOpaque[pos] = 1;
      queue[tail++] = pos;
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x, 0);
    if (height > 1) seed(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    seed(0, y);
    if (width > 1) seed(width - 1, y);
  }

  while (head < tail) {
    const pos = queue[head++]!;
    const x = pos % width;
    const y = (pos - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x + 1 < width) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y + 1 < height) seed(x, y + 1);
  }

  const seenHole = new Uint8Array(total);
  let holeCount = 0;
  let holePixelCount = 0;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const startPos = y * width + x;
      if (
        !isNonOpaque(startPos) ||
        exteriorNonOpaque[startPos] ||
        seenHole[startPos]
      ) {
        continue;
      }

      holeCount += 1;
      head = 0;
      tail = 0;
      seenHole[startPos] = 1;
      queue[tail++] = startPos;

      while (head < tail) {
        const pos = queue[head++]!;
        holePixelCount += 1;
        const cx = pos % width;
        const cy = (pos - cx) / width;

        const neighbors: Array<[number, number]> = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nPos = ny * width + nx;
          if (
            isNonOpaque(nPos) &&
            !exteriorNonOpaque[nPos] &&
            !seenHole[nPos]
          ) {
            seenHole[nPos] = 1;
            queue[tail++] = nPos;
          }
        }
      }
    }
  }

  return {
    hasInteriorHoles: holeCount > 0,
    holeCount,
    holePixelCount,
  };
}

/**
 * Composites RGBA cutout over a dark slate checkerboard (`#0F172A` / `#1E293B`)
 * with crisp guide lines so any interior alpha hole or white halo is immediately visible.
 */
export function renderDarkCheckerboardRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  tileSize = 24
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const darkA: [number, number, number] = [15, 23, 42]; // #0F172A
  const darkB: [number, number, number] = [30, 41, 59]; // #1E293B
  const gridAccent: [number, number, number] = [14, 165, 233]; // #0EA5E9 guide lines

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isGridLine = x % (tileSize * 4) === 0 || y % (tileSize * 4) === 0;
      const checker =
        (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0
          ? darkA
          : darkB;
      const bg = isGridLine
        ? [
            Math.round(checker[0] * 0.72 + gridAccent[0] * 0.28),
            Math.round(checker[1] * 0.72 + gridAccent[1] * 0.28),
            Math.round(checker[2] * 0.72 + gridAccent[2] * 0.28),
          ]
        : checker;

      const a = rgba[idx + 3]! / 255;
      out[idx] = Math.round(rgba[idx]! * a + bg[0]! * (1 - a));
      out[idx + 1] = Math.round(rgba[idx + 1]! * a + bg[1]! * (1 - a));
      out[idx + 2] = Math.round(rgba[idx + 2]! * a + bg[2]! * (1 - a));
      out[idx + 3] = 255;
    }
  }
  return out;
}

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
    { maxBuffer: 128 * 1024 * 1024 }
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
  const pixelOffset = hdrEndIdx + endHdrMarker.length;
  const expectedBytes = width * height * 4;
  if (pamBuf.length < pixelOffset + expectedBytes) {
    throw new Error(`Truncated RGBA buffer decoded from: ${filePath}`);
  }
  const rgba = new Uint8ClampedArray(expectedBytes);
  rgba.set(pamBuf.subarray(pixelOffset, pixelOffset + expectedBytes));
  return { rgba, width, height };
}

function writeRgbaPngViaFfmpeg(
  outPath: string,
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): void {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const header = Buffer.from(
    `P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`,
    'ascii'
  );
  const pamPayload = Buffer.concat([
    header,
    Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength),
  ]);
  execFfmpegChecked(
    [
      '-v',
      'error',
      '-y',
      '-f',
      'pam_pipe',
      '-i',
      'pipe:0',
      '-frames:v',
      '1',
      outPath,
    ],
    { input: pamPayload, maxBuffer: 64 * 1024 * 1024 }
  );
}

interface ParsedPdfObject {
  id: number;
  dictText: string;
  stream?: Buffer;
}

function parsePdfObjects(pdfBuffer: Buffer): Map<number, ParsedPdfObject> {
  const rawLatin1 = pdfBuffer.toString('latin1');
  const objects = new Map<number, ParsedPdfObject>();
  const objHeaderRe = /(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj\b/g;
  let match: RegExpExecArray | null;

  while ((match = objHeaderRe.exec(rawLatin1)) !== null) {
    const id = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const endObjIdx = rawLatin1.indexOf('endobj', bodyStart);
    if (endObjIdx === -1) continue;

    const sliceText = rawLatin1.slice(bodyStart, endObjIdx);
    objHeaderRe.lastIndex = endObjIdx + 6;
    const streamKeywordMatch = /\bstream(?:\r\n|\n)/.exec(sliceText);
    if (!streamKeywordMatch) {
      objects.set(id, { id, dictText: sliceText });
      continue;
    }

    const dictText = sliceText.slice(0, streamKeywordMatch.index);
    const streamDataStart =
      bodyStart + streamKeywordMatch.index + streamKeywordMatch[0].length;

    const lenMatch = dictText.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
    let streamDataEnd = -1;
    if (lenMatch) {
      const explicitLen = Number(lenMatch[1]);
      if (streamDataStart + explicitLen <= endObjIdx) {
        streamDataEnd = streamDataStart + explicitLen;
      }
    }
    if (streamDataEnd === -1) {
      const endStreamIdx = rawLatin1.lastIndexOf('endstream', endObjIdx);
      if (endStreamIdx > streamDataStart) {
        streamDataEnd = endStreamIdx;
        if (
          rawLatin1[streamDataEnd - 2] === '\r' &&
          rawLatin1[streamDataEnd - 1] === '\n'
        ) {
          streamDataEnd -= 2;
        } else if (
          rawLatin1[streamDataEnd - 1] === '\n' ||
          rawLatin1[streamDataEnd - 1] === '\r'
        ) {
          streamDataEnd -= 1;
        }
      }
    }

    const stream =
      streamDataEnd >= streamDataStart
        ? pdfBuffer.subarray(streamDataStart, streamDataEnd)
        : undefined;
    objects.set(id, { id, dictText, stream });
  }

  return objects;
}

function undoPngPredictor(
  inflated: Buffer,
  columns: number,
  colors: number
): Buffer {
  const bpp = Math.max(1, colors);
  const rowBytes = columns * bpp;
  const stride = rowBytes + 1;
  if (inflated.length < stride || inflated.length % stride !== 0) {
    return inflated;
  }
  const rows = inflated.length / stride;
  const out = Buffer.alloc(rows * rowBytes);

  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };

  for (let r = 0; r < rows; r++) {
    const filterType = inflated[r * stride]!;
    const srcOff = r * stride + 1;
    const dstOff = r * rowBytes;
    const prevOff = (r - 1) * rowBytes;

    for (let i = 0; i < rowBytes; i++) {
      const raw = inflated[srcOff + i]!;
      const left = i >= bpp ? out[dstOff + i - bpp]! : 0;
      const up = r > 0 ? out[prevOff + i]! : 0;
      const upLeft = r > 0 && i >= bpp ? out[prevOff + i - bpp]! : 0;

      let recon = raw;
      if (filterType === 1) recon = (raw + left) & 0xff;
      else if (filterType === 2) recon = (raw + up) & 0xff;
      else if (filterType === 3)
        recon = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filterType === 4) recon = (raw + paeth(left, up, upLeft)) & 0xff;

      out[dstOff + i] = recon;
    }
  }
  return out;
}

function decodePdfImageObject(
  obj: ParsedPdfObject
): {
  pixels: Buffer;
  width: number;
  height: number;
  channels: 1 | 3 | 4;
  colorSpace: 'gray' | 'rgb' | 'rgba' | 'cmyk';
} {
  if (!obj.stream) {
    throw new Error(`PDF Image XObject ${obj.id} has no stream payload.`);
  }
  const width = Number(obj.dictText.match(/\/Width\s+(\d+)/)?.[1] ?? 0);
  const height = Number(obj.dictText.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid dimensions on PDF Image XObject ${obj.id}.`);
  }

  if (/\/DCTDecode\b/.test(obj.dictText)) {
    const tmpJpg = path.join(
      os.tmpdir(),
      `mp-pdf-xobj-${process.pid}-${obj.id}.jpg`
    );
    try {
      fs.writeFileSync(tmpJpg, obj.stream);
      const decoded = decodeBitmapToRgbaViaFfmpeg(tmpJpg);
      return {
        pixels: Buffer.from(
          decoded.rgba.buffer,
          decoded.rgba.byteOffset,
          decoded.rgba.byteLength
        ),
        width: decoded.width,
        height: decoded.height,
        channels: 4,
        colorSpace: 'rgba',
      };
    } finally {
      fs.rmSync(tmpJpg, { force: true });
    }
  }

  if (/\/Indexed\b/.test(obj.dictText)) {
    throw new Error(
      `PDF Image XObject ${obj.id} uses palette /Indexed color space; export the page as PNG first and pass the PNG to \`make-pictures cutout\`.`
    );
  }
  const bpc = Number(obj.dictText.match(/\/BitsPerComponent\s+(\d+)/)?.[1] ?? 8);
  if (bpc !== 8) {
    throw new Error(
      `PDF Image XObject ${obj.id} uses ${bpc}-bit samples (expected 8-bit); export the page as PNG first and pass the PNG to \`make-pictures cutout\`.`
    );
  }

  const isGray = /\/DeviceGray\b/.test(obj.dictText);
  const isCmyk = /\/DeviceCMYK\b/.test(obj.dictText);
  const channels: 1 | 3 | 4 = isGray ? 1 : isCmyk ? 4 : 3;
  const colorSpace: 'gray' | 'cmyk' | 'rgb' = isGray
    ? 'gray'
    : isCmyk
      ? 'cmyk'
      : 'rgb';
  let data = obj.stream;

  if (/\/FlateDecode\b/.test(obj.dictText)) {
    data = zlib.inflateSync(data);
    const predictor = Number(
      obj.dictText.match(/\/Predictor\s+(\d+)/)?.[1] ?? 1
    );
    if (predictor >= 10) {
      const cols = Number(
        obj.dictText.match(/\/Columns\s+(\d+)/)?.[1] ?? width
      );
      const colors = Number(
        obj.dictText.match(/\/Colors\s+(\d+)/)?.[1] ?? channels
      );
      data = undoPngPredictor(data, cols, colors);
    }
  }

  const expectedBytes = width * height * channels;
  if (data.length < expectedBytes) {
    throw new Error(
      `PDF Image XObject ${obj.id} decoded buffer (${data.length} B) is smaller than expected ${width}x${height}x${channels} (${expectedBytes} B).`
    );
  }

  return { pixels: data, width, height, channels, colorSpace };
}

export function extractPdfPageXObjectRgba(
  pdfBuffer: Buffer,
  pageNumber = 1,
  floodFillOptions?: { tolerance?: number; softRamp?: number }
): {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  usedNativeSmask: boolean;
} {
  const objects = parsePdfObjects(pdfBuffer);
  const pageObjects = Array.from(objects.values())
    .filter(
      (o) =>
        /\/Type\s*\/Page\b/.test(o.dictText) &&
        !/\/Type\s*\/Pages\b/.test(o.dictText)
    )
    .sort((a, b) => a.id - b.id);

  const pageIdx = Math.max(
    0,
    Math.min(pageObjects.length - 1, Math.round(pageNumber) - 1)
  );
  const targetPage = pageObjects[pageIdx];

  const candidateIds: number[] = [];
  if (targetPage) {
    let resourceText = targetPage.dictText;
    const resRef = targetPage.dictText.match(/\/Resources\s+(\d+)\s+\d+\s+R/);
    if (resRef) {
      resourceText += '\n' + (objects.get(Number(resRef[1]))?.dictText ?? '');
    }
    const xobjRef = resourceText.match(/\/XObject\s+(\d+)\s+\d+\s+R/);
    if (xobjRef) {
      resourceText += '\n' + (objects.get(Number(xobjRef[1]))?.dictText ?? '');
    }
    for (const m of resourceText.matchAll(/\/\w+\s+(\d+)\s+\d+\s+R/g)) {
      const refObj = objects.get(Number(m[1]));
      if (refObj && /\/Subtype\s*\/Image\b/.test(refObj.dictText)) {
        candidateIds.push(refObj.id);
      }
    }
  }

  if (candidateIds.length === 0) {
    for (const o of objects.values()) {
      if (/\/Subtype\s*\/Image\b/.test(o.dictText)) {
        candidateIds.push(o.id);
      }
    }
  }

  // Exclude objects that are referenced purely as `/SMask` of another image
  const smaskTargetIds = new Set<number>();
  for (const id of candidateIds) {
    const sm = objects.get(id)?.dictText.match(/\/SMask\s+(\d+)\s+\d+\s+R/);
    if (sm) smaskTargetIds.add(Number(sm[1]));
  }

  const primaryImageObjs = candidateIds
    .filter((id) => !smaskTargetIds.has(id))
    .map((id) => objects.get(id)!)
    .filter(Boolean)
    .sort((a, b) => {
      const aHasSmask = /\/SMask\s+\d+/.test(a.dictText) ? 1 : 0;
      const bHasSmask = /\/SMask\s+\d+/.test(b.dictText) ? 1 : 0;
      if (aHasSmask !== bHasSmask) return bHasSmask - aHasSmask;
      const aArea =
        Number(a.dictText.match(/\/Width\s+(\d+)/)?.[1] ?? 0) *
        Number(a.dictText.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
      const bArea =
        Number(b.dictText.match(/\/Width\s+(\d+)/)?.[1] ?? 0) *
        Number(b.dictText.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
      return bArea - aArea;
    });

  const chosen = primaryImageObjs[0];
  if (!chosen) {
    throw new Error(
      `No embedded XObject /Image found on page ${pageNumber} of PDF.`
    );
  }

  const base = decodePdfImageObject(chosen);
  const rgba = new Uint8ClampedArray(base.width * base.height * 4);
  for (let i = 0; i < base.width * base.height; i++) {
    if (base.colorSpace === 'cmyk') {
      const c = (base.pixels[i * 4] ?? 0) / 255;
      const m = (base.pixels[i * 4 + 1] ?? 0) / 255;
      const y = (base.pixels[i * 4 + 2] ?? 0) / 255;
      const k = (base.pixels[i * 4 + 3] ?? 0) / 255;
      rgba[i * 4] = Math.round(255 * (1 - c) * (1 - k));
      rgba[i * 4 + 1] = Math.round(255 * (1 - m) * (1 - k));
      rgba[i * 4 + 2] = Math.round(255 * (1 - y) * (1 - k));
      rgba[i * 4 + 3] = 255;
    } else if (base.channels === 4) {
      rgba[i * 4] = base.pixels[i * 4] ?? 0;
      rgba[i * 4 + 1] = base.pixels[i * 4 + 1] ?? 0;
      rgba[i * 4 + 2] = base.pixels[i * 4 + 2] ?? 0;
      rgba[i * 4 + 3] = base.pixels[i * 4 + 3] ?? 255;
    } else if (base.channels === 3) {
      rgba[i * 4] = base.pixels[i * 3] ?? 0;
      rgba[i * 4 + 1] = base.pixels[i * 3 + 1] ?? 0;
      rgba[i * 4 + 2] = base.pixels[i * 3 + 2] ?? 0;
      rgba[i * 4 + 3] = 255;
    } else {
      const g = base.pixels[i] ?? 0;
      rgba[i * 4] = g;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = g;
      rgba[i * 4 + 3] = 255;
    }
  }

  const smaskMatch = chosen.dictText.match(/\/SMask\s+(\d+)\s+\d+\s+R/);
  if (smaskMatch) {
    const smaskObj = objects.get(Number(smaskMatch[1]));
    if (smaskObj) {
      const mask = decodePdfImageObject(smaskObj);
      if (mask.width === base.width && mask.height === base.height) {
        for (let i = 0; i < base.width * base.height; i++) {
          rgba[i * 4 + 3] = mask.pixels[i * mask.channels] ?? 255;
        }
        return {
          rgba,
          width: base.width,
          height: base.height,
          usedNativeSmask: true,
        };
      }
    }
  }

  const bg = estimateCornerBackgroundRgb(rgba, base.width, base.height);
  const floodFilled = removeExteriorLightBackground(
    rgba,
    base.width,
    base.height,
    bg,
    floodFillOptions?.tolerance ?? 18,
    floodFillOptions?.softRamp ?? 10
  );
  return {
    rgba: floodFilled,
    width: base.width,
    height: base.height,
    usedNativeSmask: false,
  };
}

export async function runCutoutCommand(
  options: CutoutCommandOptions
): Promise<CutoutCommandResult> {
  const { rootDir, studioDir } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });

  const resolvedInput = path.resolve(rootDir, options.inputPath);
  if (!fs.existsSync(resolvedInput)) {
    throw new Error(
      `Cutout source file not found: ${path.relative(rootDir, resolvedInput)}`
    );
  }

  const resolvedOut = path.resolve(rootDir, options.outPath);
  const outSlug = path
    .basename(resolvedOut, path.extname(resolvedOut))
    .replace(/[^A-Za-z0-9_-]+/g, '-');
  const resolvedQaOut = options.qaOutPath
    ? path.resolve(rootDir, options.qaOutPath)
    : path.resolve(studioDir, 'out', `cutout-qa-${outSlug}.png`);

  const tolerance = options.tolerance ?? 18;
  const softRamp = options.softRamp ?? 10;
  const page = options.page ?? 1;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error(`Invalid --tolerance value: "${String(options.tolerance)}"`);
  }
  if (!Number.isFinite(softRamp) || softRamp < 0) {
    throw new Error(`Invalid --soft-ramp value: "${String(options.softRamp)}"`);
  }
  if (!Number.isFinite(page) || page < 1) {
    throw new Error(`Invalid --page value: "${String(options.page)}"`);
  }
  const ext = path.extname(resolvedInput).toLowerCase();

  let finalRgba: Uint8ClampedArray;
  let width: number;
  let height: number;
  let usedNativeSmask = false;

  if (ext === '.pdf') {
    const extracted = extractPdfPageXObjectRgba(
      fs.readFileSync(resolvedInput),
      page,
      { tolerance, softRamp }
    );
    finalRgba = extracted.rgba;
    width = extracted.width;
    height = extracted.height;
    usedNativeSmask = extracted.usedNativeSmask;
  } else {
    const decoded = decodeBitmapToRgbaViaFfmpeg(resolvedInput);
    width = decoded.width;
    height = decoded.height;
    const bg = estimateCornerBackgroundRgb(decoded.rgba, width, height);
    finalRgba = removeExteriorLightBackground(
      decoded.rgba,
      width,
      height,
      bg,
      tolerance,
      softRamp
    );
  }

  const holeReport = detectInteriorAlphaHoles(finalRgba, width, height);
  if (holeReport.hasInteriorHoles) {
    console.warn(
      `  ⚠️  [cutout] Detected ${holeReport.holeCount} interior alpha hole(s) (${holeReport.holePixelCount} px) inside object silhouette — inspect dark checkerboard QA!`
    );
  }

  writeRgbaPngViaFfmpeg(resolvedOut, finalRgba, width, height);
  const checkerRgba = renderDarkCheckerboardRgba(finalRgba, width, height);
  writeRgbaPngViaFfmpeg(resolvedQaOut, checkerRgba, width, height);

  console.log(
    `✅ Saved cutout (${width}x${height}${
      usedNativeSmask ? ' • native PDF /SMask' : ' • exterior flood-fill'
    }): ${path.relative(rootDir, resolvedOut)}`
  );
  console.log(
    `🔍 Dark checkerboard QA sheet: ${path.relative(rootDir, resolvedQaOut)}`
  );

  return {
    outputPath: resolvedOut,
    qaSheetPath: resolvedQaOut,
    width,
    height,
    usedNativeSmask,
    holeReport,
  };
}
