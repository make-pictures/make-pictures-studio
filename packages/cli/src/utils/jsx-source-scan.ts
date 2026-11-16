/**
 * Replaces JS/TSX block and single-line comments with spaces while preserving `\n`
 * so character offsets map 1:1 to original 1-based line numbers.
 */
export function blankCommentsPreservingNewlines(source: string): string {
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

export function lineNumberAtOffset(source: string, offset: number): number {
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
export function readJsxOpeningTagEnd(
  cleaned: string,
  startOffset: number
): number {
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
