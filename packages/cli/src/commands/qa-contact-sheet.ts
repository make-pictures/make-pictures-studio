import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { openBrowser as OpenBrowserFn } from '@remotion/renderer';
import { auditStudioAudioLifetimes } from '../audio/audit-audio-tags';
import {
  resolveRemotionEntryPoint,
  resolveWorkspaceContext,
} from './workspace-paths';

export interface QaContactSheetOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  entryPoint?: string;
  compositionId: string;
  grid?: string; // e.g. '4x3'
  outPath?: string;
  durationOverride?: number;
  inputProps?: Record<string, unknown>;
  glAngle?: boolean;
}

export interface QaContactSheetResult {
  outputPath: string;
  frames: number[];
  width: number;
  height: number;
  fps: number;
  isVertical: boolean;
}

interface RegistryHint {
  usesThree?: boolean;
  sceneTimeline?: Array<{
    sceneId: string;
    fromFrame: number;
    durationInFrames: number;
  }>;
}

export function toKebabSlug(compId: string): string {
  return compId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
}

function parseGridSpec(gridSpec = '4x3'): { cols: number; rows: number } {
  const match = gridSpec.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) {
    return { cols: 4, rows: 3 };
  }
  const cols = Math.max(1, Math.min(8, Number(match[1])));
  const rows = Math.max(1, Math.min(8, Number(match[2])));
  return { cols, rows };
}

/**
 * Selects `count` key frames across `[0, durationInFrames - 1]`:
 * - Always starts at `frame = 0` (clean empty background invariant)
 * - Incorporates scene transition boundaries when present
 * - Distributes remaining slots evenly across the story arc
 */
export function selectQaSampleFrames(
  durationInFrames: number,
  count: number,
  sceneTimeline?: Array<{ fromFrame: number; durationInFrames: number }>
): number[] {
  const maxFrame = Math.max(0, durationInFrames - 1);
  if (count <= 1 || maxFrame === 0) {
    return [0];
  }

  const usableEnd =
    durationInFrames > 48 ? durationInFrames - 16 : maxFrame;

  const selected = new Set<number>([0]);

  if (sceneTimeline && sceneTimeline.length > 1) {
    for (const seg of sceneTimeline) {
      if (seg.fromFrame > 0 && seg.fromFrame <= maxFrame) {
        selected.add(Math.min(maxFrame, seg.fromFrame));
      }
      const postEnter = seg.fromFrame + 24;
      if (postEnter > 0 && postEnter <= usableEnd && selected.size < count) {
        selected.add(postEnter);
      }
    }
  }

  for (let i = 1; i < count; i++) {
    if (selected.size >= count) break;
    const f = Math.round((i / (count - 1)) * usableEnd);
    selected.add(Math.max(0, Math.min(maxFrame, f)));
  }

  let cursor = 1;
  while (selected.size < count && cursor <= maxFrame) {
    selected.add(cursor);
    cursor += 1;
  }

  const sorted = Array.from(selected)
    .sort((a, b) => a - b)
    .slice(0, count);

  while (sorted.length < count) {
    sorted.push(maxFrame);
  }

  sorted[0] = 0;
  return sorted;
}

/**
 * Compact 5x7 pixel font for crisp, zero-dependency RGBA PAM overlays
 * (works identically even when local `ffmpeg` lacks `libfreetype` / `drawtext`).
 */
const BITMAP_FONT_5X7: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
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
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function writeRgbaPamBadge(params: {
  filePath: string;
  text: string;
  scale?: number;
  bgRgba?: [number, number, number, number];
  borderRgba?: [number, number, number, number];
  fgRgba?: [number, number, number, number];
  padX?: number;
  padY?: number;
}): void {
  const scale = params.scale ?? 2;
  const padX = params.padX ?? 10;
  const padY = params.padY ?? 7;
  const bg = params.bgRgba ?? [11, 15, 25, 224];
  const border = params.borderRgba ?? [99, 102, 241, 235];
  const fg = params.fgRgba ?? [248, 250, 252, 255];

  const chars = Array.from(params.text);
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const gap = scale;
  const textW = Math.max(1, chars.length * (glyphW + gap) - gap);
  const width = textW + padX * 2;
  const height = glyphH + padY * 2;

  const pixels = Buffer.alloc(width * height * 4);

  const setPixel = (
    x: number,
    y: number,
    rgba: [number, number, number, number]
  ) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    pixels[idx] = rgba[0];
    pixels[idx + 1] = rgba[1];
    pixels[idx + 2] = rgba[2];
    pixels[idx + 3] = rgba[3];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder =
        x < 2 || x >= width - 2 || y < 2 || y >= height - 2;
      setPixel(x, y, isBorder ? border : bg);
    }
  }

  chars.forEach((rawCh, cIdx) => {
    const rows =
      BITMAP_FONT_5X7[rawCh] ??
      BITMAP_FONT_5X7[rawCh.toUpperCase()] ??
      BITMAP_FONT_5X7[' '];
    const originX = padX + cIdx * (glyphW + gap);
    const originY = padY;

    for (let r = 0; r < 7; r++) {
      const rowStr = rows[r] ?? '00000';
      for (let c = 0; c < 5; c++) {
        if (rowStr[c] === '1') {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              setPixel(originX + c * scale + sx, originY + r * scale + sy, fg);
            }
          }
        }
      }
    }
  });

  const header = Buffer.from(
    `P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`,
    'ascii'
  );
  fs.writeFileSync(params.filePath, Buffer.concat([header, pixels]));
}

async function lookupRegistryHint(
  studioDir: string,
  compositionId: string
): Promise<RegistryHint> {
  // 1. Try scanning capsule `productions/<slug>/production.json` (pure JSON, works under raw `node`)
  try {
    const slug = toKebabSlug(compositionId);
    const prodJsonPath = path.join(
      studioDir,
      'productions',
      slug,
      'production.json'
    );
    if (fs.existsSync(prodJsonPath)) {
      const manifest = JSON.parse(fs.readFileSync(prodJsonPath, 'utf8')) as {
        fps?: number;
        scenes?: Array<{
          id: string;
          durationInFrames?: number;
          durationInSeconds?: number;
        }>;
      };
      const fps = manifest.fps || 60;
      if (Array.isArray(manifest.scenes) && manifest.scenes.length > 0) {
        let cursor = 12;
        const sceneTimeline = manifest.scenes.map((s) => {
          const dur =
            s.durationInFrames ?? Math.round((s.durationInSeconds ?? 5) * fps);
          const seg = {
            sceneId: s.id,
            fromFrame: cursor,
            durationInFrames: dur,
          };
          cursor += dur + 12;
          return seg;
        });
        return { sceneTimeline };
      }
    }
  } catch {
    // ignore
  }

  // 2. Fallback: try dynamic import of monorepo `src/compositions/registry.ts` (when run via `tsx`)
  try {
    const registryPath = path.join(
      studioDir,
      'src',
      'compositions',
      'registry.ts'
    );
    if (!fs.existsSync(registryPath)) return {};
    const mod = (await import(pathToFileURL(registryPath).href)) as {
      getCompositionById?: (id: string) => RegistryHint | undefined;
    };
    return mod.getCompositionById?.(compositionId) ?? {};
  } catch {
    return {};
  }
}

/**
 * Generates a high-signal multi-frame QA Contact Sheet (`4x3` = 12 frames by default),
 * starting at `frame = 0`, drawing frame badges (`f=0`, `f=78`, ...) and for vertical
 * `9:16` Shorts compositions drawing the green `Golden Safe Box` (`x=40..910, y=220..1380`)
 * plus red UI dead-zone overlays.
 */
export async function runQaContactSheetCommand(
  options: QaContactSheetOptions
): Promise<QaContactSheetResult> {
  const { rootDir, studioDir, isEngineMonorepo } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });

  const { compositionId } = options;
  const { cols, rows } = parseGridSpec(options.grid);
  const tileCount = cols * rows;

  const resolvedOutPath = options.outPath
    ? path.resolve(rootDir, options.outPath)
    : path.resolve(studioDir, 'out', `qa-${compositionId}.png`);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });

  const entryPoint = resolveRemotionEntryPoint({
    rootDir,
    studioDir,
    explicitEntry: options.entryPoint,
  });

  const publicDir = path.join(studioDir, 'public');
  fs.mkdirSync(publicDir, { recursive: true });

  const hint = await lookupRegistryHint(studioDir, compositionId);
  const useAngleGl = options.glAngle ?? hint.usesThree ?? true;

  const tempWorkDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-qa-')
  );
  let bundleDir: string | null = null;
  let browser: Awaited<ReturnType<typeof OpenBrowserFn>> | null = null;

  try {
    const [{ bundle }, { openBrowser, renderStill, selectComposition }] =
      await Promise.all([
        import('@remotion/bundler'),
        import('@remotion/renderer'),
      ]);

    console.log('==============================================================');
    console.log(
      ` 🔍 make.pictures — Contact-Sheet QA (${compositionId} • ${cols}x${rows})`
    );
    console.log('==============================================================');

    const audioWarnings = auditStudioAudioLifetimes(studioDir);
    if (audioWarnings.length > 0) {
      for (const warn of audioWarnings) {
        const relPath = path.relative(rootDir, warn.filePath);
        console.warn(
          `  ⚠️  [Audio Pool Guard] ${relPath}:${warn.line} — ${warn.message}`
        );
      }
    }

    console.log(
      `  [1/3] Bundling Remotion entry (${path.relative(rootDir, entryPoint)})…`
    );

    bundleDir = await bundle({
      entryPoint,
      publicDir,
      webpackOverride: (currentConfiguration) => {
        if (!isEngineMonorepo) {
          // External consumer project: resolve `@make-pictures/*` directly from `node_modules`
          return currentConfiguration;
        }
        const studioSrc = path.resolve(rootDir, 'packages/studio/src');
        return {
          ...currentConfiguration,
          resolve: {
            ...currentConfiguration.resolve,
            alias: {
              ...(currentConfiguration.resolve?.alias ?? {}),
              '@make-pictures/core': path.resolve(rootDir, 'packages/core/src'),
              '@make-pictures/kits': path.resolve(rootDir, 'packages/kits/src'),
              ...(fs.existsSync(studioSrc)
                ? { '@make-pictures/studio': studioSrc }
                : {}),
            },
          },
        };
      },
    });

    const chromiumOptions = useAngleGl ? { gl: 'angle' as const } : {};
    browser = await openBrowser('chrome', { chromiumOptions });

    const composition = await selectComposition({
      serveUrl: bundleDir,
      id: compositionId,
      inputProps: options.inputProps ?? {},
      puppeteerInstance: browser,
      chromiumOptions,
    });

    const totalFrames =
      options.durationOverride ?? composition.durationInFrames;
    const { width, height, fps } = composition;
    const isVertical = height > width;

    const frames = selectQaSampleFrames(
      totalFrames,
      tileCount,
      hint.sceneTimeline
    );

    console.log(
      `  [2/3] Rendering ${frames.length} key frames (${width}x${height} @ ${fps}fps${
        isVertical ? ' • 9:16 Safe-Box Overlay' : ''
      }): [${frames.join(', ')}]…`
    );

    const tilePaths: string[] = [];
    const tileContentW = isVertical ? 340 : 480;
    const tileContentH = Math.max(
      2,
      Math.round((tileContentW * height) / width / 2) * 2
    );

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const rawStillPath = path.join(tempWorkDir, `raw-${i}.png`);
      const annotatedTilePath = path.join(tempWorkDir, `tile-${i}.png`);
      const badgePamPath = path.join(tempWorkDir, `badge-${i}.pam`);

      await renderStill({
        composition,
        serveUrl: bundleDir,
        output: rawStillPath,
        frame,
        imageFormat: 'png',
        inputProps: options.inputProps ?? {},
        puppeteerInstance: browser,
        chromiumOptions,
      });

      const secStr = (frame / fps).toFixed(2);
      const badgeLabel =
        isVertical && i === 0
          ? `f=${frame} (${secStr}s) SAFE 9:16`
          : `f=${frame} (${secStr}s)`;

      writeRgbaPamBadge({
        filePath: badgePamPath,
        text: badgeLabel,
        scale: 2,
        borderRgba:
          frame === 0
            ? [34, 197, 94, 245]
            : [99, 102, 241, 235],
      });

      const preScaleBoxes: string[] = [];
      if (isVertical) {
        const sx = width / 1080;
        const sy = height / 1920;
        const topDeadH = Math.round(220 * sy);
        const botDeadY = Math.round(1440 * sy);
        const rightDeadX = Math.round(910 * sx);
        const rightDeadY = Math.round(900 * sy);
        const safeX = Math.round(40 * sx);
        const safeY = Math.round(220 * sy);
        const safeW = Math.round(870 * sx);
        const safeH = Math.round(1160 * sy);

        preScaleBoxes.push(
          `drawbox=x=0:y=0:w=${width}:h=${topDeadH}:color=0xEF4444@0.20:t=fill`,
          `drawbox=x=0:y=${Math.max(0, topDeadH - 4)}:w=${width}:h=4:color=0xEF4444@0.90:t=fill`,
          `drawbox=x=0:y=${botDeadY}:w=${width}:h=${height - botDeadY}:color=0xEF4444@0.22:t=fill`,
          `drawbox=x=0:y=${botDeadY}:w=${width}:h=4:color=0xEF4444@0.90:t=fill`,
          `drawbox=x=${rightDeadX}:y=${rightDeadY}:w=${width - rightDeadX}:h=${botDeadY - rightDeadY}:color=0xEF4444@0.18:t=fill`,
          `drawbox=x=${rightDeadX}:y=${rightDeadY}:w=4:h=${botDeadY - rightDeadY}:color=0xEF4444@0.85:t=fill`,
          `drawbox=x=${safeX}:y=${safeY}:w=${safeW}:h=${safeH}:color=0x22C55E@0.95:t=6`
        );
      }

      const stageChain = [
        ...preScaleBoxes,
        `scale=${tileContentW}:${tileContentH}`,
        `pad=${tileContentW + 6}:${tileContentH + 6}:3:3:color=0x0F172A`,
      ].join(',');

      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-i',
          rawStillPath,
          '-i',
          badgePamPath,
          '-filter_complex',
          `[0:v]${stageChain}[bg];[bg][1:v]overlay=10:10[out]`,
          '-map',
          '[out]',
          '-frames:v',
          '1',
          annotatedTilePath,
        ],
        { stdio: 'ignore' }
      );

      tilePaths.push(annotatedTilePath);
    }

    console.log(
      `  [3/3] Stitching ${cols}x${rows} contact sheet → ${path.relative(
        rootDir,
        resolvedOutPath
      )}…`
    );

    const paddedTileW = tileContentW + 6;
    const paddedTileH = tileContentH + 6;

    const layoutTokens: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        layoutTokens.push(`${c * paddedTileW}_${r * paddedTileH}`);
      }
    }

    const headerPamPath = path.join(tempWorkDir, 'header.pam');
    writeRgbaPamBadge({
      filePath: headerPamPath,
      text: `${compositionId} | ${width}x${height} @ ${fps}FPS | ${totalFrames}F${
        isVertical ? ' | 9:16 GOLDEN SAFE BOX' : ' | 16:9 QA SHEET'
      }`,
      scale: 2,
      bgRgba: [15, 23, 42, 255],
      borderRgba: [56, 189, 248, 220],
      padX: 14,
      padY: 8,
    });

    const ffmpegInputs: string[] = [];
    const inputTags: string[] = [];
    tilePaths.forEach((p, idx) => {
      ffmpegInputs.push('-i', p);
      inputTags.push(`[${idx}:v]`);
    });
    ffmpegInputs.push('-i', headerPamPath);
    const headerIdx = tilePaths.length;

    const filterComplex = `${inputTags.join('')}xstack=inputs=${
      tilePaths.length
    }:layout=${layoutTokens.join(
      '|'
    )}[grid];[grid]pad=iw:ih+50:0:50:color=0x090D16[sheet];[sheet][${headerIdx}:v]overlay=12:9[final]`;

    execFileSync(
      'ffmpeg',
      [
        '-y',
        ...ffmpegInputs,
        '-filter_complex',
        filterComplex,
        '-map',
        '[final]',
        '-frames:v',
        '1',
        resolvedOutPath,
      ],
      { stdio: 'ignore' }
    );

    console.log(
      `✅ QA Contact Sheet ready: ${path.relative(rootDir, resolvedOutPath)}`
    );

    return {
      outputPath: resolvedOutPath,
      frames,
      width,
      height,
      fps,
      isVertical,
    };
  } finally {
    if (browser) {
      await browser.close({ silent: true }).catch(() => undefined);
    }
    if (bundleDir && fs.existsSync(bundleDir)) {
      fs.rmSync(bundleDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempWorkDir)) {
      fs.rmSync(tempWorkDir, { recursive: true, force: true });
    }
  }
}
