import fs from 'node:fs';
import path from 'node:path';
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
            message: `Unbounded <Sequence> wrapping <Audio /> without \`durationInFrames\` keeps its <Html5Audio /> tag mounted until the end of the film. Pass \`durationInFrames={...}\` or use \`<VoiceoverTrack />\` / \`<SoundCue />\` from \`@make-pictures/core\`.`,
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Audits all `productions/<slug>/compositions/*.tsx` files inside `studioDir`
 * for unbounded `<Sequence><Audio /></Sequence>` blocks.
 */
export function auditStudioAudioLifetimes(
  studioDir: string
): AudioLifetimeWarning[] {
  const productionsDir = path.join(studioDir, 'productions');
  if (!fs.existsSync(productionsDir)) {
    return [];
  }

  const warnings: AudioLifetimeWarning[] = [];
  const capsuleEntries = fs
    .readdirSync(productionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const capsule of capsuleEntries) {
    const compDir = path.join(productionsDir, capsule.name, 'compositions');
    if (!fs.existsSync(compDir)) continue;

    const files = fs
      .readdirSync(compDir, { withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.tsx'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of files) {
      const fullPath = path.join(compDir, file.name);
      const source = fs.readFileSync(fullPath, 'utf8');
      warnings.push(...scanTsxForUnboundedAudioSequences(source, fullPath));
    }
  }

  return warnings;
}
