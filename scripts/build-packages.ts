import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild, { type Plugin as EsbuildPlugin } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

interface EntrySpec {
  /** Output subpath without extension relative to `dist/`, e.g. `index` or `client/index` */
  outSubpath: string;
  /** Input source file relative to package dir, e.g. `src/index.ts` */
  srcRelPath: string;
  platform: 'browser' | 'node';
  executableShebang?: boolean;
  esmOnly?: boolean;
}

interface PackageBuildSpec {
  dirName: string;
  npmName: string;
  entries: EntrySpec[];
  copyAssets?: (pkgDir: string) => void;
}

function mapOtherPackageToPublicSpecifier(
  otherPkgDirName: string,
  subpathInsideSrc: string
): string {
  const normalizedSub = subpathInsideSrc.replace(/\\/g, '/').replace(/^\/+/, '');
  if (otherPkgDirName === 'core') {
    if (
      normalizedSub === 'style/presets' ||
      normalizedSub.startsWith('style/presets.') ||
      normalizedSub === 'style/schema' ||
      normalizedSub.startsWith('style/schema.')
    ) {
      return '@make-pictures/core/style/presets';
    }
    return '@make-pictures/core';
  }
  if (otherPkgDirName === 'kits') {
    const knownKitSubpaths = [
      'paper-diorama-3d',
      'isometric-3d',
      'motion-diagrams-2d',
      'vfx',
      'kinetic-typography',
      'data-storytelling',
      'product-frames',
      'editorial-collage',
      'vector-scene-2d',
    ];
    for (const sub of knownKitSubpaths) {
      if (normalizedSub === sub || normalizedSub.startsWith(`${sub}/`)) {
        return `@make-pictures/kits/${sub}`;
      }
    }
    return '@make-pictures/kits';
  }
  if (otherPkgDirName === 'studio') {
    if (normalizedSub === 'server' || normalizedSub.startsWith('server/')) {
      return '@make-pictures/studio/server';
    }
    if (normalizedSub === 'client' || normalizedSub.startsWith('client/')) {
      return '@make-pictures/studio/client';
    }
    return '@make-pictures/studio';
  }
  if (otherPkgDirName === 'cli') {
    return '@make-pictures/cli';
  }
  return `@make-pictures/${otherPkgDirName}`;
}

/**
 * Externalizes cross-package relative imports (such as `../../../core/src/camera`
 * inside `packages/kits/src/vfx/*` or `../../core/src/types/scene` inside `packages/cli/src/*`)
 * and rewrites them to public `@make-pictures/*` package specifiers so React contexts
 * and runtime registries remain singletons across published packages.
 */
function createCrossPackageExternalPlugin(
  currentPkgDirName: string
): EsbuildPlugin {
  return {
    name: 'make-pictures-cross-package-external',
    setup(build) {
      build.onResolve({ filter: /^@make-pictures\// }, (args) => ({
        path: args.path,
        external: true,
      }));

      build.onResolve({ filter: /^\./ }, (args) => {
        if (!args.resolveDir) return null;
        const resolvedAbs = path.resolve(args.resolveDir, args.path);
        if (!resolvedAbs.startsWith(PACKAGES_DIR + path.sep)) return null;

        const relFromPackages = path.relative(PACKAGES_DIR, resolvedAbs);
        const parts = relFromPackages.split(path.sep);
        const targetPkgDirName = parts[0];
        if (!targetPkgDirName || targetPkgDirName === currentPkgDirName) {
          return null;
        }

        const subpathInsideSrc =
          parts[1] === 'src' ? parts.slice(2).join('/') : parts.slice(1).join('/');
        const publicSpecifier = mapOtherPackageToPublicSpecifier(
          targetPkgDirName,
          subpathInsideSrc
        );
        return {
          path: publicSpecifier,
          external: true,
        };
      });
    },
  };
}

function resolveLocalTscBin(): string {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const localTsc = path.join(ROOT_DIR, 'node_modules', '.bin', `tsc${ext}`);
  return fs.existsSync(localTsc) ? localTsc : 'tsc';
}

function rewriteDtsCrossPackageSpecifiers(
  dtsContent: string,
  dtsFileAbsInTmp: string,
  tmpDtsRoot: string,
  currentPkgDirName: string
): string {
  const replaceSpec = (rawSpec: string): string => {
    if (!rawSpec.startsWith('.')) return rawSpec;

    const resolvedInTmp = path.resolve(path.dirname(dtsFileAbsInTmp), rawSpec);
    if (resolvedInTmp.startsWith(tmpDtsRoot + path.sep)) {
      const relToTmp = path.relative(tmpDtsRoot, resolvedInTmp);
      const parts = relToTmp.split(path.sep);
      const maybeOtherPkg = parts[0];
      if (
        maybeOtherPkg &&
        maybeOtherPkg !== currentPkgDirName &&
        ['core', 'kits', 'studio', 'cli', 'create-make-pictures'].includes(
          maybeOtherPkg
        )
      ) {
        const sub =
          parts[1] === 'src' ? parts.slice(2).join('/') : parts.slice(1).join('/');
        return mapOtherPackageToPublicSpecifier(maybeOtherPkg, sub);
      }
    }

    const posixSpec = rawSpec.replace(/\\/g, '/');
    const crossMatch = posixSpec.match(
      /^(?:\.\.\/)+(?:packages\/)?(core|kits|studio|cli)\/src(?:\/(.*))?$/
    );
    if (crossMatch && crossMatch[1] !== currentPkgDirName) {
      return mapOtherPackageToPublicSpecifier(
        crossMatch[1],
        crossMatch[2] ?? ''
      );
    }

    return rawSpec;
  };

  return dtsContent
    .replace(
      /(from\s+['"])([^'"]+)(['"])/g,
      (_full, pre: string, spec: string, post: string) =>
        `${pre}${replaceSpec(spec)}${post}`
    )
    .replace(
      /(import\(\s*['"])([^'"]+)(['"]\s*\))/g,
      (_full, pre: string, spec: string, post: string) =>
        `${pre}${replaceSpec(spec)}${post}`
    );
}

function copyAndSanitizeDtsTree(
  srcDir: string,
  destDir: string,
  tmpDtsRoot: string,
  currentPkgDirName: string
): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyAndSanitizeDtsTree(srcPath, destPath, tmpDtsRoot, currentPkgDirName);
    } else if (entry.name.endsWith('.d.ts')) {
      const raw = fs.readFileSync(srcPath, 'utf8');
      const cleaned = rewriteDtsCrossPackageSpecifiers(
        raw,
        srcPath,
        tmpDtsRoot,
        currentPkgDirName
      );
      fs.writeFileSync(destPath, cleaned, 'utf8');
    }
  }
}

function emitPackageDeclarations(pkgDir: string, pkgDirName: string): void {
  const tsconfigBuildPath = path.join(pkgDir, 'tsconfig.build.json');
  const tmpDtsDir = path.join(pkgDir, '.dts-tmp');
  fs.rmSync(tmpDtsDir, { recursive: true, force: true });

  const tscBin = resolveLocalTscBin();
  const tscArgs = fs.existsSync(tsconfigBuildPath)
    ? [
        '-p',
        tsconfigBuildPath,
        '--declaration',
        '--emitDeclarationOnly',
        '--noEmit',
        'false',
        '--outDir',
        tmpDtsDir,
      ]
    : [
        path.join(pkgDir, 'src', 'index.ts'),
        '--declaration',
        '--emitDeclarationOnly',
        '--moduleResolution',
        'bundler',
        '--module',
        'ESNext',
        '--target',
        'ES2022',
        '--jsx',
        'react-jsx',
        '--skipLibCheck',
        '--esModuleInterop',
        '--resolveJsonModule',
        '--outDir',
        tmpDtsDir,
      ];

  const res = spawnSync(tscBin, tscArgs, {
    cwd: pkgDir,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (res.status !== 0) {
    fs.rmSync(tmpDtsDir, { recursive: true, force: true });
    throw new Error(
      `TypeScript declaration emit failed for packages/${pkgDirName}:\n${
        res.stdout || ''
      }\n${res.stderr || ''}`
    );
  }

  let emittedSrcRoot = tmpDtsDir;
  if (fs.existsSync(path.join(tmpDtsDir, pkgDirName, 'src'))) {
    emittedSrcRoot = path.join(tmpDtsDir, pkgDirName, 'src');
  } else if (fs.existsSync(path.join(tmpDtsDir, 'src'))) {
    emittedSrcRoot = path.join(tmpDtsDir, 'src');
  }

  copyAndSanitizeDtsTree(
    emittedSrcRoot,
    path.join(pkgDir, 'dist'),
    tmpDtsDir,
    pkgDirName
  );
  fs.rmSync(tmpDtsDir, { recursive: true, force: true });
}

function ensureExecutableShebang(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  const stripped = raw.replace(/^(#!.*\r?\n)+/, '');
  fs.writeFileSync(filePath, `#!/usr/bin/env node\n${stripped}`, 'utf8');
  fs.chmodSync(filePath, 0o755);
}

function copyDirRecursive(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildPackage(spec: PackageBuildSpec): Promise<void> {
  const pkgDir = path.join(PACKAGES_DIR, spec.dirName);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    console.log(
      `[build:packages] Skipping packages/${spec.dirName} (package.json not present yet)`
    );
    return;
  }

  const distDir = path.join(pkgDir, 'dist');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const existingEntries = spec.entries.filter((e) =>
    fs.existsSync(path.join(pkgDir, e.srcRelPath))
  );
  if (existingEntries.length === 0) {
    throw new Error(`No source entry points found in packages/${spec.dirName}`);
  }

  const crossPkgPlugin = createCrossPackageExternalPlugin(spec.dirName);

  // Group entries by platform so browser ESM bundles can use `splitting: true`
  // (sharing singletons such as RegisteredVoiceoverManifest, CameraContext, and LRU TextureCache!)
  for (const platform of ['browser', 'node'] as const) {
    const group = existingEntries.filter((e) => e.platform === platform);
    if (group.length === 0) continue;

    const entryPointsMap: Record<string, string> = {};
    for (const entry of group) {
      entryPointsMap[entry.outSubpath] = path.join(pkgDir, entry.srcRelPath);
    }

    // 1. ESM (.mjs)
    await esbuild.build({
      entryPoints: entryPointsMap,
      outdir: distDir,
      outExtension: { '.js': '.mjs' },
      bundle: true,
      splitting: group.length > 1 && platform === 'browser',
      format: 'esm',
      platform,
      target: platform === 'node' ? 'node20' : 'es2022',
      jsx: 'automatic',
      packages: 'external',
      plugins: [crossPkgPlugin],
      logLevel: 'silent',
    });

    // 2. CJS (.cjs)
    const cjsGroup = group.filter((e) => !e.esmOnly);
    if (cjsGroup.length > 0) {
      const cjsEntryMap: Record<string, string> = {};
      for (const entry of cjsGroup) {
        cjsEntryMap[entry.outSubpath] = path.join(pkgDir, entry.srcRelPath);
      }

      await esbuild.build({
        entryPoints: cjsEntryMap,
        outdir: distDir,
        outExtension: { '.js': '.cjs' },
        bundle: true,
        format: 'cjs',
        platform,
        target: platform === 'node' ? 'node20' : 'es2022',
        jsx: 'automatic',
        packages: 'external',
        plugins: [crossPkgPlugin],
        logLevel: 'silent',
      });
    }
  }

  // 3. Emit and sanitize `.d.ts` declarations
  emitPackageDeclarations(pkgDir, spec.dirName);

  // 4. Executable shebangs & 0o755 permissions on CLI binaries
  for (const entry of existingEntries) {
    if (entry.executableShebang) {
      ensureExecutableShebang(path.join(distDir, `${entry.outSubpath}.mjs`));
    }
  }

  // 5. Copy package-specific static assets + root LICENSE
  spec.copyAssets?.(pkgDir);

  const rootLicense = path.join(ROOT_DIR, 'LICENSE');
  if (fs.existsSync(rootLicense)) {
    fs.copyFileSync(rootLicense, path.join(pkgDir, 'LICENSE'));
  }

  console.log(`✓ Built ${spec.npmName} -> packages/${spec.dirName}/dist/`);
}

function discoverCliEntries(cliPkgDir: string): EntrySpec[] {
  const entries: EntrySpec[] = [
    {
      outSubpath: 'index',
      srcRelPath: 'src/index.ts',
      platform: 'node',
    },
  ];
  if (fs.existsSync(path.join(cliPkgDir, 'src', 'bin.ts'))) {
    entries.push({
      outSubpath: 'bin',
      srcRelPath: 'src/bin.ts',
      platform: 'node',
      executableShebang: true,
    });
  } else {
    entries[0].executableShebang = true;
  }
  return entries;
}

function discoverCreateMakePicturesEntries(createPkgDir: string): EntrySpec[] {
  const entries: EntrySpec[] = [];
  if (fs.existsSync(path.join(createPkgDir, 'src', 'index.ts'))) {
    entries.push({
      outSubpath: 'index',
      srcRelPath: 'src/index.ts',
      platform: 'node',
      executableShebang: true,
    });
  }
  if (fs.existsSync(path.join(createPkgDir, 'src', 'bin.ts'))) {
    entries.push({
      outSubpath: 'bin',
      srcRelPath: 'src/bin.ts',
      platform: 'node',
      executableShebang: true,
    });
  }
  return entries;
}

async function main(): Promise<void> {
  const specs: PackageBuildSpec[] = [
    {
      dirName: 'core',
      npmName: '@make-pictures/core',
      entries: [
        { outSubpath: 'index', srcRelPath: 'src/index.ts', platform: 'browser' },
        {
          outSubpath: 'audio/index',
          srcRelPath: 'src/audio/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'camera/index',
          srcRelPath: 'src/camera/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'style/index',
          srcRelPath: 'src/style/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'style/presets',
          srcRelPath: 'src/style/presets.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'theme/index',
          srcRelPath: 'src/theme/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'types/index',
          srcRelPath: 'src/types/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'utils/index',
          srcRelPath: 'src/utils/index.ts',
          platform: 'browser',
        },
      ],
    },
    {
      dirName: 'kits',
      npmName: '@make-pictures/kits',
      entries: [
        { outSubpath: 'index', srcRelPath: 'src/index.ts', platform: 'browser' },
        {
          outSubpath: 'paper-diorama-3d/index',
          srcRelPath: 'src/paper-diorama-3d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'isometric-3d/index',
          srcRelPath: 'src/isometric-3d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'motion-diagrams-2d/index',
          srcRelPath: 'src/motion-diagrams-2d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'vfx/index',
          srcRelPath: 'src/vfx/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kinetic-typography/index',
          srcRelPath: 'src/kinetic-typography/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'data-storytelling/index',
          srcRelPath: 'src/data-storytelling/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'product-frames/index',
          srcRelPath: 'src/product-frames/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'editorial-collage/index',
          srcRelPath: 'src/editorial-collage/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'vector-scene-2d/index',
          srcRelPath: 'src/vector-scene-2d/index.ts',
          platform: 'browser',
        },
      ],
    },
    {
      dirName: 'studio',
      npmName: '@make-pictures/studio',
      entries: [
        { outSubpath: 'index', srcRelPath: 'src/index.ts', platform: 'browser' },
        {
          outSubpath: 'client/index',
          srcRelPath: 'src/client/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'server/index',
          srcRelPath: 'src/server/index.ts',
          platform: 'node',
        },
      ],
      copyAssets(pkgDir) {
        const srcCss = path.join(pkgDir, 'src', 'client', 'styles.css');
        const destCss = path.join(pkgDir, 'dist', 'styles.css');
        fs.copyFileSync(srcCss, destCss);
      },
    },
    {
      dirName: 'cli',
      npmName: '@make-pictures/cli',
      entries: discoverCliEntries(path.join(PACKAGES_DIR, 'cli')),
      copyAssets(pkgDir) {
        const pluginSrc = path.join(ROOT_DIR, 'plugins', 'make-pictures');
        const pluginDest = path.join(pkgDir, 'assets', 'plugin');
        fs.rmSync(pluginDest, { recursive: true, force: true });
        if (fs.existsSync(pluginSrc)) {
          copyDirRecursive(pluginSrc, pluginDest);
        }
      },
    },
    {
      dirName: 'create-make-pictures',
      npmName: 'create-make-pictures',
      entries: discoverCreateMakePicturesEntries(
        path.join(PACKAGES_DIR, 'create-make-pictures')
      ),
      copyAssets(pkgDir) {
        const pluginSrc = path.join(ROOT_DIR, 'plugins', 'make-pictures');
        const pluginDest = path.join(pkgDir, 'assets', 'plugin');
        fs.rmSync(pluginDest, { recursive: true, force: true });
        if (fs.existsSync(pluginSrc)) {
          copyDirRecursive(pluginSrc, pluginDest);
        }
      },
    },
  ];

  console.log('[build:packages] Building @make-pictures/* npm workspaces…');
  for (const spec of specs) {
    await buildPackage(spec);
  }
  console.log('[build:packages] All present workspace packages built cleanly.');
}

main().catch((err) => {
  console.error('[build:packages] Build failed:', err);
  process.exit(1);
});
