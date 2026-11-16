import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  blankCommentsPreservingNewlines,
  lineNumberAtOffset,
  readJsxOpeningTagEnd,
} from '../utils/jsx-source-scan';

export type DirectorAuditRuleCode =
  | 'MIN_SCENE_SPAN'
  | 'COMPETING_FOCAL_POINT'
  | 'READING_CADENCE_OVER_BUDGET'
  | 'INSUFFICIENT_BREATHING_ROOM'
  | 'CHOPPY_SCENE_TRANSITION'
  | 'UNCLIPPED_CARD_BAR'
  | 'DIRTY_FRAME_ZERO';

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

export interface AuditSceneSegment {
  sceneId: string;
  fromFrame: number;
  durationInFrames: number;
  label?: string;
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
  channelSpreads: {
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
  const minBreathingFrames = Math.round(0.6 * fps);
  const capsuleDir = resolveTargetCapsuleDir(params, origin);
  const effectiveProps = loadMergedPropsJson(params);

  const violations: DirectorAuditViolation[] = [];
  const inspectedFiles: string[] = [];

  const sceneTimeline = params.sceneTimeline ?? [];
  const durationInFrames = params.durationInFrames;

  // Rule 1A — Visual Scene Span Minimum on `sceneTimeline` (`origin === 'production'`)
  if (
    origin === 'production' &&
    typeof durationInFrames === 'number' &&
    durationInFrames >= Math.round(9 * fps) &&
    sceneTimeline.length > 1
  ) {
    for (let i = 0; i < sceneTimeline.length; i++) {
      const seg = sceneTimeline[i];
      const visualStart = i === 0 ? 0 : seg.fromFrame;
      const visualEnd =
        i + 1 < sceneTimeline.length
          ? sceneTimeline[i + 1].fromFrame
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

  // Rule 2B — Reading Cadence (`<= 2.8 words/s`) & Breathing Room (`>= 0.6s` / `36f`) on `production.json`
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

        const lastSeg = sceneTimeline[sceneTimeline.length - 1];
        const fallbackTotal = lastSeg.fromFrame + lastSeg.durationInFrames;
        const resolvedTotalFrames = durationInFrames ?? fallbackTotal;

        for (let i = 0; i < sceneTimeline.length; i++) {
          const seg = sceneTimeline[i];
          const visualStart = i === 0 ? 0 : seg.fromFrame;
          const visualEnd =
            i + 1 < sceneTimeline.length
              ? sceneTimeline[i + 1].fromFrame
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
              const breathingFrames = visualSpanFrames - spokenFrames;
              if (breathingFrames < minBreathingFrames) {
                violations.push({
                  code: 'INSUFFICIENT_BREATHING_ROOM',
                  rule: 'SCENE_BREATHING_ROOM',
                  filePath: prodJsonPath,
                  message: `Scene "${seg.sceneId}" leaves only ${breathingFrames} frames (${(breathingFrames / fps).toFixed(2)}s) of calm breathing room (${visualSpanFrames}f visual span - ${spokenFrames}f spoken audio < ${minBreathingFrames}f / 0.60s minimum). Increase scene duration or shorten narration.`,
                });
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
  if (capsuleDir && fs.existsSync(capsuleDir)) {
    const tsxFiles = collectTsxFilesRecursive(capsuleDir);
    for (const tsxFile of tsxFiles) {
      inspectedFiles.push(tsxFile);
      const source = fs.readFileSync(tsxFile, 'utf8');

      if (origin === 'production') {
        violations.push(...scanTsxForShortVisualSequences(source, tsxFile, fps));
        violations.push(...scanTsxForChoppyTransitions(source, tsxFile));
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

      violations.push(...scanTsxForUnclippedCardBars(source, tsxFile));
    }
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
 * by sampling a `32x32` RGB24 buffer via `ffmpeg` and checking `(max - min) <= 6` per channel.
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
      '-vf',
      'scale=32:32',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    { maxBuffer: 1024 * 1024 }
  );

  if (rawRgb.length < 3) {
    throw new Error(
      `Failed to sample 32x32 RGB pixels from Frame 0 still: ${imagePath}`
    );
  }

  let minR = 255;
  let maxR = 0;
  let minG = 255;
  let maxG = 0;
  let minB = 255;
  let maxB = 0;

  for (let i = 0; i + 2 < rawRgb.length; i += 3) {
    const r = rawRgb[i];
    const g = rawRgb[i + 1];
    const b = rawRgb[i + 2];
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
  }

  const spreadR = maxR - minR;
  const spreadG = maxG - minG;
  const spreadB = maxB - minB;
  const maxChannelSpread = Math.max(spreadR, spreadG, spreadB);
  const clean = spreadR <= 6 && spreadG <= 6 && spreadB <= 6;

  return {
    clean,
    maxChannelSpread,
    channelSpreads: {
      r: spreadR,
      g: spreadG,
      b: spreadB,
    },
  };
}
