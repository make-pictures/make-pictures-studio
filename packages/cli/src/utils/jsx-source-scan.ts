interface TemplateBraceFrame {
  kind: 'brace' | 'template-expr';
}

interface JsxStackFrame {
  tagName: string;
  braceDepth: number;
}

function isAsciiIdentStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 36 // $
  );
}

function isJsxTagNameChar(code: number): boolean {
  return (
    isAsciiIdentStart(code) ||
    (code >= 48 && code <= 57) || // 0-9
    code === 46 || // .
    code === 58 || // :
    code === 45 // -
  );
}

function prevNonSpaceChar(source: string, index: number): string {
  for (let p = index - 1; p >= 0; p--) {
    const c = source[p]!;
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') {
      return c;
    }
  }
  return '';
}

function canStartJsxAt(source: string, ltIndex: number): boolean {
  const prev = prevNonSpaceChar(source, ltIndex);
  if (!prev) return true;
  // After an identifier/number/closing bracket in TS/JS, `<` is a generic or comparison (`useState<string>`, `a < b`),
  // UNLESS preceded by keywords like `return <div`!
  if (/[0-9)\]]/.test(prev)) {
    return false;
  }
  if (/[A-Za-z_$]/.test(prev)) {
    let end = ltIndex - 1;
    while (
      end >= 0 &&
      (source[end] === ' ' ||
        source[end] === '\t' ||
        source[end] === '\n' ||
        source[end] === '\r')
    ) {
      end -= 1;
    }
    let start = end;
    while (start >= 0 && /[A-Za-z0-9_$]/.test(source[start]!)) {
      start -= 1;
    }
    const word = source.slice(start + 1, end + 1);
    return (
      word === 'return' ||
      word === 'case' ||
      word === 'throw' ||
      word === 'yield' ||
      word === 'await' ||
      word === 'typeof' ||
      word === 'void'
    );
  }
  return true;
}

function findMatchingClosingJsxTag(
  source: string,
  tagName: string,
  fromIndex: number
): boolean {
  if (tagName === '') {
    return source.indexOf('</>', fromIndex) !== -1;
  }
  const needle = `</${tagName}`;
  let pos = source.indexOf(needle, fromIndex);
  while (pos !== -1) {
    const afterCode = source.charCodeAt(pos + needle.length);
    if (
      Number.isNaN(afterCode) ||
      afterCode === 62 || // >
      afterCode === 32 ||
      afterCode === 9 ||
      afterCode === 10 ||
      afterCode === 13
    ) {
      return true;
    }
    pos = source.indexOf(needle, pos + needle.length);
  }
  return false;
}

function scanTsxPreservingUtf16Offsets(
  source: string,
  blankStrings: boolean
): string {
  const len = source.length;
  const out = new Array<string>(len);
  for (let k = 0; k < len; k++) {
    out[k] = source[k]!;
  }

  const blankChar = (idx: number) => {
    const c = source[idx];
    if (c !== '\n' && c !== '\r') {
      out[idx] = ' ';
    }
  };

  const braceStack: TemplateBraceFrame[] = [];
  const jsxStack: JsxStackFrame[] = [];
  let inTemplate = false;
  let inJsxTagHead = false;
  let pendingJsxTagName: string | null = null;
  let jsxTagBraceBase = 0;

  let i = 0;
  while (i < len) {
    const ch = source[i]!;
    const next = i + 1 < len ? source[i + 1]! : '';

    // 1. Inside backtick template literal body (outside `${ ... }`)
    if (inTemplate) {
      if (ch === '\\') {
        if (blankStrings) {
          blankChar(i);
          if (i + 1 < len) blankChar(i + 1);
        }
        i += 2;
        continue;
      }
      if (ch === '$' && next === '{') {
        if (blankStrings) {
          blankChar(i);
          blankChar(i + 1);
        }
        braceStack.push({ kind: 'template-expr' });
        inTemplate = false;
        i += 2;
        continue;
      }
      if (ch === '`') {
        inTemplate = false;
        i += 1;
        continue;
      }
      if (blankStrings) {
        blankChar(i);
      }
      i += 1;
      continue;
    }

    // 2. Determine whether we are currently inside plain JSX child text (`<Tag>It's here</Tag>`)
    const topJsx = jsxStack.length > 0 ? jsxStack[jsxStack.length - 1] : undefined;
    const inJsxChildText =
      Boolean(topJsx) &&
      !inJsxTagHead &&
      braceStack.length === topJsx!.braceDepth;

    if (inJsxChildText) {
      if (ch === '{') {
        braceStack.push({ kind: 'brace' });
        i += 1;
        continue;
      }
      if (ch === '<') {
        // Closing tag `</TagName>` or `</>`
        if (next === '/') {
          let cursor = i + 2;
          while (cursor < len && isJsxTagNameChar(source.charCodeAt(cursor))) {
            cursor += 1;
          }
          const closeName = source.slice(i + 2, cursor);
          while (cursor < len && source[cursor] !== '>') {
            cursor += 1;
          }
          if (cursor < len && source[cursor] === '>') {
            for (let s = jsxStack.length - 1; s >= 0; s--) {
              if (jsxStack[s]!.tagName === closeName) {
                jsxStack.length = s;
                break;
              }
            }
            i = cursor + 1;
            continue;
          }
        }
        // Nested JSX fragment `<>`
        if (next === '>') {
          if (findMatchingClosingJsxTag(source, '', i + 2)) {
            jsxStack.push({ tagName: '', braceDepth: braceStack.length });
          }
          i += 2;
          continue;
        }
        // Nested opening JSX tag `<Span ...>`
        if (i + 1 < len && isAsciiIdentStart(source.charCodeAt(i + 1))) {
          let cursor = i + 1;
          while (cursor < len && isJsxTagNameChar(source.charCodeAt(cursor))) {
            cursor += 1;
          }
          pendingJsxTagName = source.slice(i + 1, cursor);
          inJsxTagHead = true;
          jsxTagBraceBase = braceStack.length;
          i = cursor;
          continue;
        }
      }
      // Blank plain JSX child text (preserving `\n`/`\r` and 1:1 UTF-16 offsets) so copy like
      // `<code>fontSize: 12</code>` or `It's` never triggers JS/CSS static rules or string quotes!
      blankChar(i);
      i += 1;
      continue;
    }

    // 3. Single or double quoted JS/JSX-attribute string literal (never crosses unescaped newline)
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i += 1;
      while (i < len) {
        const sc = source[i]!;
        if (sc === '\\') {
          if (blankStrings) {
            blankChar(i);
            if (i + 1 < len) blankChar(i + 1);
          }
          i += 2;
          continue;
        }
        if (sc === '\n' || sc === '\r') {
          break;
        }
        if (sc === quote) {
          i += 1;
          break;
        }
        if (blankStrings) {
          blankChar(i);
        }
        i += 1;
      }
      continue;
    }

    // 4. Template literal start `` ` ``
    if (ch === '`') {
      inTemplate = true;
      i += 1;
      continue;
    }

    // 5. Block comment `/* ... */`
    if (ch === '/' && next === '*') {
      blankChar(i);
      blankChar(i + 1);
      i += 2;
      while (i < len) {
        if (source[i] === '*' && source[i + 1] === '/') {
          blankChar(i);
          blankChar(i + 1);
          i += 2;
          break;
        }
        blankChar(i);
        i += 1;
      }
      continue;
    }

    // 6. Single-line comment `// ...`
    if (ch === '/' && next === '/') {
      while (i < len && source[i] !== '\n' && source[i] !== '\r') {
        blankChar(i);
        i += 1;
      }
      continue;
    }

    // 7. Braces `{` / `}` (tracking JSX attribute expressions and `${...}` template expressions)
    if (ch === '{') {
      braceStack.push({ kind: 'brace' });
      i += 1;
      continue;
    }
    if (ch === '}') {
      const popped = braceStack.pop();
      if (popped?.kind === 'template-expr') {
        if (blankStrings) {
          blankChar(i);
        }
        inTemplate = true;
      }
      i += 1;
      continue;
    }

    // 8. End of an opening JSX tag `<Tag ... >` or `<Tag ... />`
    if (inJsxTagHead && braceStack.length === jsxTagBraceBase && ch === '>') {
      const prevNonWs = prevNonSpaceChar(source, i);
      const isSelfClosing = prevNonWs === '/';
      if (
        !isSelfClosing &&
        pendingJsxTagName !== null &&
        findMatchingClosingJsxTag(source, pendingJsxTagName, i + 1)
      ) {
        jsxStack.push({
          tagName: pendingJsxTagName,
          braceDepth: braceStack.length,
        });
      }
      inJsxTagHead = false;
      pendingJsxTagName = null;
      i += 1;
      continue;
    }

    // 9. Start of JSX tag or fragment in JS expression context
    if (!inJsxTagHead && ch === '<') {
      if (next === '>' && canStartJsxAt(source, i)) {
        if (findMatchingClosingJsxTag(source, '', i + 2)) {
          jsxStack.push({ tagName: '', braceDepth: braceStack.length });
        }
        i += 2;
        continue;
      }
      if (
        i + 1 < len &&
        isAsciiIdentStart(source.charCodeAt(i + 1)) &&
        canStartJsxAt(source, i)
      ) {
        let cursor = i + 1;
        while (cursor < len && isJsxTagNameChar(source.charCodeAt(cursor))) {
          cursor += 1;
        }
        const candidateName = source.slice(i + 1, cursor);
        // Only treat as JSX tag head if it actually has a closing `>` and either `/>` or `</Tag>`
        const tagEnd = readJsxOpeningTagEnd(source, i);
        if (tagEnd !== -1) {
          const beforeEnd = prevNonSpaceChar(source, tagEnd);
          if (
            beforeEnd === '/' ||
            findMatchingClosingJsxTag(source, candidateName, tagEnd + 1)
          ) {
            pendingJsxTagName = candidateName;
            inJsxTagHead = true;
            jsxTagBraceBase = braceStack.length;
            i = cursor;
            continue;
          }
        }
      }
    }

    i += 1;
  }

  return out.join('');
}

/**
 * Replaces JS/TSX block and single-line comments with spaces while preserving `\n`
 * and strict 1:1 UTF-16 code-unit length so character offsets map identically to `source`.
 */
export function blankCommentsPreservingNewlines(source: string): string {
  return scanTsxPreservingUtf16Offsets(source, false);
}

/**
 * Replaces BOTH JS/TSX comments AND JS/attribute string/template literal contents with spaces
 * while preserving `\n`, JSX child text (including apostrophes like `It's`), and strict 1:1
 * UTF-16 code-unit length so regex scans for JSX tags like `<img` never trigger on strings/comments.
 */
export function blankStringsAndCommentsPreservingNewlines(
  source: string
): string {
  return scanTsxPreservingUtf16Offsets(source, true);
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
 * Reads from `<TagName` up to its matching closing `>` while respecting `{...}` JSX expressions,
 * nested `${...}` template literals, and single/double-quoted attributes.
 */
export function readJsxOpeningTagEnd(
  cleaned: string,
  startOffset: number
): number {
  const stack: Array<'brace' | 'template-expr'> = [];
  let inTemplate = false;
  let i = startOffset + 1;
  const len = cleaned.length;

  while (i < len) {
    const ch = cleaned[i]!;
    const next = i + 1 < len ? cleaned[i + 1]! : '';

    if (inTemplate) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '$' && next === '{') {
        stack.push('template-expr');
        inTemplate = false;
        i += 2;
        continue;
      }
      if (ch === '`') {
        inTemplate = false;
      }
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i += 1;
      while (i < len) {
        const sc = cleaned[i]!;
        if (sc === '\\') {
          i += 2;
          continue;
        }
        if (sc === '\n' || sc === '\r') {
          break;
        }
        if (sc === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      i += 1;
      continue;
    }

    if (ch === '{') {
      stack.push('brace');
    } else if (ch === '}') {
      const popped = stack.pop();
      if (popped === 'template-expr') {
        inTemplate = true;
      }
    } else if (ch === '>' && stack.length === 0) {
      return i;
    }
    i += 1;
  }

  return -1;
}
