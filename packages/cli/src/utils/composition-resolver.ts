import fs from 'node:fs';
import path from 'node:path';
import {
  blankCommentsPreservingNewlines,
  readJsxOpeningTagEnd,
} from './jsx-source-scan';

export interface ImportedSymbolBinding {
  specifier: string;
  importedName: string; // 'default' | '*' | named export identifier
}

export interface ParsedExports {
  namedReExports: Map<string, ImportedSymbolBinding>;
  wildcardReExports: string[];
  localNamedExports: Map<string, string>; // exportedName -> localName
}

const MAX_BARREL_DEPTH = 8;

export function resolveRelativeTsSourceFile(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.resolve(candidate);
    }
  }
  return null;
}

export function parseImportedModuleMap(
  cleanedSource: string
): Map<string, ImportedSymbolBinding> {
  const map = new Map<string, ImportedSymbolBinding>();
  const importRe =
    /\bimport\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(cleanedSource)) !== null) {
    const clause = (match[1] ?? '').trim();
    const specifier = (match[2] ?? '').trim();
    if (!specifier.startsWith('.')) continue;

    // Namespace import: `import * as ns from './foo'`
    const nsMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (nsMatch) {
      map.set(nsMatch[1]!, { specifier, importedName: '*' });
      continue;
    }

    // Named imports: `{ Foo, Bar as Baz }` (optionally preceded by default import)
    const braceStart = clause.indexOf('{');
    const braceEnd = clause.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      const beforeBrace = clause
        .slice(0, braceStart)
        .replace(/,\s*$/, '')
        .trim();
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(beforeBrace)) {
        map.set(beforeBrace, { specifier, importedName: 'default' });
      }
      const namedPart = clause.slice(braceStart + 1, braceEnd);
      for (const rawItem of namedPart.split(',')) {
        const cleanedItem = rawItem.replace(/^type\s+/, '').trim();
        if (!cleanedItem) continue;
        const asMatch = cleanedItem.match(
          /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/
        );
        if (asMatch) {
          map.set(asMatch[2]!, { specifier, importedName: asMatch[1]! });
        } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cleanedItem)) {
          map.set(cleanedItem, { specifier, importedName: cleanedItem });
        }
      }
      continue;
    }

    // Default import: `import Foo from './Foo'`
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(clause)) {
      map.set(clause, { specifier, importedName: 'default' });
    }
  }

  return map;
}

export function parseReExports(cleanedSource: string): ParsedExports {
  const namedReExports = new Map<string, ImportedSymbolBinding>();
  const wildcardReExports: string[] = [];
  const localNamedExports = new Map<string, string>();

  // `export * from './sub'` and `export * as ns from './sub'`
  const starRe =
    /\bexport\s+\*(?:\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))?\s+from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = starRe.exec(cleanedSource)) !== null) {
    const alias = m[1];
    const spec = (m[2] ?? '').trim();
    if (!spec.startsWith('.')) continue;
    if (alias) {
      namedReExports.set(alias, { specifier: spec, importedName: '*' });
    } else {
      wildcardReExports.push(spec);
    }
  }

  // `export { A, B as C } from './sub'`
  const namedFromRe =
    /\bexport\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = namedFromRe.exec(cleanedSource)) !== null) {
    const list = m[1] ?? '';
    const spec = (m[2] ?? '').trim();
    if (!spec.startsWith('.')) continue;
    for (const rawItem of list.split(',')) {
      const cleanedItem = rawItem.replace(/^type\s+/, '').trim();
      if (!cleanedItem) continue;
      const asMatch = cleanedItem.match(
        /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/
      );
      if (asMatch) {
        namedReExports.set(asMatch[2]!, {
          specifier: spec,
          importedName: asMatch[1]!,
        });
      } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cleanedItem)) {
        namedReExports.set(cleanedItem, {
          specifier: spec,
          importedName: cleanedItem,
        });
      }
    }
  }

  // `export { LocalA, LocalB as ExportedB }` (without `from`)
  const localExportRe =
    /\bexport\s+\{([^}]*)\}(?!\s*from\b)/g;
  while ((m = localExportRe.exec(cleanedSource)) !== null) {
    const list = m[1] ?? '';
    for (const rawItem of list.split(',')) {
      const cleanedItem = rawItem.replace(/^type\s+/, '').trim();
      if (!cleanedItem) continue;
      const asMatch = cleanedItem.match(
        /^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/
      );
      if (asMatch) {
        localNamedExports.set(asMatch[2]!, asMatch[1]!);
      } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cleanedItem)) {
        localNamedExports.set(cleanedItem, cleanedItem);
      }
    }
  }

  return { namedReExports, wildcardReExports, localNamedExports };
}

function fileDirectlyDeclaresSymbol(
  cleanedSource: string,
  symbolName: string
): boolean {
  if (symbolName === 'default') {
    return /\bexport\s+default\b/.test(cleanedSource);
  }
  const escaped = symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `\\b(?:export\\s+)?(?:const|let|var|function|class)\\s+${escaped}\\b`
  ).test(cleanedSource);
}

function chaseSymbolToDefinition(
  filePath: string,
  symbolName: string,
  visited: Set<string>,
  depth: number
): string | null {
  if (depth > MAX_BARREL_DEPTH) return null;
  const resolvedPath = path.resolve(filePath);
  const visitKey = `${resolvedPath}::${symbolName}`;
  if (visited.has(visitKey)) return null;
  visited.add(visitKey);

  let cleaned: string;
  try {
    cleaned = blankCommentsPreservingNewlines(
      fs.readFileSync(resolvedPath, 'utf8')
    );
  } catch {
    return null;
  }

  const imports = parseImportedModuleMap(cleaned);
  const exportsInfo = parseReExports(cleaned);

  // 1. Direct export / re-export of `symbolName` from another relative module
  const namedReExport = exportsInfo.namedReExports.get(symbolName);
  if (namedReExport) {
    const nextFile = resolveRelativeTsSourceFile(
      path.resolve(path.dirname(resolvedPath), namedReExport.specifier)
    );
    if (nextFile) {
      if (namedReExport.importedName === '*') {
        return nextFile;
      }
      const chased = chaseSymbolToDefinition(
        nextFile,
        namedReExport.importedName,
        visited,
        depth + 1
      );
      return chased ?? nextFile;
    }
  }

  // 2. Imported locally and re-exported via `export { Foo }` (common barrel pattern)
  const localName = exportsInfo.localNamedExports.get(symbolName) ?? symbolName;
  const localImport = imports.get(localName);
  if (localImport) {
    const nextFile = resolveRelativeTsSourceFile(
      path.resolve(path.dirname(resolvedPath), localImport.specifier)
    );
    if (nextFile) {
      if (localImport.importedName === '*') {
        return nextFile;
      }
      const chased = chaseSymbolToDefinition(
        nextFile,
        localImport.importedName,
        visited,
        depth + 1
      );
      return chased ?? nextFile;
    }
  }

  // 3. Declared directly in this file
  if (fileDirectlyDeclaresSymbol(cleaned, localName)) {
    return resolvedPath;
  }

  // 4. Wildcard re-exports: `export * from './ComponentFile'`
  for (const wildSpec of exportsInfo.wildcardReExports) {
    const nextFile = resolveRelativeTsSourceFile(
      path.resolve(path.dirname(resolvedPath), wildSpec)
    );
    if (!nextFile) continue;
    const chased = chaseSymbolToDefinition(
      nextFile,
      symbolName,
      visited,
      depth + 1
    );
    if (chased) {
      return chased;
    }
  }

  return null;
}

/**
 * Extracts the `<Composition id="..." component={Ident | ns.Member} />` reference from `rootFilePath`,
 * safely stripping comments and handling JSX expressions containing `>` (e.g. `calculateMetadata={({...}) => ...}`),
 * `id={'Foo'}`, and `component={ns.Foo}`.
 */
export function extractCompositionComponentRef(
  cleanedRootSource: string,
  compositionId: string
): { ident: string; member?: string } | null {
  const escapedId = compositionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idAttrRe = new RegExp(
    `\\bid\\s*=\\s*(?:["']${escapedId}["']|\\{\\s*["']${escapedId}["']\\s*\\})`
  );

  const compOpenRe = /<Composition(?=[\s>/])/g;
  let match: RegExpExecArray | null;

  while ((match = compOpenRe.exec(cleanedRootSource)) !== null) {
    const tagEnd = readJsxOpeningTagEnd(cleanedRootSource, match.index);
    if (tagEnd === -1) continue;
    const tagText = cleanedRootSource.slice(match.index, tagEnd + 1);
    compOpenRe.lastIndex = tagEnd + 1;

    if (!idAttrRe.test(tagText)) continue;

    const compAttr = tagText.match(
      /\bcomponent\s*=\s*\{\s*([A-Za-z_$][A-Za-z0-9_$]*)(?:\.([A-Za-z_$][A-Za-z0-9_$]*))?\s*\}/
    );
    if (compAttr) {
      return {
        ident: compAttr[1]!,
        member: compAttr[2],
      };
    }
  }

  return null;
}

/**
 * Locates the actual source `.tsx`/`.ts` file of a Remotion `<Composition id="..." component={...} />`
 * by statically parsing `rootFilePath` (`src/Root.tsx`) and recursively chasing `export * from` /
 * `export { X } from` / `import` barrel files to the component's definition file.
 */
export function resolveCompositionSourceFromRoot(
  rootFilePath: string,
  compositionId: string
): string | null {
  if (!fs.existsSync(rootFilePath) || !fs.statSync(rootFilePath).isFile()) {
    return null;
  }

  const raw = fs.readFileSync(rootFilePath, 'utf8');
  const cleaned = blankCommentsPreservingNewlines(raw);
  const compRef = extractCompositionComponentRef(cleaned, compositionId);
  if (!compRef) {
    return null;
  }

  const imports = parseImportedModuleMap(cleaned);
  const binding = imports.get(compRef.ident);
  if (!binding) {
    // Component may be declared directly in Root.tsx
    const localDeclRe = new RegExp(
      `\\b(?:const|let|var|function|class)\\s+${compRef.ident}\\b`
    );
    return localDeclRe.test(cleaned) ? path.resolve(rootFilePath) : null;
  }

  const firstResolved = resolveRelativeTsSourceFile(
    path.resolve(path.dirname(rootFilePath), binding.specifier)
  );
  if (!firstResolved) {
    return null;
  }

  const targetSymbol =
    binding.importedName === '*'
      ? compRef.member ?? 'default'
      : binding.importedName;

  const chased = chaseSymbolToDefinition(
    firstResolved,
    targetSymbol,
    new Set<string>(),
    0
  );

  return chased ?? firstResolved;
}

/**
 * Collects local relative `.ts`/`.tsx` files imported by `entryFile` up to `maxDepth`,
 * useful for transitive Three.js detection without scanning unrelated files in `src/`.
 */
export function collectRelativeImportedFiles(
  entryFile: string,
  maxDepth = 2
): string[] {
  const result = new Set<string>();
  const walk = (filePath: string, depth: number) => {
    const abs = path.resolve(filePath);
    if (result.has(abs)) return;
    result.add(abs);
    if (depth >= maxDepth) return;
    let cleaned: string;
    try {
      cleaned = blankCommentsPreservingNewlines(fs.readFileSync(abs, 'utf8'));
    } catch {
      return;
    }
    const imports = parseImportedModuleMap(cleaned);
    for (const binding of imports.values()) {
      const next = resolveRelativeTsSourceFile(
        path.resolve(path.dirname(abs), binding.specifier)
      );
      if (next && !result.has(next)) {
        walk(next, depth + 1);
      }
    }
    const exportsInfo = parseReExports(cleaned);
    for (const binding of exportsInfo.namedReExports.values()) {
      const next = resolveRelativeTsSourceFile(
        path.resolve(path.dirname(abs), binding.specifier)
      );
      if (next && !result.has(next)) {
        walk(next, depth + 1);
      }
    }
    for (const wildSpec of exportsInfo.wildcardReExports) {
      const next = resolveRelativeTsSourceFile(
        path.resolve(path.dirname(abs), wildSpec)
      );
      if (next && !result.has(next)) {
        walk(next, depth + 1);
      }
    }
  };
  walk(entryFile, 0);
  return Array.from(result);
}
