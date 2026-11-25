import fs from 'node:fs';
import path from 'node:path';
import { loadMakePicturesConfig } from '../commands/workspace-paths';
import {
  blankCommentsPreservingNewlines,
  lineNumberAtOffset,
  readJsxOpeningTagEnd,
} from '../utils/jsx-source-scan';

export interface AudioLifetimeWarning {
  filePath: string;
  line: number;
  snippet: string;
  message: string;
}

interface SequenceFrame {
  offset: number;
  line: number;
  snippet: string;
  hasDuration: boolean;
  reported: boolean;
}

/**
 * Scans a TSX composition file for `<Sequence ...>` blocks without `durationInFrames`
 * that mount `<Audio />` or `<Html5Audio />` inside them (which causes `@remotion/player`
 * shared audio tags to stay mounted until the end of the film).
 */
export function scanTsxForUnboundedAudioSequences(
  source: string,
  filePath: string
): AudioLifetimeWarning[] {
  const cleaned = blankCommentsPreservingNewlines(source);
  const warnings: AudioLifetimeWarning[] = [];
  const stack: SequenceFrame[] = [];

  const tokenRegex =
    /<\/Sequence\s*>|<Sequence(?=[\s>/])|<(?:Audio|Html5Audio)(?=[\s>/])/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(cleaned)) !== null) {
    const token = match[0];
    const offset = match.index;

    if (token.startsWith('</Sequence')) {
      stack.pop();
      continue;
    }

    if (token.startsWith('<Sequence')) {
      const tagEnd = readJsxOpeningTagEnd(cleaned, offset);
      if (tagEnd === -1) {
        continue;
      }
      const rawOpenTag = source.slice(offset, tagEnd + 1);
      const cleanedOpenTag = cleaned.slice(offset, tagEnd + 1);
      tokenRegex.lastIndex = tagEnd + 1;

      // Self-closing `<Sequence ... />` cannot wrap `<Audio />`
      if (/\/\s*>$/.test(cleanedOpenTag)) {
        continue;
      }

      const hasDuration = /\bdurationInFrames\s*=/.test(cleanedOpenTag);
      const line = lineNumberAtOffset(source, offset);
      const snippet = rawOpenTag.replace(/\s+/g, ' ').trim();

      stack.push({
        offset,
        line,
        snippet,
        hasDuration,
        reported: false,
      });
      continue;
    }

    // Matched `<Audio` or `<Html5Audio`: check if enclosed inside `<Sequence>` without any bounded `durationInFrames`
    if (stack.length > 0) {
      const anyBoundedAncestor = stack.some((frame) => frame.hasDuration);
      if (!anyBoundedAncestor) {
        const innermost = stack[stack.length - 1];
        if (!innermost.reported) {
          innermost.reported = true;
          warnings.push({
            filePath,
            line: innermost.line,
            snippet: innermost.snippet,
            message: `Unbounded <Sequence> wrapping <Audio /> without \`durationInFrames\` keeps its <Html5Audio /> tag mounted until the end of the film. Pass \`durationInFrames={...}\` or use \`<VoiceoverTrack />\` / \`<SoundCue />\` from \`@make-pictures/remotion/audio\`.`,
          });
        }
      }
    }
  }

  return warnings;
}

function collectTsxFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const results: string[] = [];
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'generated' || entry.name === 'assets') {
      continue;
    }
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Audits all video composition `.tsx` files inside `studioDir` (under `videosDir`
 * from `make-pictures.json` and `productions/` if present) for unbounded
 * `<Sequence><Audio /></Sequence>` blocks.
 */
export function auditStudioAudioLifetimes(
  studioDir: string
): AudioLifetimeWarning[] {
  const config = loadMakePicturesConfig(studioDir);
  const candidateDirs = [
    path.resolve(studioDir, config.videosDir),
    path.join(studioDir, 'productions'),
  ];

  const warnings: AudioLifetimeWarning[] = [];
  const seenFiles = new Set<string>();

  for (const baseDir of candidateDirs) {
    for (const fullPath of collectTsxFiles(baseDir)) {
      if (seenFiles.has(fullPath)) continue;
      seenFiles.add(fullPath);
      const source = fs.readFileSync(fullPath, 'utf8');
      warnings.push(...scanTsxForUnboundedAudioSequences(source, fullPath));
    }
  }

  return warnings;
}
