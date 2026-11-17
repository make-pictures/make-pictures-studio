import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  blankCommentsPreservingNewlines,
  blankStringsAndCommentsPreservingNewlines,
  lineNumberAtOffset,
  readJsxOpeningTagEnd,
} from '../utils/jsx-source-scan';

export type DirectorAuditRuleCode =
  | 'MIN_SCENE_SPAN'
  | 'COMPETING_FOCAL_POINT'
  | 'READING_CADENCE_OVER_BUDGET'
  | 'INSUFFICIENT_BREATHING_ROOM'
  | 'EXCESSIVE_SUBVIEWS'
  | 'CHOPPY_SCENE_TRANSITION'
  | 'UNCLIPPED_CARD_BAR'
  | 'DIRTY_FRAME_ZERO'
  | 'RAW_HTML_IMG_TAG'
  | 'FONT_BELOW_1080P_FLOOR'
  | 'CARD_VERTICAL_VOID';

export interface DirectorAuditViolation {
  code: DirectorAuditRuleCode;
  rule: string;
  message: string;
  filePath?: string;
  line?: number;
  snippet?: string;
}

export interface DirectorAuditResult {
  ok: boolean;
  compositionId: string;
  origin: 'example' | 'production';
  capsuleDir: string | null;
  inspectedFiles: string[];
  violations: DirectorAuditViolation[];
}

export interface AuditSubViewSegment {
  id?: string;
  fromOffsetFrames: number;
  label?: string;
}

export interface AuditSceneSegment {
  sceneId: string;
  fromFrame: number;
  durationInFrames: number;
  label?: string;
  subViews?: ReadonlyArray<AuditSubViewSegment>;
}

export interface AuditVoiceoverEntry {
  sceneId?: string;
  durationInSeconds?: number;
  fps?: number;
  text?: string;
}

export interface AuditDirectionParams {
  studioDir: string;
  rootDir?: string;
  compositionId: string;
  origin?: 'example' | 'production';
  productionId?: string;
  capsuleDir?: string;
  propsFile?: string;
  durationInFrames?: number;
  fps?: number;
  sceneTimeline?: ReadonlyArray<AuditSceneSegment>;
  voiceoverManifest?: Record<string, AuditVoiceoverEntry | undefined>;
  inputProps?: Record<string, unknown>;
  allowFastCuts?: boolean;
  throwOnViolation?: boolean;
}

export interface CleanFrameZeroResult {
  clean: boolean;
  maxChannelSpread: number;
  maxChannelVariance: number;
  channelSpreads: {
    r: number;
    g: number;
    b: number;
  };
  channelVariances: {
    r: number;
    g: number;
    b: number;
  };
}

export function formatDirectorAuditReport(
  compositionId: string,
  violations: ReadonlyArray<DirectorAuditViolation>,
  rootDir?: string
): string {
  const lines: string[] = [
    `Director QA Gate failed for "${compositionId}" (${violations.length} violation${
      violations.length === 1 ? '' : 's'
    }):`,
  ];

  violations.forEach((v, idx) => {
    const loc = v.filePath
      ? ` (${
          rootDir ? path.relative(rootDir, v.filePath) : v.filePath
        }${v.line ? `:${v.line}` : ''})`
      : '';
    lines.push(`  ${idx + 1}. [${v.code}]${loc} ${v.message}`);
    if (v.snippet) {
      lines.push(`     ↳ ${v.snippet}`);
    }
  });

  lines.push(
    '  Fix the pacing/geometry issues above (recommended: <ContinuousSceneFlow>, >= 4.5s scenes, <= 2.8 words/s, <ClippedSurfaceChrome>), or pass --allow-fast-cuts only for intentional exceptions.'
  );

  return lines.join('\n');
}

export class DirectorAuditError extends Error {
  public readonly compositionId: string;
  public readonly violations: DirectorAuditViolation[];

  constructor(
    compositionId: string,
    violations: DirectorAuditViolation[],
    rootDir?: string
  ) {
    super(formatDirectorAuditReport(compositionId, violations, rootDir));
    this.name = 'DirectorAuditError';
    this.compositionId = compositionId;
    this.violations = violations;
  }
}

function toKebabSlug(compId: string): string {
  return compId
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
}

function readBalancedBraceEnd(
  cleaned: string,
  openBraceOffset: number
): number {
  if (cleaned[openBraceOffset] !== '{') return -1;
  let depth = 0;
  let i = openBraceOffset;
  const len = cleaned.length;

  while (i < len) {
    const ch = cleaned[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < len) {
        if (cleaned[i] === '\\') {
          i += 2;
          continue;
        }
        if (cleaned[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
    i += 1;
  }

  return -1;
}

const SKIP_SCAN_DIRS = new Set([
  'node_modules',
  'dist',
  'out',
  'assets',
  'generated',
  '__tests__',
]);

function collectTsxFilesRecursive(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const stat = fs.statSync(dirPath);
  if (stat.isFile()) {
    return dirPath.endsWith('.tsx') ? [dirPath] : [];
  }

  const found: string[] = [];
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_SCAN_DIRS.has(entry.name)) continue;
      found.push(...collectTsxFilesRecursive(full));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.tsx') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.spec.tsx')
    ) {
      found.push(full);
    }
  }

  return found;
}

function inferOrigin(params: AuditDirectionParams): 'example' | 'production' {
  if (params.origin === 'example' || params.origin === 'production') {
    return params.origin;
  }
  const normalizedProps = (params.propsFile ?? '').replace(/\\/g, '/');
  const normalizedCapsule = (params.capsuleDir ?? '').replace(/\\/g, '/');
  if (
    normalizedProps.startsWith('examples/') ||
    normalizedProps.includes('/examples/') ||
    normalizedCapsule.startsWith('examples/') ||
    normalizedCapsule.includes('/examples/')
  ) {
    return 'example';
  }
  return 'production';
}

function resolveTargetCapsuleDir(
  params: AuditDirectionParams,
  origin: 'example' | 'production'
): string | null {
  const studioDir = path.resolve(params.studioDir);
  const rootDir = path.resolve(params.rootDir ?? params.studioDir);

  if (params.capsuleDir) {
    return path.resolve(studioDir, params.capsuleDir);
  }

  if (params.propsFile) {
    const candidateInStudio = path.resolve(studioDir, params.propsFile);
    const candidateInRoot = path.resolve(rootDir, params.propsFile);
    const resolvedProps = fs.existsSync(candidateInStudio)
      ? candidateInStudio
      : fs.existsSync(candidateInRoot)
        ? candidateInRoot
        : candidateInStudio;
    const propsDir = path.dirname(resolvedProps);
    return path.basename(propsDir) === 'compositions'
      ? path.dirname(propsDir)
      : propsDir;
  }

  if (params.productionId) {
    const baseFolder = origin === 'example' ? 'examples' : 'productions';
    const byProdId = path.join(studioDir, baseFolder, params.productionId);
    if (fs.existsSync(byProdId)) {
      return byProdId;
    }
  }

  const slug = toKebabSlug(params.compositionId);
  const bySlug = path.join(
    studioDir,
    origin === 'example' ? 'examples' : 'productions',
    slug
  );
  if (fs.existsSync(bySlug)) {
    return bySlug;
  }

  const fallbackProds = path.join(studioDir, 'productions');
  return fs.existsSync(fallbackProds) ? fallbackProds : null;
}

function loadMergedPropsJson(params: AuditDirectionParams): Record<string, unknown> {
  const studioDir = path.resolve(params.studioDir);
  const rootDir = path.resolve(params.rootDir ?? params.studioDir);
  let diskProps: Record<string, unknown> = {};

  if (params.propsFile) {
    for (const candidate of [
      path.resolve(studioDir, params.propsFile),
      path.resolve(rootDir, params.propsFile),
    ]) {
      if (fs.existsSync(candidate)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
          if (parsed && typeof parsed === 'object') {
            diskProps = parsed as Record<string, unknown>;
          }
        } catch {
          // ignore invalid JSON
        }
        break;
      }
    }
  }

  return { ...diskProps, ...(params.inputProps ?? {}) };
}

function extractNumericConstMap(cleaned: string): Map<string, number> {
  const map = new Map<string, number>();
  const constRe =
    /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*(\d+(?:\.\d+)?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = constRe.exec(cleaned)) !== null) {
    map.set(m[1], Number(m[2]));
  }

  // Also resolve `const t1 = computeSceneTimingFromVoiceover(...)` -> `t1.durationInFrames`
  const timingHelperRe =
    /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*computeSceneTimingFromVoiceover\s*\(([\s\S]{0,280}?)\)/g;
  while ((m = timingHelperRe.exec(cleaned)) !== null) {
    const ident = m[1]!;
    const argsText = m[2]!;
    const fpsArg = argsText.match(/\bfps\s*:\s*(\d+(?:\.\d+)?)/);
    const fps = fpsArg ? Number(fpsArg[1]) : 60;
    const minDurArg = argsText.match(
      /\bminDurationSeconds\s*:\s*(\d+(?:\.\d+)?)/
    );
    const minFrames = Math.round((minDurArg ? Number(minDurArg[1]) : 4.5) * fps);
    const isFinal = /\bisFinalScene\s*:\s*true\b/.test(argsText);
    const preSecArg = argsText.match(
      /\bpreSettleSeconds\s*:\s*(\d+(?:\.\d+)?)/
    );
    const postSecArg = argsText.match(
      /\bpostHoldSeconds\s*:\s*(\d+(?:\.\d+)?)/
    );
    const preF = Math.round((preSecArg ? Number(preSecArg[1]) : 0.7) * fps);
    const postF = Math.round(
      (postSecArg ? Number(postSecArg[1]) : isFinal ? 2.4 : 1.6) * fps
    );
    const literalVo = argsText.trim().match(/^(\d+(?:\.\d+)?)\b/);
    const fallbackVo = argsText.match(/\?\?\s*(\d+(?:\.\d+)?)/);
    const voSec = literalVo
      ? Number(literalVo[1])
      : fallbackVo
        ? Number(fallbackVo[1])
        : 0;
    const voF = voSec > 0 ? Math.ceil(Math.max(0, voSec * fps - 1e-9)) : 0;
    const resolvedDuration = Math.max(minFrames, preF + voF + postF);

    map.set(`${ident}.durationInFrames`, resolvedDuration);
    map.set(`${ident}.voiceoverStartFrame`, preF);
  }

  return map;
}

function parseDurationAttrValue(
  cleanedTag: string,
  constMap?: Map<string, number>
): { isNumericLiteral: boolean; value: number | null } {
  const numLit = cleanedTag.match(
    /\bdurationInFrames\s*=\s*(?:\{\s*(\d+(?:\.\d+)?)\s*\}|["'](\d+(?:\.\d+)?)["'])/
  );
  if (numLit) {
    const raw = numLit[1] ?? numLit[2];
    return { isNumericLiteral: true, value: Number(raw) };
  }

  if (constMap) {
    const identMatch = cleanedTag.match(
      /\bdurationInFrames\s*=\s*\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}/
    );
    if (identMatch && constMap.has(identMatch[1])) {
      return {
        isNumericLiteral: false,
        value: constMap.get(identMatch[1]) ?? null,
      };
    }
  }

  return { isNumericLiteral: false, value: null };
}

function hasLayoutNoneAttr(cleanedTag: string): boolean {
  return /\blayout\s*=\s*(?:["']none["']|\{\s*["']none["']\s*\})/.test(
    cleanedTag
  );
}

/**
 * Rule 1B: Scans a TSX file for visual `<Sequence ... durationInFrames={N}>` tags
 * without `layout="none"` where `N` is a numeric literal `< minSceneFrames`.
 */
export function scanTsxForShortVisualSequences(
  source: string,
  filePath: string,
  fps = 60
): DirectorAuditViolation[] {
  const minSceneFrames = Math.round(4.5 * fps);
  const cleaned = blankCommentsPreservingNewlines(source);
  const violations: DirectorAuditViolation[] = [];

  const seqRegex = /<Sequence(?=[\s>/])/g;
  let match: RegExpExecArray | null;

  while ((match = seqRegex.exec(cleaned)) !== null) {
    const offset = match.index;
    const tagEnd = readJsxOpeningTagEnd(cleaned, offset);
    if (tagEnd === -1) continue;

    const cleanedTag = cleaned.slice(offset, tagEnd + 1);
    const rawTag = source.slice(offset, tagEnd + 1);
    seqRegex.lastIndex = tagEnd + 1;

    if (hasLayoutNoneAttr(cleanedTag)) {
      continue;
    }

    const parsedDur = parseDurationAttrValue(cleanedTag);
    if (
      parsedDur.isNumericLiteral &&
      parsedDur.value !== null &&
      parsedDur.value < minSceneFrames
    ) {
      const sec = (parsedDur.value / fps).toFixed(2);
      violations.push({
        code: 'MIN_SCENE_SPAN',
        rule: 'MIN_SCENE_SPAN',
        filePath,
        line: lineNumberAtOffset(source, offset),
        snippet: rawTag.replace(/\s+/g, ' ').trim(),
        message: `Visual <Sequence durationInFrames={${parsedDur.value}}> (${sec}s) is shorter than the 4.50s (${minSceneFrames}f @ ${fps} FPS) Director Pacing minimum. Compose calm scenes >= 4.5s with <ContinuousSceneFlow> (or add layout="none" for non-visual audio tracks).`,
      });
    }
  }

  return violations;
}

interface EnclosingSequenceRange {
  id: number;
  startOffset: number;
  endOffset: number;
  durationFrames: number | null;
}

function collectVisualSequenceRanges(
  cleaned: string,
  constMap: Map<string, number>
): EnclosingSequenceRange[] {
  const ranges: EnclosingSequenceRange[] = [];
  const stack: Array<{
    id: number;
    startOffset: number;
    durationFrames: number | null;
    isVisual: boolean;
  }> = [];
  let nextId = 1;

  const tokenRe = /<\/Sequence\s*>|<Sequence(?=[\s>/])/g;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(cleaned)) !== null) {
    const token = m[0];
    const offset = m.index;

    if (token.startsWith('</Sequence')) {
      const popped = stack.pop();
      if (popped && popped.isVisual) {
        ranges.push({
          id: popped.id,
          startOffset: popped.startOffset,
          endOffset: offset + token.length,
          durationFrames: popped.durationFrames,
        });
      }
      continue;
    }

    const tagEnd = readJsxOpeningTagEnd(cleaned, offset);
    if (tagEnd === -1) continue;
    const cleanedTag = cleaned.slice(offset, tagEnd + 1);
    tokenRe.lastIndex = tagEnd + 1;

    if (/\/\s*>$/.test(cleanedTag)) {
      continue;
    }

    const isVisual = !hasLayoutNoneAttr(cleanedTag);
    const dur = parseDurationAttrValue(cleanedTag, constMap).value;
    stack.push({
      id: nextId++,
      startOffset: offset,
      durationFrames: dur,
      isVisual,
    });
  }

  return ranges;
}

function isDisabledByFalsePropGuard(
  cleaned: string,
  tagOffset: number,
  effectiveProps: Record<string, unknown>
): boolean {
  const lookbehind = cleaned.slice(Math.max(0, tagOffset - 160), tagOffset);
  const guardMatch = lookbehind.match(
    /\bprops\.([A-Za-z_$][A-Za-z0-9_$]*)\s*&&\s*\(?\s*$/
  );
  if (!guardMatch) return false;
  const propName = guardMatch[1];
  return effectiveProps[propName] === false;
}

function splitTopLevelComponentRanges(
  cleaned: string
): Array<{ start: number; end: number }> {
  const declRe =
    /(?:^|\n)\s*(?:export\s+)?(?:const|function)\s+[A-Z][A-Za-z0-9_$]*\b/g;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(cleaned)) !== null) {
    starts.push(m.index);
  }
  if (starts.length === 0) {
    return [{ start: 0, end: cleaned.length }];
  }
  const ranges: Array<{ start: number; end: number }> = [];
  if (starts[0] > 0) {
    ranges.push({ start: 0, end: starts[0] });
  }
  for (let i = 0; i < starts.length; i++) {
    ranges.push({
      start: starts[i],
      end: i + 1 < starts.length ? starts[i + 1] : cleaned.length,
    });
  }
  return ranges;
}

function hasValidContinuousSceneFlowSeparation(
  cleaned: string,
  wordOffsets: number[],
  cardOffsets: number[],
  minSceneFrames: number,
  constMap: Map<string, number>
): boolean {
  if (!/<ContinuousSceneFlow(?=[\s>/])/.test(cleaned)) {
    return false;
  }

  // Extract `durationInFrames: <numOrIdent>` from ContinuousSceneFlow scene specs
  // (ignoring `{ sceneId: ..., fromFrame: ..., durationInFrames: ... }` audio dialogue segments)
  const sceneObjRe = /\bdurationInFrames\s*:\s*([A-Za-z0-9_$.]+)/g;
  const sceneDurations: number[] = [];
  let dm: RegExpExecArray | null;
  while ((dm = sceneObjRe.exec(cleaned)) !== null) {
    const lookback = cleaned.slice(Math.max(0, dm.index - 140), dm.index);
    if (/\bsceneId\s*:/.test(lookback)) {
      continue;
    }
    const raw = dm[1];
    const num = /^\d+(?:\.\d+)?$/.test(raw)
      ? Number(raw)
      : (constMap.get(raw) ?? NaN);
    if (Number.isFinite(num)) {
      sceneDurations.push(num);
    }
  }

  if (
    sceneDurations.length < 2 ||
    sceneDurations.some((d) => d < minSceneFrames)
  ) {
    return false;
  }

  // Ensure no single top-level component declaration or inline `{ id: ..., render: () => ... }` block mixes both
  const compRanges = splitTopLevelComponentRanges(cleaned);
  for (const r of compRanges) {
    const hasWord = wordOffsets.some((o) => o >= r.start && o < r.end);
    const hasCard = cardOffsets.some((o) => o >= r.start && o < r.end);
    if (hasWord && hasCard) {
      // Only valid if they sit inside distinct inline `{ ... render: ... }` object literals inside `scenes={[ ... ]}`
      const slice = cleaned.slice(r.start, r.end);
      const inlineRenderBlocks: Array<{ absStart: number; absEnd: number }> = [];
      const objPropRe = /\brender\s*:\s*\(\s*\)\s*=>/g;
      let rm: RegExpExecArray | null;
      while ((rm = objPropRe.exec(slice)) !== null) {
        // Find enclosing `{ ... }` scene spec object
        let openIdx = rm.index;
        while (openIdx >= 0 && slice[openIdx] !== '{') {
          openIdx -= 1;
        }
        if (openIdx >= 0) {
          const closeIdx = readBalancedBraceEnd(slice, openIdx);
          if (closeIdx !== -1) {
            inlineRenderBlocks.push({
              absStart: r.start + openIdx,
              absEnd: r.start + closeIdx + 1,
            });
          }
        }
      }

      if (inlineRenderBlocks.length < 2) {
        return false;
      }

      const allWordsInSceneObj = wordOffsets
        .filter((o) => o >= r.start && o < r.end)
        .every((o) =>
          inlineRenderBlocks.some((b) => o >= b.absStart && o < b.absEnd)
        );
      const allCardsInSceneObj = cardOffsets
        .filter((o) => o >= r.start && o < r.end)
        .every((o) =>
          inlineRenderBlocks.some((b) => o >= b.absStart && o < b.absEnd)
        );
      if (!allWordsInSceneObj || !allCardsInSceneObj) {
        return false;
      }

      for (const b of inlineRenderBlocks) {
        const wInB = wordOffsets.some((o) => o >= b.absStart && o < b.absEnd);
        const cInB = cardOffsets.some((o) => o >= b.absStart && o < b.absEnd);
        if (wInB && cInB) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Rule 2A: Rejects mounting `<WordByWordStage` alongside `<ImpactKeywordCard`, `<StoryCard2D`,
 * `<MetricComparisonCard`, or `<SystemNode` without separate `>= 270f` (`4.5s`) scenes.
 */
export function scanTsxForCompetingFocalPoints(
  source: string,
  filePath: string,
  fps = 60,
  effectiveProps: Record<string, unknown> = {}
): DirectorAuditViolation[] {
  const minSceneFrames = Math.round(4.5 * fps);
  const cleaned = blankCommentsPreservingNewlines(source);

  const wordOffsets: number[] = [];
  const wordRe = /<WordByWordStage(?=[\s>/])/g;
  let wm: RegExpExecArray | null;
  while ((wm = wordRe.exec(cleaned)) !== null) {
    if (!isDisabledByFalsePropGuard(cleaned, wm.index, effectiveProps)) {
      wordOffsets.push(wm.index);
    }
  }
  if (wordOffsets.length === 0) {
    return [];
  }

  const cardHits: Array<{ name: string; offset: number }> = [];
  const cardRe =
    /<(ImpactKeywordCard|StoryCard2D|MetricComparisonCard|SystemNode)(?=[\s>/])/g;
  let cm: RegExpExecArray | null;
  while ((cm = cardRe.exec(cleaned)) !== null) {
    if (!isDisabledByFalsePropGuard(cleaned, cm.index, effectiveProps)) {
      cardHits.push({ name: cm[1], offset: cm.index });
    }
  }
  if (cardHits.length === 0) {
    return [];
  }

  const constMap = extractNumericConstMap(cleaned);
  const seqRanges = collectVisualSequenceRanges(cleaned, constMap);

  const findInnermostValidSeq = (
    offset: number
  ): EnclosingSequenceRange | null => {
    const containing = seqRanges.filter(
      (r) =>
        offset >= r.startOffset &&
        offset <= r.endOffset &&
        r.durationFrames !== null &&
        r.durationFrames >= minSceneFrames
    );
    if (containing.length === 0) return null;
    containing.sort(
      (a, b) => a.endOffset - a.startOffset - (b.endOffset - b.startOffset)
    );
    return containing[0];
  };

  const wordSeqIds = new Set<number>();
  let allWordsBounded = true;
  for (const wo of wordOffsets) {
    const seq = findInnermostValidSeq(wo);
    if (!seq) {
      allWordsBounded = false;
      break;
    }
    wordSeqIds.add(seq.id);
  }

  let separatedBySequences = allWordsBounded;
  if (separatedBySequences) {
    for (const ch of cardHits) {
      const seq = findInnermostValidSeq(ch.offset);
      if (!seq || wordSeqIds.has(seq.id)) {
        separatedBySequences = false;
        break;
      }
    }
  }

  if (separatedBySequences) {
    return [];
  }

  if (
    hasValidContinuousSceneFlowSeparation(
      cleaned,
      wordOffsets,
      cardHits.map((c) => c.offset),
      minSceneFrames,
      constMap
    )
  ) {
    return [];
  }

  const firstWordOffset = wordOffsets[0];
  const tagEnd = readJsxOpeningTagEnd(cleaned, firstWordOffset);
  const snippet =
    tagEnd !== -1
      ? source
          .slice(firstWordOffset, tagEnd + 1)
          .replace(/\s+/g, ' ')
          .trim()
      : '<WordByWordStage ... />';
  const competingNames = Array.from(new Set(cardHits.map((c) => `<${c.name}>`)));

  return [
    {
      code: 'COMPETING_FOCAL_POINT',
      rule: 'SINGLE_FOCAL_POINT',
      filePath,
      line: lineNumberAtOffset(source, firstWordOffset),
      snippet,
      message: `Mounts <WordByWordStage> alongside ${competingNames.join(', ')} without separate >= 4.5s (${minSceneFrames}f) scenes. Enforce the Single Focal Point law: never combine rapid word-by-word kinetic text with card/node stages in the same scene; split them into calm >= ${minSceneFrames}f scenes inside <ContinuousSceneFlow>.`,
    },
  ];
}

/**
 * Rule 3: Rejects `<SceneTransition` using choppy wipe types (`flash-cut`, `paper-curtain`, `iris-wipe`)
 * or `durationInFrames < 30`.
 */
export function scanTsxForChoppyTransitions(
  source: string,
  filePath: string
): DirectorAuditViolation[] {
  const cleaned = blankCommentsPreservingNewlines(source);
  const violations: DirectorAuditViolation[] = [];

  const transRe = /<SceneTransition(?=[\s>/])/g;
  let match: RegExpExecArray | null;

  while ((match = transRe.exec(cleaned)) !== null) {
    const offset = match.index;
    const tagEnd = readJsxOpeningTagEnd(cleaned, offset);
    if (tagEnd === -1) continue;

    const cleanedTag = cleaned.slice(offset, tagEnd + 1);
    const rawTag = source.slice(offset, tagEnd + 1);
    transRe.lastIndex = tagEnd + 1;

    const bannedTypeMatch = cleanedTag.match(
      /\btype\s*=\s*(?:["'](flash-cut|paper-curtain|iris-wipe)["']|\{\s*["'](flash-cut|paper-curtain|iris-wipe)["']\s*\})/
    );
    const bannedType = bannedTypeMatch?.[1] ?? bannedTypeMatch?.[2];

    const parsedDur = parseDurationAttrValue(cleanedTag);
    const tooShort =
      parsedDur.isNumericLiteral &&
      parsedDur.value !== null &&
      parsedDur.value < 30;

    if (bannedType || tooShort) {
      const reasons: string[] = [];
      if (bannedType) {
        reasons.push(`choppy type="${bannedType}"`);
      }
      if (tooShort) {
        reasons.push(`durationInFrames={${parsedDur.value}} (< 30 frames)`);
      }
      violations.push({
        code: 'CHOPPY_SCENE_TRANSITION',
        rule: 'ANTI_CHOPPY_TRANSITION',
        filePath,
        line: lineNumberAtOffset(source, offset),
        snippet: rawTag.replace(/\s+/g, ' ').trim(),
        message: `<SceneTransition> uses ${reasons.join(' and ')}. Replace abrupt wipes and flashes with <ContinuousSceneFlow> or <OpticalCrossDissolve> from @make-pictures/core.`,
      });
    }
  }

  return violations;
}

interface StyleObjectBlock {
  startOffset: number;
  endOffset: number;
  content: string;
}

function collectStyleObjectBlocks(
  cleaned: string,
  rangeStart: number,
  rangeEnd: number
): StyleObjectBlock[] {
  const blocks: StyleObjectBlock[] = [];
  const slice = cleaned.slice(rangeStart, rangeEnd);
  const styleAttrRe = /\bstyle\s*=\s*\{/g;
  let m: RegExpExecArray | null;

  while ((m = styleAttrRe.exec(slice)) !== null) {
    const outerBraceInSlice = m.index + m[0].length - 1;
    const absOuterBrace = rangeStart + outerBraceInSlice;
    const absEnd = readBalancedBraceEnd(cleaned, absOuterBrace);
    if (absEnd === -1 || absEnd > rangeEnd) continue;

    blocks.push({
      startOffset: absOuterBrace,
      endOffset: absEnd + 1,
      content: cleaned.slice(absOuterBrace, absEnd + 1),
    });
    styleAttrRe.lastIndex = absEnd + 1 - rangeStart;
  }

  return blocks;
}

function isTopAccentBarStyle(styleContent: string): boolean {
  const hasAbsolute = /\bposition\s*:\s*['"]absolute['"]/.test(styleContent);
  if (!hasAbsolute) return false;

  const hasTopZero = /\btop\s*:\s*(?:0(?![\d.])|['"]0(?:px)?['"])/.test(
    styleContent
  );
  if (!hasTopZero) return false;

  const heightMatch = styleContent.match(/\bheight\s*:\s*([^,}\n]+)/);
  if (!heightMatch) return false;

  const heightExpr = heightMatch[1];
  const numberTokens = heightExpr.match(/\d+(?:\.\d+)?/g);
  if (!numberTokens) return false;

  return numberTokens.some((tok) => {
    const val = Number(tok);
    return val >= 2 && val <= 8;
  });
}

/**
 * Rule 4: Flags style blocks containing `overflow: 'visible'` followed in the same component
 * by an absolute `top: 0` bar (`height: 2..8`) when `ClippedSurfaceChrome` is not used in that file.
 */
export function scanTsxForUnclippedCardBars(
  source: string,
  filePath: string
): DirectorAuditViolation[] {
  const cleaned = blankCommentsPreservingNewlines(source);
  if (/<ClippedSurfaceChrome(?=[\s>/])/.test(cleaned)) {
    return [];
  }

  const violations: DirectorAuditViolation[] = [];
  const compRanges = splitTopLevelComponentRanges(cleaned);

  for (const comp of compRanges) {
    const styleBlocks = collectStyleObjectBlocks(cleaned, comp.start, comp.end);
    const visibleIdx = styleBlocks.findIndex((b) =>
      /\boverflow\s*:\s*['"]visible['"]/.test(b.content)
    );
    if (visibleIdx === -1) continue;

    for (let j = visibleIdx + 1; j < styleBlocks.length; j++) {
      const candidate = styleBlocks[j];
      if (isTopAccentBarStyle(candidate.content)) {
        const rawSnippet = source
          .slice(candidate.startOffset, candidate.endOffset)
          .replace(/\s+/g, ' ')
          .trim();
        violations.push({
          code: 'UNCLIPPED_CARD_BAR',
          rule: 'ROUNDED_CARD_CLIP_HYGIENE',
          filePath,
          line: lineNumberAtOffset(source, candidate.startOffset),
          snippet:
            rawSnippet.length > 140
              ? `${rawSnippet.slice(0, 137)}...`
              : rawSnippet,
          message: `Absolute top: 0 accent bar (height 2..8px) sits inside an overflow: 'visible' container without <ClippedSurfaceChrome>, causing square bar corners to protrude past rounded card borders. Wrap internal bars and highlights in <ClippedSurfaceChrome> from @make-pictures/core.`,
        });
        break;
      }
    }
  }

  return violations;
}

/**
 * Rule 6: Rejects raw HTML `<img>` tags in TSX compositions, requiring `<Img>` from `'remotion'`
 * so `delayRender` synchronizes image loading deterministically under `--concurrency=100%`.
 */
export function scanTsxForRawHtmlImgTags(
  source: string,
  filePath: string
): DirectorAuditViolation[] {
  const cleaned = blankStringsAndCommentsPreservingNewlines(source);
  const cleanedForTagEnd = blankCommentsPreservingNewlines(source);
  const violations: DirectorAuditViolation[] = [];

  const imgRe = /<img(?=[\s/>])/g;
  let match: RegExpExecArray | null;
  while ((match = imgRe.exec(cleaned)) !== null) {
    const offset = match.index;
    const tagEnd = readJsxOpeningTagEnd(cleanedForTagEnd, offset);
    const snippet =
      tagEnd !== -1
        ? source
            .slice(offset, tagEnd + 1)
            .replace(/\s+/g, ' ')
            .trim()
        : '<img ... />';
    if (tagEnd !== -1) {
      imgRe.lastIndex = tagEnd + 1;
    }
    violations.push({
      code: 'RAW_HTML_IMG_TAG',
      rule: 'REMOTION_IMG_REQUIRED',
      filePath,
      line: lineNumberAtOffset(source, offset),
      snippet: snippet.length > 140 ? `${snippet.slice(0, 137)}...` : snippet,
      message:
        'Zastąp surowy znacznik <img> komponentem <Img> z pakietu \'remotion\', aby zagwarantować synchronizację ładowania zasobów przez delayRender przy --concurrency=100%.',
    });
  }

  return violations;
}

/**
 * Rule 7: Flags explicit numeric `fontSize < 18` literals in TSX style objects / JSX attributes
 * (`FONT_BELOW_1080P_FLOOR` static layer).
 */
export function scanTsxForSmallFontSizes(
  source: string,
  filePath: string,
  minPx = 18
): DirectorAuditViolation[] {
  const cleaned = blankCommentsPreservingNewlines(source);
  const violations: DirectorAuditViolation[] = [];

  // 1. Object property `fontSize: 13` or `fontSize: '13px'`
  const propRe =
    /\bfontSize\s*:\s*(?:(\d+(?:\.\d+)?)(?![A-Za-z0-9_.])|['"](\d+(?:\.\d+)?)(?:px)?['"])/g;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(cleaned)) !== null) {
    const rawNum = Number(m[1] ?? m[2]);
    if (rawNum > 0 && rawNum < minPx) {
      const offset = m.index;
      violations.push({
        code: 'FONT_BELOW_1080P_FLOOR',
        rule: 'TYPOGRAPHY_FLOOR_1080P',
        filePath,
        line: lineNumberAtOffset(source, offset),
        snippet: source
          .slice(offset, offset + m[0].length)
          .replace(/\s+/g, ' ')
          .trim(),
        message: `Explicit fontSize ${rawNum}px is below the ${minPx}px 1080p legibility floor (TYPOGRAPHY_FLOOR_1080P.minPx = ${minPx}). Remove micro-stamps or increase fontSize >= ${minPx}px.`,
      });
    }
  }

  // 2. JSX SVG/component attribute `fontSize={12}`
  const jsxAttrRe = /\bfontSize\s*=\s*\{\s*(\d+(?:\.\d+)?)\s*\}/g;
  while ((m = jsxAttrRe.exec(cleaned)) !== null) {
    const rawNum = Number(m[1]);
    if (rawNum > 0 && rawNum < minPx) {
      const offset = m.index;
      violations.push({
        code: 'FONT_BELOW_1080P_FLOOR',
        rule: 'TYPOGRAPHY_FLOOR_1080P',
        filePath,
        line: lineNumberAtOffset(source, offset),
        snippet: source
          .slice(offset, offset + m[0].length)
          .replace(/\s+/g, ' ')
          .trim(),
        message: `JSX fontSize={${rawNum}} is below the ${minPx}px 1080p legibility floor. Increase fontSize >= ${minPx}px.`,
      });
    }
  }

  return violations;
}

/**
 * Rule 8: Flags components mounting >= 2 `<SceneSubViewDissolve>` instances inside a single scene
 * component (which creates 3+ sub-views inside one scene).
 */
export function scanTsxForExcessiveSubViews(
  source: string,
  filePath: string
): DirectorAuditViolation[] {
  const cleaned = blankStringsAndCommentsPreservingNewlines(source);
  const violations: DirectorAuditViolation[] = [];
  const compRanges = splitTopLevelComponentRanges(cleaned);

  for (const r of compRanges) {
    const slice = cleaned.slice(r.start, r.end);
    const hits = [...slice.matchAll(/<SceneSubViewDissolve(?=[\s/>])/g)];
    if (hits.length >= 2) {
      const absOffset = r.start + (hits[1]!.index ?? 0);
      violations.push({
        code: 'EXCESSIVE_SUBVIEWS',
        rule: 'SUB_VIEW_BUDGET',
        filePath,
        line: lineNumberAtOffset(source, absOffset),
        snippet: '<SceneSubViewDissolve ... />',
        message:
          'Single scene component mounts multiple <SceneSubViewDissolve> blocks (3+ sub-views). Limit each scene to at most 1 evolving layout or 2 sub-views (View A -> View B); split 3+ views into separate scenes in production.json.',
      });
    }
  }

  return violations;
}

function extractContinuousSceneFlowNominalDurations(
  tsxFiles: ReadonlyArray<string>
): number[] | null {
  for (const file of tsxFiles) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const cleaned = blankCommentsPreservingNewlines(raw);
    if (!/<ContinuousSceneFlow(?=[\s>/])/.test(cleaned)) continue;

    const constMap = extractNumericConstMap(cleaned);
    const scenesPropMatch = cleaned.match(/\bscenes\s*=\s*\{\s*\[/);
    if (!scenesPropMatch || scenesPropMatch.index === undefined) continue;

    const openBraceOffset =
      scenesPropMatch.index + scenesPropMatch[0].indexOf('{');
    const closeBraceOffset = readBalancedBraceEnd(cleaned, openBraceOffset);
    if (closeBraceOffset === -1) continue;

    const scenesSlice = cleaned.slice(openBraceOffset, closeBraceOffset + 1);
    const durRe = /\bdurationInFrames\s*:\s*([A-Za-z0-9_$.]+)/g;
    const durations: number[] = [];
    let dm: RegExpExecArray | null;
    while ((dm = durRe.exec(scenesSlice)) !== null) {
      const tok = dm[1]!;
      const num = /^\d+(?:\.\d+)?$/.test(tok)
        ? Number(tok)
        : (constMap.get(tok) ?? NaN);
      if (Number.isFinite(num) && num > 0) {
        durations.push(num);
      }
    }
    if (durations.length > 0) {
      return durations;
    }
  }
  return null;
}

function countSpokenWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

function loadCapsuleVoiceoverManifestFromDisk(
  capsuleDir: string
): Record<string, AuditVoiceoverEntry> | null {
  const audioManifestPath = path.join(
    capsuleDir,
    'generated',
    'audio-manifest.ts'
  );
  if (!fs.existsSync(audioManifestPath)) return null;

  try {
    const raw = fs.readFileSync(audioManifestPath, 'utf8');
    const markerMatch = raw.match(
      /export\s+const\s+VOICEOVER_MANIFEST(?:\s*:[^=]+)?=\s*\{/
    );
    if (!markerMatch || markerMatch.index === undefined) return null;

    const openBraceOffset =
      markerMatch.index + markerMatch[0].lastIndexOf('{');
    const cleaned = blankCommentsPreservingNewlines(raw);
    const closeBraceOffset = readBalancedBraceEnd(cleaned, openBraceOffset);
    if (closeBraceOffset === -1) return null;

    const jsonLiteral = raw.slice(openBraceOffset, closeBraceOffset + 1);
    const parsed = JSON.parse(jsonLiteral);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, AuditVoiceoverEntry>)
      : null;
  } catch {
    return null;
  }
}

interface RawProductionManifestJson {
  fps?: number;
  scenes?: Array<{
    id: string;
    text?: string;
    durationInFrames?: number;
    durationInSeconds?: number;
  }>;
}

/**
 * Runs the Hard Director Audit Gate on a target composition before rendering QA stills.
 * By default (`allowFastCuts === false`), throws `DirectorAuditError` when any violation is found.
 */
export function auditCompositionDirection(
  params: AuditDirectionParams
): DirectorAuditResult {
  const origin = inferOrigin(params);
  const fps = params.fps && params.fps > 0 ? params.fps : 60;
  const minSceneFrames = Math.round(4.5 * fps);
  const minPreSettleFrames = Math.round(0.6 * fps);
  const minPostHoldFrames = Math.round(1.5 * fps);
  const minFinalPostHoldFrames = Math.round(2.2 * fps);
  const capsuleDir = resolveTargetCapsuleDir(params, origin);
  const effectiveProps = loadMergedPropsJson(params);

  const violations: DirectorAuditViolation[] = [];
  const inspectedFiles: string[] = [];
  const capsuleTsxFiles =
    capsuleDir && fs.existsSync(capsuleDir)
      ? collectTsxFilesRecursive(capsuleDir)
      : [];

  const sceneTimeline = params.sceneTimeline ?? [];
  const durationInFrames = params.durationInFrames;

  const nominalFlowDurations =
    extractContinuousSceneFlowNominalDurations(capsuleTsxFiles);
  const nominalBoundaries: number[] | null =
    nominalFlowDurations &&
    nominalFlowDurations.length === sceneTimeline.length
      ? (() => {
          const bounds = [0];
          let acc = 0;
          for (const d of nominalFlowDurations) {
            acc += d;
            bounds.push(acc);
          }
          return bounds;
        })()
      : null;

  // Sub-view budget check (`<= 2` sub-views per scene)
  if (origin === 'production') {
    for (const seg of sceneTimeline) {
      if (seg.subViews && seg.subViews.length > 2) {
        violations.push({
          code: 'EXCESSIVE_SUBVIEWS',
          rule: 'SUB_VIEW_BUDGET',
          message: `Scene "${seg.sceneId}" declares ${seg.subViews.length} subViews (> 2 maximum). Limit each scene to at most 2 spacious sub-views (View A -> View B) and split additional views into separate scenes.`,
        });
      }
    }
  }

  // Rule 1A — Visual Scene Span Minimum on `sceneTimeline` (`origin === 'production'`)
  const leadingDialogueOffset = nominalBoundaries
    ? 0
    : Math.max(0, sceneTimeline[0]?.fromFrame ?? 0);

  if (
    origin === 'production' &&
    typeof durationInFrames === 'number' &&
    durationInFrames >= Math.round(9 * fps) &&
    sceneTimeline.length > 1
  ) {
    for (let i = 0; i < sceneTimeline.length; i++) {
      const seg = sceneTimeline[i]!;
      const visualStart = nominalBoundaries
        ? nominalBoundaries[i]!
        : i === 0
          ? 0
          : Math.max(0, seg.fromFrame - leadingDialogueOffset);
      const visualEnd = nominalBoundaries
        ? nominalBoundaries[i + 1]!
        : i + 1 < sceneTimeline.length
          ? Math.max(
              visualStart + 1,
              sceneTimeline[i + 1]!.fromFrame - leadingDialogueOffset
            )
          : durationInFrames;
      const visualSpan = visualEnd - visualStart;

      if (visualSpan < minSceneFrames) {
        const sec = (visualSpan / fps).toFixed(2);
        violations.push({
          code: 'MIN_SCENE_SPAN',
          rule: 'MIN_SCENE_SPAN',
          message: `Scene "${seg.sceneId}" has a visual span of ${visualSpan} frames (${sec}s, frames ${visualStart}..${visualEnd}), below the 4.50s (${minSceneFrames}f @ ${fps} FPS) Director Pacing minimum. Merge rapid sub-cuts and compose calm scenes >= 4.5s with <ContinuousSceneFlow>.`,
        });
      }
    }
  }

  // Rule 2B — Reading Cadence (`<= 2.8 words/s`) & Breathing Room (`pre >= 36f`, `post >= 90f`, `outro >= 132f`) on `production.json`
  if (origin === 'production' && capsuleDir && sceneTimeline.length > 0) {
    const prodJsonPath = path.join(capsuleDir, 'production.json');
    if (fs.existsSync(prodJsonPath)) {
      try {
        const manifest = JSON.parse(
          fs.readFileSync(prodJsonPath, 'utf8')
        ) as RawProductionManifestJson;
        const scenesById = new Map(
          (manifest.scenes ?? []).map((s) => [s.id, s])
        );
        const voiceoverMap =
          params.voiceoverManifest &&
          Object.keys(params.voiceoverManifest).length > 0
            ? params.voiceoverManifest
            : loadCapsuleVoiceoverManifestFromDisk(capsuleDir);

        const lastSeg = sceneTimeline[sceneTimeline.length - 1]!;
        const fallbackTotal = lastSeg.fromFrame + lastSeg.durationInFrames;
        const resolvedTotalFrames = durationInFrames ?? fallbackTotal;

        for (let i = 0; i < sceneTimeline.length; i++) {
          const seg = sceneTimeline[i]!;
          const isFinalScene = i === sceneTimeline.length - 1;
          const visualStart = nominalBoundaries
            ? nominalBoundaries[i]!
            : i === 0
              ? 0
              : Math.max(0, seg.fromFrame - leadingDialogueOffset);
          const visualEnd = nominalBoundaries
            ? nominalBoundaries[i + 1]!
            : i + 1 < sceneTimeline.length
              ? Math.max(
                  visualStart + 1,
                  sceneTimeline[i + 1]!.fromFrame - leadingDialogueOffset
                )
              : resolvedTotalFrames;
          const visualSpanFrames = Math.max(1, visualEnd - visualStart);
          const visualSpanSeconds = visualSpanFrames / fps;

          const sceneDef = scenesById.get(seg.sceneId);
          if (sceneDef?.text) {
            const wordCount = countSpokenWords(sceneDef.text);
            const wordsPerSec = wordCount / visualSpanSeconds;
            if (wordsPerSec > 2.8 + 1e-6) {
              violations.push({
                code: 'READING_CADENCE_OVER_BUDGET',
                rule: 'READING_CADENCE_BUDGET',
                filePath: prodJsonPath,
                message: `Scene "${seg.sceneId}" speaks ${wordCount} words across ${visualSpanSeconds.toFixed(2)}s (${wordsPerSec.toFixed(2)} words/s > 2.80 words/s max). Trim spoken narration or lengthen the visual scene window so viewers have room to absorb both image and voice.`,
              });
            }
          }

          if (sceneTimeline.length > 1) {
            const voEntry = voiceoverMap?.[seg.sceneId];
            let spokenFrames: number | undefined;

            if (
              voEntry &&
              typeof voEntry.durationInSeconds === 'number' &&
              voEntry.durationInSeconds > 0
            ) {
              spokenFrames = Math.round(voEntry.durationInSeconds * fps);
            } else if (seg.durationInFrames > 0) {
              if (
                seg.durationInFrames === visualSpanFrames &&
                sceneDef &&
                (typeof sceneDef.durationInFrames === 'number' ||
                  typeof sceneDef.durationInSeconds === 'number')
              ) {
                const candidateSpoken =
                  sceneDef.durationInFrames ??
                  Math.round((sceneDef.durationInSeconds ?? 0) * fps);
                spokenFrames =
                  candidateSpoken > 0 ? candidateSpoken : seg.durationInFrames;
              } else {
                spokenFrames = seg.durationInFrames;
              }
            }

            if (typeof spokenFrames === 'number' && spokenFrames > 0) {
              const requiredPostFrames = isFinalScene
                ? minFinalPostHoldFrames
                : minPostHoldFrames;

              if (seg.fromFrame > visualStart) {
                const preFrames = seg.fromFrame - visualStart;
                const postFrames = visualEnd - (seg.fromFrame + spokenFrames);

                if (preFrames < minPreSettleFrames) {
                  violations.push({
                    code: 'INSUFFICIENT_BREATHING_ROOM',
                    rule: 'SCENE_BREATHING_ROOM',
                    filePath: prodJsonPath,
                    message: `Scene "${seg.sceneId}" starts voiceover after only ${preFrames} frames (${(preFrames / fps).toFixed(2)}s < ${minPreSettleFrames}f / 0.60s minimum pre-speech settle; target ~42f / 0.70s).`,
                  });
                }
                if (postFrames < requiredPostFrames) {
                  violations.push({
                    code: 'INSUFFICIENT_BREATHING_ROOM',
                    rule: 'SCENE_BREATHING_ROOM',
                    filePath: prodJsonPath,
                    message: `Scene "${seg.sceneId}" leaves only ${postFrames} frames (${(postFrames / fps).toFixed(2)}s) of ${isFinalScene ? 'final-scene outro' : 'post-speech'} hold (< ${requiredPostFrames}f / ${(requiredPostFrames / fps).toFixed(2)}s minimum). Increase scene duration or shorten narration.`,
                  });
                }
              } else {
                const totalRequiredBreathing =
                  minPreSettleFrames + requiredPostFrames;
                const breathingFrames = visualSpanFrames - spokenFrames;
                if (breathingFrames < totalRequiredBreathing) {
                  violations.push({
                    code: 'INSUFFICIENT_BREATHING_ROOM',
                    rule: 'SCENE_BREATHING_ROOM',
                    filePath: prodJsonPath,
                    message: `Scene "${seg.sceneId}" leaves only ${breathingFrames} frames (${(breathingFrames / fps).toFixed(2)}s) of total breathing room (${visualSpanFrames}f visual span - ${spokenFrames}f spoken audio < ${totalRequiredBreathing}f minimum: ${minPreSettleFrames}f pre + ${requiredPostFrames}f ${isFinalScene ? 'outro' : 'post'} hold). Increase scene duration or shorten narration.`,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Ignore malformed JSON; doctor/audio commands validate manifest syntax separately
      }
    }
  }

  // TSX source rules scoped to the target capsule directory
  for (const tsxFile of capsuleTsxFiles) {
    inspectedFiles.push(tsxFile);
    const source = fs.readFileSync(tsxFile, 'utf8');

    if (origin === 'production') {
      violations.push(...scanTsxForShortVisualSequences(source, tsxFile, fps));
      violations.push(...scanTsxForChoppyTransitions(source, tsxFile));
      violations.push(...scanTsxForSmallFontSizes(source, tsxFile));
      violations.push(...scanTsxForExcessiveSubViews(source, tsxFile));
    }

    if (origin === 'production' || Object.keys(effectiveProps).length > 0) {
      violations.push(
        ...scanTsxForCompetingFocalPoints(
          source,
          tsxFile,
          fps,
          effectiveProps
        )
      );
    }

    violations.push(...scanTsxForRawHtmlImgTags(source, tsxFile));
    violations.push(...scanTsxForUnclippedCardBars(source, tsxFile));
  }

  const result: DirectorAuditResult = {
    ok: violations.length === 0,
    compositionId: params.compositionId,
    origin,
    capsuleDir,
    inspectedFiles,
    violations,
  };

  const shouldThrow = params.throwOnViolation ?? !Boolean(params.allowFastCuts);
  if (violations.length > 0 && shouldThrow) {
    throw new DirectorAuditError(
      params.compositionId,
      violations,
      params.rootDir ?? params.studioDir
    );
  }

  return result;
}

/**
 * Rule 5: Verifies that rendered Frame 0 (`rawStillPath`) is a 100% uniform solid `bgCanvas`
 * at FULL native resolution (`0.00` RGB channel variance, zero single-pixel leaks or hairlines).
 */
export function verifyCleanFrameZeroImage(
  imagePath: string
): CleanFrameZeroResult {
  const rawRgb = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      imagePath,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );

  if (rawRgb.length < 3) {
    throw new Error(
      `Failed to decode full-resolution RGB pixels from Frame 0 still: ${imagePath}`
    );
  }

  const pixelCount = Math.floor(rawRgb.length / 3);
  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let i = 0; i + 2 < rawRgb.length; i += 3) {
    const r = rawRgb[i]!;
    const g = rawRgb[i + 1]!;
    const b = rawRgb[i + 2]!;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
    sumR += r;
    sumG += g;
    sumB += b;
  }

  const spreadR = maxR - minR;
  const spreadG = maxG - minG;
  const spreadB = maxB - minB;
  const maxChannelSpread = Math.max(spreadR, spreadG, spreadB);

  let varR = 0;
  let varG = 0;
  let varB = 0;
  if (maxChannelSpread > 0 && pixelCount > 0) {
    const meanR = sumR / pixelCount;
    const meanG = sumG / pixelCount;
    const meanB = sumB / pixelCount;
    let sqR = 0;
    let sqG = 0;
    let sqB = 0;
    for (let i = 0; i + 2 < rawRgb.length; i += 3) {
      const dr = rawRgb[i]! - meanR;
      const dg = rawRgb[i + 1]! - meanG;
      const db = rawRgb[i + 2]! - meanB;
      sqR += dr * dr;
      sqG += dg * dg;
      sqB += db * db;
    }
    varR = Number((sqR / pixelCount).toFixed(6));
    varG = Number((sqG / pixelCount).toFixed(6));
    varB = Number((sqB / pixelCount).toFixed(6));
  }

  const maxChannelVariance = Math.max(varR, varG, varB);
  const clean = maxChannelSpread === 0 && maxChannelVariance === 0;

  return {
    clean,
    maxChannelSpread,
    maxChannelVariance,
    channelSpreads: {
      r: spreadR,
      g: spreadG,
      b: spreadB,
    },
    channelVariances: {
      r: varR,
      g: varG,
      b: varB,
    },
  };
}
