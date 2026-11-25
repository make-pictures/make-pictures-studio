import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type * as RemotionBundlerMod from '@remotion/bundler';
import type * as RemotionRendererMod from '@remotion/renderer';
import { auditStudioAudioLifetimes } from '../audio/audit-audio-tags';
import {
  DirectorAuditError,
  auditCompositionDirection,
  readBalancedBraceEnd,
  verifyCleanFrameZeroImage,
  type AuditVoiceoverEntry,
  type DirectorAuditViolation,
} from '../director/audit-direction';
import { BITMAP_FONT_5X7, toKebabSlug } from '../utils/cli-helpers';
import { resolveCompositionSourceFromRoot } from '../utils/composition-resolver';
import { detectCompositionUsesThree } from './render';
import {
  assertFfmpegInstalled,
  assertRemotionInstalled,
  loadMakePicturesConfig,
  resolveRemotionEntryPoint,
  resolveWorkspaceContext,
} from './workspace-paths';

export { resolveCompositionSourceFromRoot, toKebabSlug };

export interface QaContactSheetOptions {
  rootDir?: string;
  cwd?: string;
  dir?: string;
  entryPoint?: string;
  audioManifestPath?: string;
  compositionId: string;
  grid?: string; // e.g. 'auto' (default) or '4x3'
  outPath?: string;
  durationOverride?: number;
  inputProps?: Record<string, unknown>;
  glAngle?: boolean;
  allowFastCuts?: boolean;
}

export interface QaContactSheetResult {
  outputPath: string;
  frames: number[];
  width: number;
  height: number;
  fps: number;
  isVertical: boolean;
}

export interface QaTimelineSubViewHint {
  id?: string;
  fromOffsetFrames: number;
  label?: string;
}

export interface QaTimelineSegmentHint {
  sceneId?: string;
  fromFrame: number;
  durationInFrames: number;
  label?: string;
  subViews?: QaTimelineSubViewHint[];
}

export interface QaSamplePoint {
  frame: number;
  tag?: string;
}

/**
 * Resolves QA contact-sheet grid dimensions (`cols × rows`).
 * Defaults to `'auto'` (`cols = 4`, `rows = Math.max(3, Math.ceil(mandatoryCount / 4))`),
 * guaranteeing 100% scene and sub-view coverage even on 8–12 scene narratives.
 */
export function resolveQaGridDimensions(
  gridSpec?: string,
  mandatoryCount = 12
): { cols: number; rows: number } {
  const autoRows = Math.max(
    3,
    Math.min(12, Math.ceil(Math.max(1, mandatoryCount) / 4))
  );
  if (!gridSpec || gridSpec.trim().toLowerCase() === 'auto') {
    return { cols: 4, rows: autoRows };
  }
  const match = gridSpec.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) {
    return { cols: 4, rows: autoRows };
  }
  const cols = Math.max(1, Math.min(8, Number(match[1])));
  const rows = Math.max(1, Math.min(12, Number(match[2])));
  return { cols, rows };
}

/**
 * Collects mandatory QA sample points (`frame = 0`, 1 settled frame per scene or per declared
 * `subView`, and a final outro settle frame at `durationInFrames - 30`) along with human-readable
 * `sceneId` / `sceneId/subViewId` badge tags.
 */
export function collectMandatoryQaSamplePoints(
  durationInFrames: number,
  sceneTimeline?: ReadonlyArray<QaTimelineSegmentHint>,
  cameraTimeline?: ReadonlyArray<{
    shotLabel?: string;
    fromFrame: number;
    durationInFrames: number;
  }>
): QaSamplePoint[] {
  const maxFrame = Math.max(0, durationInFrames - 1);
  if (maxFrame === 0) {
    return [{ frame: 0 }];
  }

  const clampFrame = (f: number): number =>
    Math.max(0, Math.min(maxFrame, Math.round(f)));

  const finalSettle =
    durationInFrames > 60 ? clampFrame(durationInFrames - 30) : maxFrame;

  const byFrame = new Map<number, string | undefined>();
  byFrame.set(0, undefined);

  const insertMandatory = (
    candidate: number,
    minBound: number,
    maxBound: number,
    tag?: string
  ): void => {
    let f = clampFrame(candidate);
    if (f === 0 && maxFrame > 0) f = 1;
    while (byFrame.has(f) && f < Math.min(maxFrame, maxBound)) {
      f += 1;
    }
    while (byFrame.has(f) && f > Math.max(1, minBound)) {
      f -= 1;
    }
    if (!byFrame.has(f)) {
      byFrame.set(f, tag);
    }
  };

  if (sceneTimeline && sceneTimeline.length > 0) {
    const segments = [...sceneTimeline]
      .filter((s) => s.fromFrame <= maxFrame)
      .sort((a, b) => a.fromFrame - b.fromFrame);

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      const segStart = Math.max(0, seg.fromFrame);
      const nextStart = segments[i + 1]?.fromFrame ?? durationInFrames;
      const segEnd = Math.min(
        durationInFrames,
        Math.max(segStart + 1, nextStart)
      );
      const span = Math.max(1, segEnd - segStart);
      const sceneLabel = seg.sceneId ?? seg.label ?? `s${i + 1}`;

      if (seg.subViews && seg.subViews.length > 0) {
        const sortedSubs = [...seg.subViews].sort(
          (a, b) => a.fromOffsetFrames - b.fromOffsetFrames
        );
        const normalizedSubs: QaTimelineSubViewHint[] =
          sortedSubs[0]!.fromOffsetFrames > 24
            ? [{ id: 'v1', fromOffsetFrames: 0 }, ...sortedSubs]
            : sortedSubs;

        for (let k = 0; k < normalizedSubs.length; k++) {
          const sub = normalizedSubs[k]!;
          const subStart = Math.min(
            segEnd - 1,
            segStart + Math.max(0, sub.fromOffsetFrames)
          );
          const nextOffset = normalizedSubs[k + 1]?.fromOffsetFrames;
          const subEnd =
            nextOffset !== undefined
              ? Math.min(
                  segEnd,
                  segStart + Math.max(sub.fromOffsetFrames + 1, nextOffset)
                )
              : segEnd;
          const subSpan = Math.max(1, subEnd - subStart);
          const offset =
            subSpan > 48
              ? Math.min(subSpan - 12, Math.max(36, Math.floor(subSpan * 0.62)))
              : Math.max(1, Math.floor(subSpan * 0.6));
          const subLabel = sub.id ?? sub.label ?? `v${k + 1}`;
          insertMandatory(
            subStart + offset,
            subStart + 1,
            Math.min(finalSettle, subEnd - 1),
            `${sceneLabel}/${subLabel}`
          );
        }
      } else {
        const offset =
          span > 78
            ? Math.min(span - 24, Math.max(54, Math.floor(span * 0.58)))
            : Math.max(1, Math.floor(span * 0.6));
        insertMandatory(
          segStart + offset,
          segStart + 1,
          Math.min(finalSettle, segEnd - 1),
          sceneLabel
        );
      }
    }
  } else if (cameraTimeline && cameraTimeline.length > 0) {
    const shots = [...cameraTimeline]
      .filter((c) => c.fromFrame <= maxFrame)
      .sort((a, b) => a.fromFrame - b.fromFrame);
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i]!;
      const shotStart = Math.max(0, shot.fromFrame);
      const shotEnd = Math.min(
        durationInFrames,
        Math.max(shotStart + 1, shotStart + shot.durationInFrames)
      );
      const span = Math.max(1, shotEnd - shotStart);
      insertMandatory(
        shotStart + Math.floor(span * 0.58),
        shotStart + 1,
        Math.min(finalSettle, shotEnd - 1),
        shot.shotLabel ?? `cam${i + 1}`
      );
    }
  }

  if (finalSettle > 0 && !byFrame.has(finalSettle)) {
    byFrame.set(finalSettle, 'outro');
  }

  return Array.from(byFrame.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([frame, tag]) => ({ frame, tag }));
}

/**
 * Selects key frames across `[0, durationInFrames - 1]`:
 * - Always starts at `frame = 0` (clean empty background invariant)
 * - Guarantees 100% presence of every scene and declared `subView` when `count` is omitted (`--grid=auto`)
 * - Ends on the settled final frame (`durationInFrames - 30`) and fills remaining grid tiles by
 *   bisecting the largest uncovered intervals.
 */
export function selectQaSampleFrames(
  durationInFrames: number,
  count?: number,
  sceneTimeline?: ReadonlyArray<QaTimelineSegmentHint>,
  cameraTimeline?: ReadonlyArray<{
    shotLabel?: string;
    fromFrame: number;
    durationInFrames: number;
  }>
): number[] {
  const maxFrame = Math.max(0, durationInFrames - 1);
  if ((count !== undefined && count <= 1) || maxFrame === 0) {
    return [0];
  }

  const mandatory = collectMandatoryQaSamplePoints(
    durationInFrames,
    sceneTimeline,
    cameraTimeline
  );
  const autoGrid = resolveQaGridDimensions(undefined, mandatory.length);
  const targetCount = count ?? autoGrid.cols * autoGrid.rows;

  const clampFrame = (f: number): number =>
    Math.max(0, Math.min(maxFrame, Math.round(f)));
  const finalSettle =
    durationInFrames > 60 ? clampFrame(durationInFrames - 30) : maxFrame;

  const selected = new Set<number>(mandatory.map((m) => m.frame));

  if (
    (!sceneTimeline || sceneTimeline.length === 0) &&
    (!cameraTimeline || cameraTimeline.length === 0)
  ) {
    for (let i = 1; i < targetCount; i++) {
      const f = clampFrame((i / (targetCount - 1)) * finalSettle);
      selected.add(f);
    }
  }

  let sorted = Array.from(selected).sort((a, b) => a - b);

  if (sorted.length > targetCount) {
    const trimmed: number[] = [];
    for (let k = 0; k < targetCount; k++) {
      const idx = Math.round((k * (sorted.length - 1)) / (targetCount - 1));
      trimmed.push(sorted[idx]!);
    }
    trimmed[0] = 0;
    trimmed[trimmed.length - 1] = sorted[sorted.length - 1]!;
    return trimmed;
  }

  // Evenly bisect largest uncovered intervals until `targetCount` frames are reached
  while (sorted.length < targetCount) {
    let bestGap = 0;
    let bestMid = -1;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap >= 2 && gap > bestGap) {
        const mid = Math.floor((sorted[i]! + sorted[i + 1]!) / 2);
        if (!selected.has(mid)) {
          bestGap = gap;
          bestMid = mid;
        }
      }
    }
    if (bestMid === -1) {
      break;
    }
    selected.add(bestMid);
    sorted = Array.from(selected).sort((a, b) => a - b);
  }

  let cursor = 1;
  while (selected.size < targetCount && cursor <= maxFrame) {
    selected.add(cursor);
    cursor += 1;
  }

  sorted = Array.from(selected)
    .sort((a, b) => a - b)
    .slice(0, targetCount);

  while (sorted.length < targetCount) {
    sorted.push(maxFrame);
  }

  sorted[0] = 0;
  return sorted;
}

/**
 * Self-contained Chromium `page.evaluate` check on `frame = 0`.
 * Uses zero inner helper functions so esbuild `__name` instrumentation never leaks into page context.
 */
export function auditFrameZeroDomInPage(): {
  clean: boolean;
  offendingElements: string[];
} {
  const offending: string[] = [];
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { clean: true, offendingElements: offending };
  }
  const root = document.getElementById('root') ?? document.body;
  if (!root) {
    return { clean: true, offendingElements: offending };
  }

  const vw = window.innerWidth || 1920;
  const vh = window.innerHeight || 1080;
  const nodes = root.querySelectorAll('*');

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as HTMLElement;
    const tag = el.tagName ? el.tagName.toUpperCase() : '';
    if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'DEFS') continue;

    let accOpacity = 1;
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.documentElement) {
      const cStyle = window.getComputedStyle(cur);
      if (cStyle.display === 'none' || cStyle.visibility === 'hidden') {
        accOpacity = 0;
        break;
      }
      const op = parseFloat(cStyle.opacity);
      if (Number.isFinite(op)) {
        accOpacity *= op;
      }
      if (accOpacity <= 0.002) {
        accOpacity = 0;
        break;
      }
      cur = cur.parentElement;
    }
    if (accOpacity <= 0.002) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    if (
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= vh ||
      rect.left >= vw
    ) {
      continue;
    }

    if (tag === 'IMG' || tag === 'VIDEO' || tag === 'SVG') {
      offending.push(`<${tag.toLowerCase()}> (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      if (offending.length >= 5) break;
      continue;
    }

    let directText = '';
    for (let c = 0; c < el.childNodes.length; c++) {
      const child = el.childNodes[c]!;
      if (child.nodeType === 3 && child.textContent) {
        directText += child.textContent;
      }
    }
    directText = directText.trim();
    if (directText.length > 0) {
      const cs = window.getComputedStyle(el);
      const fSize = parseFloat(cs.fontSize);
      if (fSize > 0 && cs.color !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent') {
        offending.push(
          `<${tag.toLowerCase()}> "${directText.slice(0, 32)}" (opacity=${accOpacity.toFixed(2)})`
        );
        if (offending.length >= 5) break;
      }
    }
  }

  return {
    clean: offending.length === 0,
    offendingElements: offending,
  };
}

export interface RenderedDomAuditIssue {
  code: 'FONT_BELOW_1080P_FLOOR' | 'CARD_VERTICAL_VOID';
  message: string;
  snippet?: string;
}

/**
 * Self-contained Chromium `page.evaluate` check on settled `frame > 0` stills:
 * 1. `FONT_BELOW_1080P_FLOOR`: rejects visible rendered text `< 18px` at `1080p` scale.
 * 2. `CARD_VERTICAL_VOID`: rejects vertical flex cards with `> 42%` (`> 140px`) dead empty space
 *    between children (typically caused by `height: 100%` + `justifyContent: 'space-between'`).
 */
export function auditRenderedFrameDomInPage(
  viewportWidth: number,
  viewportHeight: number
): RenderedDomAuditIssue[] {
  const issues: RenderedDomAuditIssue[] = [];
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return issues;
  }
  const root = document.getElementById('root') ?? document.body;
  if (!root) {
    return issues;
  }

  const vw = viewportWidth || window.innerWidth || 1920;
  const vh = viewportHeight || window.innerHeight || 1080;
  const shortSide = Math.min(vw, vh);
  const scaleRef = shortSide / 1080;
  const minFontPx = 18 * scaleRef - 0.35;
  const nodes = root.querySelectorAll('*');

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as HTMLElement;
    const tag = el.tagName ? el.tagName.toUpperCase() : '';
    if (
      tag === 'STYLE' ||
      tag === 'SCRIPT' ||
      tag === 'DEFS' ||
      tag === 'TITLE' ||
      tag === 'DESC'
    ) {
      continue;
    }

    let accOpacity = 1;
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.documentElement) {
      const cStyle = window.getComputedStyle(cur);
      if (cStyle.display === 'none' || cStyle.visibility === 'hidden') {
        accOpacity = 0;
        break;
      }
      const op = parseFloat(cStyle.opacity);
      if (Number.isFinite(op)) {
        accOpacity *= op;
      }
      if (accOpacity < 0.85) {
        break;
      }
      cur = cur.parentElement;
    }
    // Only audit settled elements (`opacity >= 0.85`) to avoid cross-dissolve / spring-in false positives
    if (accOpacity < 0.85) continue;

    const rect = el.getBoundingClientRect();
    if (
      rect.width < 4 ||
      rect.height < 4 ||
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= vh ||
      rect.left >= vw
    ) {
      continue;
    }

    const cs = window.getComputedStyle(el);

    // 1. Check effective rendered font size on direct text nodes
    let directText = '';
    for (let c = 0; c < el.childNodes.length; c++) {
      const child = el.childNodes[c]!;
      if (child.nodeType === 3 && child.textContent) {
        directText += child.textContent;
      }
    }
    directText = directText.replace(/\s+/g, ' ').trim();
    if (directText.length >= 2) {
      const rawFontPx = parseFloat(cs.fontSize);
      const maybeSvg = el as unknown as {
        getScreenCTM?: () => { a: number; b: number } | null;
      };
      let cssScale = 1;
      if (typeof maybeSvg.getScreenCTM === 'function') {
        const ctm = maybeSvg.getScreenCTM();
        if (ctm && Number.isFinite(ctm.a) && Number.isFinite(ctm.b)) {
          cssScale = Math.max(0.2, Math.min(8, Math.hypot(ctm.a, ctm.b)));
        }
      } else {
        const offsetH = (el as HTMLElement).offsetHeight;
        if (typeof offsetH === 'number' && offsetH > 0) {
          cssScale = Math.max(0.2, Math.min(5, rect.height / offsetH));
        }
      }
      const renderedFontPx = rawFontPx * cssScale;

      if (
        Number.isFinite(renderedFontPx) &&
        renderedFontPx > 0 &&
        renderedFontPx < minFontPx &&
        issues.length < 6
      ) {
        issues.push({
          code: 'FONT_BELOW_1080P_FLOOR',
          snippet: directText.slice(0, 60),
          message: `Visible text "${directText.slice(0, 40)}" renders at ${renderedFontPx.toFixed(1)}px (< ${(18 * scaleRef).toFixed(0)}px 1080p legibility floor). Increase fontSize >= 18px or remove decorative micro-stamps.`,
        });
      }
    }

    // 2. Check vertical card dead-space voids (> 42% of card height and > 140px @ 1080p)
    const borderRad = parseFloat(cs.borderRadius) || 0;
    const borderTopW = parseFloat(cs.borderTopWidth) || 0;
    const hasBg =
      cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
      cs.backgroundColor !== 'transparent';
    const isCardBox =
      !el.hasAttribute('data-allow-vertical-spacer') &&
      (borderRad >= 4 || borderTopW >= 1 || hasBg) &&
      rect.width >= 160 * scaleRef &&
      rect.width <= vw * 0.92 &&
      rect.height >= 220 * scaleRef &&
      rect.height <= vh * 0.9;

    if (
      isCardBox &&
      cs.display.indexOf('flex') !== -1 &&
      cs.flexDirection.indexOf('column') === 0
    ) {
      const childRects: Array<{ top: number; bottom: number }> = [];
      const absVisualRects: Array<{ top: number; bottom: number }> = [];
      for (let c = 0; c < el.children.length; c++) {
        const ch = el.children[c] as HTMLElement;
        const chStyle = window.getComputedStyle(ch);
        if (
          chStyle.display === 'none' ||
          chStyle.visibility === 'hidden' ||
          chStyle.position === 'fixed'
        ) {
          continue;
        }
        const chOp = parseFloat(chStyle.opacity);
        if (Number.isFinite(chOp) && chOp < 0.85) continue;
        const cr = ch.getBoundingClientRect();
        if (cr.height < 4 || cr.width < 4) continue;

        if (chStyle.position === 'absolute') {
          const isSurfaceChrome =
            ch.hasAttribute('data-clipped-surface-chrome') ||
            (cr.width >= rect.width * 0.92 && cr.height >= rect.height * 0.92);
          if (!isSurfaceChrome) {
            absVisualRects.push({ top: cr.top, bottom: cr.bottom });
          }
          continue;
        }

        childRects.push({ top: cr.top, bottom: cr.bottom });
      }

      if (childRects.length >= 2) {
        const allBands = childRects.concat(absVisualRects);
        allBands.sort((a, b) => a.top - b.top);
        let maxGap = 0;
        let maxReachBottom = allBands[0]!.bottom;
        for (let g = 1; g < allBands.length; g++) {
          const band = allBands[g]!;
          const gap = band.top - maxReachBottom;
          if (gap > maxGap) maxGap = gap;
          if (band.bottom > maxReachBottom) {
            maxReachBottom = band.bottom;
          }
        }
        if (
          maxGap > rect.height * 0.42 &&
          maxGap > 140 * scaleRef &&
          issues.length < 6
        ) {
          const preview = (el.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 48);
          issues.push({
            code: 'CARD_VERTICAL_VOID',
            snippet: preview,
            message: `Card "${preview}" has a ${Math.round(maxGap)}px vertical empty void (${Math.round((maxGap / rect.height) * 100)}% of ${Math.round(rect.height)}px card height > 42% limit). Use height: 'auto' + justifyContent: 'center' (or <HorizontalFeatureGrid2x2 />) instead of stretching sparse text with justifyContent: 'space-between'.`,
          });
        }
      }
    }
  }

  return issues;
}

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

/**
 * Discovers a neighboring `generated/audio-manifest.ts` or `audio.json` next to a composition
 * source file (or its parent directory). Returns `null` for standard Remotion compositions without audio specs.
 */
export function discoverNeighborAudioManifest(
  compFilePath: string
): string | null {
  const absComp = path.resolve(compFilePath);
  const compDir = path.dirname(absComp);
  const parentDir = path.dirname(compDir);

  const candidates = [
    path.join(compDir, 'generated', 'audio-manifest.ts'),
    path.join(compDir, 'audio.json'),
  ];

  // Only inspect parentDir if compDir looks like a nested subfolder (e.g. `compositions/`)
  if (path.basename(compDir) === 'compositions') {
    candidates.push(
      path.join(parentDir, 'generated', 'audio-manifest.ts'),
      path.join(parentDir, 'audio.json')
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

interface DerivedAudioTimeline {
  fps?: number;
  sceneTimeline?: Array<QaTimelineSegmentHint & { sceneId: string }>;
  voiceoverManifest?: Record<string, AuditVoiceoverEntry | undefined>;
}

export function readVoiceoverManifestLiteral(
  tsFilePath: string
): Record<string, AuditVoiceoverEntry | undefined> | undefined {
  if (!fs.existsSync(tsFilePath)) return undefined;
  try {
    const raw = fs.readFileSync(tsFilePath, 'utf8');
    const marker = /export\s+const\s+VOICEOVER_MANIFEST(?:\s*:[^=]+)?\s*=\s*\{/.exec(
      raw
    );
    if (!marker || marker.index === undefined) return undefined;
    const startIdx = marker.index + marker[0].lastIndexOf('{');
    const endIdx = readBalancedBraceEnd(raw, startIdx);
    if (endIdx === -1) return undefined;
    const parsed = JSON.parse(raw.slice(startIdx, endIdx + 1));
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, AuditVoiceoverEntry | undefined>)
      : undefined;
  } catch {
    return undefined;
  }
}

function deriveTimelineFromAudioManifest(
  audioPath: string | null,
  fallbackFps: number
): DerivedAudioTimeline {
  if (!audioPath || !fs.existsSync(audioPath)) {
    return {};
  }

  let audioJsonPath: string | null = null;
  let audioTsPath: string | null = null;

  if (audioPath.endsWith('.json')) {
    audioJsonPath = audioPath;
    const candidateTs = path.join(
      path.dirname(audioPath),
      'generated',
      'audio-manifest.ts'
    );
    if (fs.existsSync(candidateTs)) audioTsPath = candidateTs;
  } else if (audioPath.endsWith('.ts')) {
    audioTsPath = audioPath;
    const baseDir =
      path.basename(path.dirname(audioPath)) === 'generated'
        ? path.dirname(path.dirname(audioPath))
        : path.dirname(audioPath);
    const candidateJson = path.join(baseDir, 'audio.json');
    if (fs.existsSync(candidateJson)) audioJsonPath = candidateJson;
  }

  const voiceoverManifest = audioTsPath
    ? readVoiceoverManifestLiteral(audioTsPath)
    : undefined;

  if (!audioJsonPath) {
    return { voiceoverManifest };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(audioJsonPath, 'utf8')) as {
      fps?: number;
      scenes?: Array<{
        id: string;
        durationInFrames?: number;
        durationInSeconds?: number;
      }>;
    };
    const fps = manifest.fps ?? fallbackFps;
    if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
      return { fps, voiceoverManifest };
    }

    const preSettle = Math.round(0.7 * fps);
    const postHold = Math.round(1.6 * fps);
    const minSpan = Math.round(4.5 * fps);
    let sceneStart = 0;
    const sceneTimeline = manifest.scenes.map((s, idx) => {
      const voSec = voiceoverManifest?.[s.id]?.durationInSeconds;
      const dur =
        typeof voSec === 'number' && voSec > 0
          ? Math.round(voSec * fps)
          : s.durationInFrames ?? Math.round((s.durationInSeconds ?? 4) * fps);
      const isFinal = idx === (manifest.scenes?.length ?? 1) - 1;
      const tailHold = isFinal ? Math.round(2.4 * fps) : postHold;
      const seg = {
        sceneId: s.id,
        fromFrame: sceneStart + preSettle,
        durationInFrames: dur,
      };
      sceneStart += Math.max(minSpan, preSettle + dur + tailHold);
      return seg;
    });

    return { fps, sceneTimeline, voiceoverManifest };
  } catch {
    return { voiceoverManifest };
  }
}

function logAllowedFastCutWarnings(
  rootDir: string,
  violations: ReadonlyArray<{
    code: string;
    message: string;
    filePath?: string;
    line?: number;
  }>
): void {
  for (const v of violations) {
    const loc = v.filePath
      ? ` ${path.relative(rootDir, v.filePath)}${v.line ? `:${v.line}` : ''} —`
      : '';
    console.warn(
      `  ⚠️  [Director QA Gate --allow-fast-cuts] [${v.code}]${loc} ${v.message}`
    );
  }
}

/**
 * Generates a high-signal multi-frame QA Contact Sheet (`--grid=auto` by default, guaranteeing
 * 100% scene and sub-view coverage), starting at `frame = 0`, drawing frame & scene/sub-view
 * badges (`f=0`, `f=490 (8.17s) • s2/view-a`, ...) and for vertical `9:16` Shorts compositions
 * drawing the green `Golden Safe Box` (`x=40..910, y=220..1380`) plus red UI dead-zone overlays.
 *
 * Works natively on any standard Remotion project via `@remotion/bundler` + `@remotion/renderer`
 * `selectComposition()` / `renderStill()`, with optional `audio.json` discovery.
 */
export async function runQaContactSheetCommand(
  options: QaContactSheetOptions
): Promise<QaContactSheetResult> {
  const { rootDir, studioDir, isEngineMonorepo } = resolveWorkspaceContext({
    cwd: options.cwd ?? options.rootDir,
    dir: options.dir,
  });
  const config = loadMakePicturesConfig(studioDir, rootDir);

  const { compositionId } = options;
  const isAutoGrid =
    !options.grid || options.grid.trim().toLowerCase() === 'auto';

  const resolvedOutPath = options.outPath
    ? path.resolve(rootDir, options.outPath)
    : path.resolve(studioDir, 'out', `qa-${compositionId}.png`);
  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });

  const entryPoint = resolveRemotionEntryPoint({
    rootDir,
    studioDir,
    explicitEntry: options.entryPoint,
  });

  const entryDir = path.dirname(entryPoint);
  const rootFilePath =
    [
      path.join(entryDir, 'Root.tsx'),
      path.join(entryDir, 'Root.ts'),
      entryPoint,
    ].find((p) => fs.existsSync(p)) ?? entryPoint;

  const sourceFile = resolveCompositionSourceFromRoot(
    rootFilePath,
    compositionId
  );
  const resolvedAudioPath = options.audioManifestPath
    ? path.resolve(rootDir, options.audioManifestPath)
    : sourceFile
      ? discoverNeighborAudioManifest(sourceFile)
      : null;

  const derivedAudio = deriveTimelineFromAudioManifest(
    resolvedAudioPath,
    config.fps
  );
  const isExampleOrigin = Boolean(
    sourceFile && sourceFile.replace(/\\/g, '/').includes('/examples/')
  );

  const publicDir = path.resolve(studioDir, config.publicDir);
  fs.mkdirSync(publicDir, { recursive: true });

  const useAngleGl =
    options.glAngle ??
    detectCompositionUsesThree(studioDir, entryPoint, compositionId);

  const previewGrid = resolveQaGridDimensions(
    options.grid,
    derivedAudio.sceneTimeline
      ? derivedAudio.sceneTimeline.length + 2
      : 12
  );

  console.log('==============================================================');
  console.log(
    ` 🔍 make.pictures — Contact-Sheet QA (${compositionId} • ${
      isAutoGrid
        ? `auto ${previewGrid.cols}x${previewGrid.rows}`
        : `${previewGrid.cols}x${previewGrid.rows}`
    })`
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

  // Fast-fail static AST/JSX Director QA Gate BEFORE bundling or launching Chromium
  const preAudit = auditCompositionDirection({
    studioDir,
    rootDir,
    compositionId,
    origin: isExampleOrigin ? 'example' : 'production',
    sourceFile: sourceFile ?? undefined,
    audioManifestPath: resolvedAudioPath ?? undefined,
    durationInFrames: options.durationOverride,
    fps: derivedAudio.fps ?? config.fps,
    sceneTimeline: derivedAudio.sceneTimeline,
    voiceoverManifest: derivedAudio.voiceoverManifest,
    inputProps: options.inputProps,
    allowFastCuts: options.allowFastCuts,
  });
  if (preAudit.violations.length > 0 && options.allowFastCuts) {
    logAllowedFastCutWarnings(rootDir, preAudit.violations);
  }

  // Fail fast with actionable messages if Remotion or FFmpeg are missing before bundling
  assertRemotionInstalled(rootDir, [
    'remotion',
    '@remotion/bundler',
    '@remotion/renderer',
  ]);
  assertFfmpegInstalled('QA contact-sheet generation');

  const tempWorkDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-qa-')
  );
  let bundleDir: string | null = null;
  let browser: Awaited<ReturnType<typeof RemotionRendererMod.openBrowser>> | null = null;

  try {
    const workspaceRequire = createRequire(path.join(rootDir, 'package.json'));
    const bundlerUrl = pathToFileURL(
      workspaceRequire.resolve('@remotion/bundler')
    ).href;
    const rendererUrl = pathToFileURL(
      workspaceRequire.resolve('@remotion/renderer')
    ).href;
    const [{ bundle }, { openBrowser, renderStill, selectComposition }] =
      (await Promise.all([import(bundlerUrl), import(rendererUrl)])) as [
        typeof RemotionBundlerMod,
        typeof RemotionRendererMod,
      ];

    console.log(
      `  [1/3] Bundling Remotion entry (${path.relative(rootDir, entryPoint)})…`
    );

    bundleDir = await bundle({
      entryPoint,
      publicDir,
      webpackOverride: (currentConfiguration) => {
        if (!isEngineMonorepo) {
          return currentConfiguration;
        }
        return {
          ...currentConfiguration,
          resolve: {
            ...currentConfiguration.resolve,
            alias: {
              ...(currentConfiguration.resolve?.alias ?? {}),
              '@make-pictures/remotion': path.resolve(
                rootDir,
                'packages/remotion/src'
              ),
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

    // Re-run duration-aware Director QA Gate with exact Remotion selectComposition() metadata
    if (
      options.durationOverride === undefined &&
      derivedAudio.sceneTimeline &&
      derivedAudio.sceneTimeline.length > 0
    ) {
      const fullAudit = auditCompositionDirection({
        studioDir,
        rootDir,
        compositionId,
        origin: isExampleOrigin ? 'example' : 'production',
        sourceFile: sourceFile ?? undefined,
        audioManifestPath: resolvedAudioPath ?? undefined,
        durationInFrames: totalFrames,
        fps,
        sceneTimeline: derivedAudio.sceneTimeline,
        voiceoverManifest: derivedAudio.voiceoverManifest,
        inputProps: options.inputProps,
        allowFastCuts: options.allowFastCuts,
      });
      if (fullAudit.violations.length > 0 && options.allowFastCuts) {
        logAllowedFastCutWarnings(rootDir, fullAudit.violations);
      }
    }

    const mandatoryPoints = collectMandatoryQaSamplePoints(
      totalFrames,
      derivedAudio.sceneTimeline
    );
    const { cols, rows } = resolveQaGridDimensions(
      options.grid,
      mandatoryPoints.length
    );
    const tileCount = cols * rows;

    const frames = selectQaSampleFrames(
      totalFrames,
      isAutoGrid ? undefined : tileCount,
      derivedAudio.sceneTimeline
    );

    const tagByFrame = new Map<number, string>();
    for (const mp of mandatoryPoints) {
      if (mp.tag) {
        tagByFrame.set(mp.frame, mp.tag);
      }
    }
    if (derivedAudio.sceneTimeline && derivedAudio.sceneTimeline.length > 0) {
      const sortedSegs = [...derivedAudio.sceneTimeline].sort(
        (a, b) => a.fromFrame - b.fromFrame
      );
      for (const f of frames) {
        if (f === 0 || tagByFrame.has(f)) continue;
        for (let sIdx = sortedSegs.length - 1; sIdx >= 0; sIdx--) {
          const seg = sortedSegs[sIdx]!;
          if (f >= seg.fromFrame || sIdx === 0) {
            tagByFrame.set(f, seg.sceneId);
            break;
          }
        }
      }
    }

    console.log(
      `  [2/3] Rendering ${frames.length} key frames (${cols}x${rows} • ${width}x${height} @ ${fps}fps${
        isVertical ? ' • 9:16 Safe-Box Overlay' : ''
      }): [${frames.join(', ')}]…`
    );

    const tilePaths: string[] = [];
    const tileContentW = isVertical ? 340 : 480;
    const tileContentH = Math.max(
      2,
      Math.round((tileContentW * height) / width / 2) * 2
    );

    // Intercept still page teardown so Chromium DOM checks run at exact rendered frame with zero extra renders
    let activeStillFrame: number | null = null;
    let capturedF0Dom: ReturnType<typeof auditFrameZeroDomInPage> | null = null;
    let capturedDomIssues: RenderedDomAuditIssue[] = [];
    const origNewPage = browser.newPage.bind(browser);
    browser.newPage = async (newPageOpts) => {
      const page = await origNewPage(newPageOpts);
      const origClose = page.close.bind(page);
      page.close = async (closeOpts) => {
        try {
          if (activeStillFrame === 0) {
            capturedF0Dom = await page.evaluate(auditFrameZeroDomInPage);
          } else if (
            typeof activeStillFrame === 'number' &&
            activeStillFrame > 0 &&
            !isExampleOrigin
          ) {
            capturedDomIssues = await page.evaluate(
              auditRenderedFrameDomInPage,
              width,
              height
            );
          }
        } catch {
          // Ignore evaluation errors if page aborted; renderStill surfaces rendering failures directly
        }
        return origClose(closeOpts);
      };
      return page;
    };

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]!;
      const rawStillPath = path.join(tempWorkDir, `raw-${i}.png`);
      const annotatedTilePath = path.join(tempWorkDir, `tile-${i}.png`);
      const badgePamPath = path.join(tempWorkDir, `badge-${i}.pam`);

      activeStillFrame = frame;
      capturedF0Dom = null;
      capturedDomIssues = [];

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

      activeStillFrame = null;

      if (frame === 0) {
        const f0Check = verifyCleanFrameZeroImage(rawStillPath);
        if (!f0Check.clean) {
          throw new DirectorAuditError(
            compositionId,
            [
              {
                code: 'DIRTY_FRAME_ZERO',
                rule: 'CLEAN_FRAME_ZERO',
                message: `Rendered Frame 0 is not a uniform solid bgCanvas background (max RGB channel spread = ${f0Check.maxChannelSpread}, variance = ${f0Check.maxChannelVariance}; spreads R=${f0Check.channelSpreads.r}, G=${f0Check.channelSpreads.g}, B=${f0Check.channelSpreads.b}). Ensure all foreground elements start at frame >= 2 (opacity: 0 on frame 0) and backdrops render pure solid palette.bgCanvas at frame 0.`,
              },
            ],
            rootDir
          );
        }

        const f0Dom = capturedF0Dom as ReturnType<
          typeof auditFrameZeroDomInPage
        > | null;
        if (f0Dom && !f0Dom.clean) {
          throw new DirectorAuditError(
            compositionId,
            [
              {
                code: 'DIRTY_FRAME_ZERO',
                rule: 'CLEAN_FRAME_ZERO',
                message: `Frame 0 DOM mounts visible foreground nodes (${f0Dom.offendingElements.join(', ')}). Keep Frame 0 completely empty (opacity: 0 on all foreground cards/text/media until frame >= 2).`,
              },
            ],
            rootDir
          );
        }
      } else if (capturedDomIssues.length > 0 && !isExampleOrigin) {
        const domViolations: DirectorAuditViolation[] = capturedDomIssues.map(
          (issue) => ({
            code: issue.code,
            rule:
              issue.code === 'FONT_BELOW_1080P_FLOOR'
                ? 'TYPOGRAPHY_FLOOR_1080P'
                : 'CARD_VERTICAL_DENSITY',
            snippet: issue.snippet,
            message: `[frame=${frame}] ${issue.message}`,
          })
        );
        if (options.allowFastCuts) {
          logAllowedFastCutWarnings(rootDir, domViolations);
        } else {
          throw new DirectorAuditError(compositionId, domViolations, rootDir);
        }
      }

      const secStr = (frame / fps).toFixed(2);
      const rawTag = tagByFrame.get(frame);
      const maxTagLen = isVertical ? 12 : 20;
      const cleanTag = rawTag
        ? rawTag.length > maxTagLen
          ? rawTag.slice(0, maxTagLen)
          : rawTag
        : '';
      const badgeLabel =
        isVertical && i === 0
          ? `f=${frame} (${secStr}s) SAFE 9:16`
          : cleanTag
            ? `f=${frame} (${secStr}s) • ${cleanTag}`
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

    const gridFilter =
      tilePaths.length === 1
        ? '[0:v]null[grid]'
        : `${inputTags.join('')}xstack=inputs=${
            tilePaths.length
          }:layout=${layoutTokens
            .slice(0, tilePaths.length)
            .join('|')}[grid]`;
    const filterComplex = `${gridFilter};[grid]pad=iw:ih+50:0:50:color=0x090D16[sheet];[sheet][${headerIdx}:v]overlay=12:9[final]`;

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
