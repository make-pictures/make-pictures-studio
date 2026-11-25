import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild, { type Plugin as EsbuildPlugin } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

interface EntrySpec {
  /** Output subpath without extension relative to `dist/`, e.g. `index` or `kits/editorial-collage/index` */
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

const KNOWN_KIT_SUBPATHS = [
  'editorial-collage',
  'vector-scene-2d',
  'motion-diagrams-2d',
  'kinetic-typography',
  'data-storytelling',
  'product-frames',
  'vfx',
  'paper-diorama-3d',
  'isometric-3d',
  'tactile-3d',
] as const;

function mapOtherPackageToPublicSpecifier(
  otherPkgDirName: string,
  subpathInsideSrc: string
): string {
  const normalizedSub = subpathInsideSrc.replace(/\\/g, '/').replace(/^\/+/, '');
  if (otherPkgDirName === 'remotion') {
    if (
      normalizedSub === 'style/presets' ||
      normalizedSub.startsWith('style/presets.') ||
      normalizedSub === 'style/schema' ||
      normalizedSub.startsWith('style/schema.')
    ) {
      return '@make-pictures/remotion/style/presets';
    }
    if (normalizedSub === 'style' || normalizedSub.startsWith('style/')) {
      return '@make-pictures/remotion/style';
    }
    if (
      normalizedSub === 'audio/voices' ||
      normalizedSub.startsWith('audio/voices.')
    ) {
      return '@make-pictures/remotion/audio/voices';
    }
    if (normalizedSub === 'audio' || normalizedSub.startsWith('audio/')) {
      return '@make-pictures/remotion/audio';
    }
    if (normalizedSub === 'camera' || normalizedSub.startsWith('camera/')) {
      return '@make-pictures/remotion/camera';
    }
    if (
      normalizedSub === 'kinematics' ||
      normalizedSub.startsWith('kinematics/')
    ) {
      return '@make-pictures/remotion/kinematics';
    }
    if (normalizedSub === 'director' || normalizedSub.startsWith('director/')) {
      return '@make-pictures/remotion/director';
    }
    if (normalizedSub === 'optics' || normalizedSub.startsWith('optics/')) {
      return '@make-pictures/remotion/optics';
    }
    if (normalizedSub === 'types' || normalizedSub.startsWith('types/')) {
      return '@make-pictures/remotion/types';
    }
    if (normalizedSub === 'utils' || normalizedSub.startsWith('utils/')) {
      return '@make-pictures/remotion/utils';
    }
    if (
      normalizedSub === 'style-lab' ||
      normalizedSub.startsWith('style-lab/')
    ) {
      return '@make-pictures/remotion/style-lab';
    }
    if (normalizedSub === 'elements' || normalizedSub.startsWith('elements/')) {
      return '@make-pictures/remotion/elements';
    }
    for (const kit of KNOWN_KIT_SUBPATHS) {
      if (
        normalizedSub === `kits/${kit}` ||
        normalizedSub.startsWith(`kits/${kit}/`)
      ) {
        return `@make-pictures/remotion/kits/${kit}`;
      }
    }
    return '@make-pictures/remotion';
  }
  if (otherPkgDirName === 'cli') {
    return '@make-pictures/cli';
  }
  if (otherPkgDirName === 'create-make-pictures') {
    return 'create-make-pictures';
  }
  return `@make-pictures/${otherPkgDirName}`;
}

/**
 * Externalizes cross-package relative imports (such as `../../remotion/src/types/scene`
 * inside `packages/cli/src/*`) and rewrites them to public `@make-pictures/*` package specifiers
 * so React contexts and runtime registries remain singletons across published packages.
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
        ['remotion', 'cli', 'create-make-pictures'].includes(maybeOtherPkg)
      ) {
        const sub =
          parts[1] === 'src' ? parts.slice(2).join('/') : parts.slice(1).join('/');
        return mapOtherPackageToPublicSpecifier(maybeOtherPkg, sub);
      }
    }

    const posixSpec = rawSpec.replace(/\\/g, '/');
    const crossMatch = posixSpec.match(
      /^(?:\.\.\/)+(?:packages\/)?(remotion|cli|create-make-pictures)\/src(?:\/(.*))?$/
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
    throw new Error(`Missing package.json in packages/${spec.dirName}`);
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
  if (existingEntries.length !== spec.entries.length) {
    const missing = spec.entries
      .filter((e) => !fs.existsSync(path.join(pkgDir, e.srcRelPath)))
      .map((e) => e.srcRelPath);
    throw new Error(
      `Missing declared source entry points in packages/${spec.dirName}: ${missing.join(', ')}`
    );
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

    const useSplitting = group.length > 1 && platform === 'browser';

    // 1. ESM (.mjs)
    const esmResult = await esbuild.build({
      absWorkingDir: ROOT_DIR,
      entryPoints: entryPointsMap,
      outdir: distDir,
      outExtension: { '.js': '.mjs' },
      bundle: true,
      splitting: useSplitting,
      format: 'esm',
      platform,
      target: platform === 'node' ? 'node20' : 'es2022',
      jsx: 'automatic',
      packages: 'external',
      plugins: [crossPkgPlugin],
      metafile: useSplitting,
      logLevel: 'silent',
    });

    // 2. CJS (.cjs)
    const cjsGroup = group.filter((e) => !e.esmOnly);
    if (cjsGroup.length > 0) {
      if (useSplitting && esmResult.metafile) {
        // Convert every ESM-split output (entries + shared `chunk-*.mjs` modules)
        // into matching `.cjs` files so React contexts (StyleProvider, OpticalStage,
        // CameraTelemetry) and registries remain singletons across CJS subpaths,
        // while preserving exact ESM zero-three isolation.
        const cjsEntryPoints: Record<string, string> = {};
        const esmOnlyOutSubpaths = new Set(
          group.filter((e) => e.esmOnly).map((e) => e.outSubpath)
        );
        for (const outRelFromRoot of Object.keys(esmResult.metafile.outputs)) {
          if (!outRelFromRoot.endsWith('.mjs')) continue;
          const absOut = path.resolve(ROOT_DIR, outRelFromRoot);
          const relFromDist = path
            .relative(distDir, absOut)
            .replace(/\\/g, '/');
          if (relFromDist.startsWith('..')) continue;
          const outSubpath = relFromDist.slice(0, -'.mjs'.length);
          if (esmOnlyOutSubpaths.has(outSubpath)) continue;
          cjsEntryPoints[outSubpath] = absOut;
        }

        const rewriteRelativeMjsToCjsPlugin: EsbuildPlugin = {
          name: 'make-pictures-relative-mjs-to-cjs',
          setup(build) {
            build.onResolve({ filter: /^\./ }, (args) => {
              if (args.kind === 'entry-point') return null;
              if (!args.path.endsWith('.mjs')) return null;
              return {
                path: args.path.replace(/\.mjs$/, '.cjs'),
                external: true,
              };
            });
          },
        };

        await esbuild.build({
          absWorkingDir: ROOT_DIR,
          entryPoints: cjsEntryPoints,
          outdir: distDir,
          outExtension: { '.js': '.cjs' },
          bundle: true,
          format: 'cjs',
          platform,
          target: 'es2022',
          packages: 'external',
          plugins: [rewriteRelativeMjsToCjsPlugin],
          logLevel: 'silent',
        });
      } else {
        const cjsEntryMap: Record<string, string> = {};
        for (const entry of cjsGroup) {
          cjsEntryMap[entry.outSubpath] = path.join(pkgDir, entry.srcRelPath);
        }

        await esbuild.build({
          absWorkingDir: ROOT_DIR,
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
      dirName: 'remotion',
      npmName: '@make-pictures/remotion',
      entries: [
        { outSubpath: 'index', srcRelPath: 'src/index.ts', platform: 'browser' },
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
          outSubpath: 'audio/index',
          srcRelPath: 'src/audio/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'audio/voices',
          srcRelPath: 'src/audio/voices.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'camera/index',
          srcRelPath: 'src/camera/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kinematics/index',
          srcRelPath: 'src/kinematics/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'director/index',
          srcRelPath: 'src/director/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'optics/index',
          srcRelPath: 'src/optics/index.ts',
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
        {
          outSubpath: 'style-lab/index',
          srcRelPath: 'src/style-lab/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'elements/index',
          srcRelPath: 'src/elements/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/editorial-collage/index',
          srcRelPath: 'src/kits/editorial-collage/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/vector-scene-2d/index',
          srcRelPath: 'src/kits/vector-scene-2d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/motion-diagrams-2d/index',
          srcRelPath: 'src/kits/motion-diagrams-2d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/kinetic-typography/index',
          srcRelPath: 'src/kits/kinetic-typography/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/data-storytelling/index',
          srcRelPath: 'src/kits/data-storytelling/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/product-frames/index',
          srcRelPath: 'src/kits/product-frames/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/vfx/index',
          srcRelPath: 'src/kits/vfx/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/paper-diorama-3d/index',
          srcRelPath: 'src/kits/paper-diorama-3d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/isometric-3d/index',
          srcRelPath: 'src/kits/isometric-3d/index.ts',
          platform: 'browser',
        },
        {
          outSubpath: 'kits/tactile-3d/index',
          srcRelPath: 'src/kits/tactile-3d/index.ts',
          platform: 'browser',
        },
      ],
    },
    {
      dirName: 'cli',
      npmName: '@make-pictures/cli',
      entries: discoverCliEntries(path.join(PACKAGES_DIR, 'cli')),
      copyAssets(pkgDir) {
        const skillsSrc = path.join(ROOT_DIR, 'skills');
        const assetsRoot = path.join(pkgDir, 'assets');
        const skillsDest = path.join(assetsRoot, 'skills');
        fs.rmSync(assetsRoot, { recursive: true, force: true });
        if (!fs.existsSync(skillsSrc)) {
          throw new Error(`Missing canonical root skills directory: ${skillsSrc}`);
        }
        copyDirRecursive(skillsSrc, skillsDest);
      },
    },
    {
      dirName: 'create-make-pictures',
      npmName: 'create-make-pictures',
      entries: discoverCreateMakePicturesEntries(
        path.join(PACKAGES_DIR, 'create-make-pictures')
      ),
    },
  ];

  console.log('[build:packages] Building 3 make.pictures v3.0 packages…');
  for (const spec of specs) {
    await buildPackage(spec);
  }
  console.log('[build:packages] All 3 workspace packages built cleanly.');
}

main().catch((err) => {
  console.error('[build:packages] Build failed:', err);
  process.exit(1);
});
