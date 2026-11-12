import fs from 'node:fs';
import path from 'node:path';

export interface AudioLifetimeWarning {
  filePath: string;
  line: number;
  snippet: string;
  message: string;
}

/**
 * Replaces JS/TSX block and single-line comments with spaces while preserving `\n`
 * so byte offsets map 1:1 to original 1-based line numbers.
 */
function blankCommentsPreservingNewlines(source: string): string {
  const chars = Array.from(source);
  const len = chars.length;
  let i = 0;

  while (i < len) {
    const ch = chars[i];
    const next = chars[i + 1];

    // Skip string / template literals so URLs like `https://...` are never treated as `//` comments
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < len) {
        if (chars[i] === '\\') {
          i += 2;
          continue;
        }
        if (chars[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    // Block comment `/* ... */`
    if (ch === '/' && next === '*') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < len) {
        if (chars[i] === '*' && chars[i + 1] === '/') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i += 2;
          break;
        }
        if (chars[i] !== '\n') {
          chars[i] = ' ';
        }
        i += 1;
      }
      continue;
    }

    // Single-line comment `// ...`
    if (ch === '/' && next === '/') {
      while (i < len && chars[i] !== '\n') {
        chars[i] = ' ';
        i += 1;
      }
      continue;
    }

    i += 1;
  }

  return chars.join('');
}

function lineNumberAtOffset(source: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

/**
 * Reads from `<TagName` up to its matching closing `>` while respecting `{...}` JSX expressions
 * and quoted string attributes.
 */
function readJsxOpeningTagEnd(cleaned: string, startOffset: number): number {
  let braceDepth = 0;
  let i = startOffset + 1;
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
      braceDepth += 1;
    } else if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
    } else if (ch === '>' && braceDepth === 0) {
      return i;
    }
    i += 1;
  }

  return -1;
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
