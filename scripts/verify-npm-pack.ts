import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(SCRIPT_DIR, '..');

interface PackageSpec {
  dir: string;
  name: string;
  scopedInstallPath?: string;
}

const PACKAGES: PackageSpec[] = [
  {
    dir: 'packages/remotion',
    name: '@make-pictures/remotion',
    scopedInstallPath: '@make-pictures/remotion',
  },
  {
    dir: 'packages/cli',
    name: '@make-pictures/cli',
    scopedInstallPath: '@make-pictures/cli',
  },
  {
    dir: 'packages/create-make-pictures',
    name: 'create-make-pictures',
  },
];

const EXPECTED_SKILLS = [
  'art-direction-and-styles',
  'kits-2d',
  'kits-3d-and-kinematics',
  'make-pictures-director',
  'sound-and-music-design',
] as const;

const ZERO_THREE_SUBPATHS = [
  'index',
  'style/index',
  'style/presets',
  'audio/index',
  'audio/voices',
  'camera/index',
  'kinematics/index',
  'director/index',
  'optics/index',
  'types/index',
  'utils/index',
  'style-lab/index',
  'elements/index',
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function logStep(step: string): void {
  console.log(`\n==============================================================`);
  console.log(` ${step}`);
  console.log(`==============================================================`);
}

function runCmd(
  bin: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; label?: string }
): string {
  const display = options.label ?? `${bin} ${args.join(' ')}`;
  console.log(`  $ ${display}`);
  try {
    return execFileSync(bin, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    const execErr = err as { stdout?: string | Buffer; stderr?: string | Buffer };
    const out = execErr.stdout ? String(execErr.stdout).trim() : '';
    const errOut = execErr.stderr ? String(execErr.stderr).trim() : '';
    throw new Error(
      `Command failed: ${display}\n${out ? `STDOUT:\n${out}\n` : ''}${errOut ? `STDERR:\n${errOut}\n` : ''}`
    );
  }
}

function collectExportTargets(exportsField: unknown, out: Set<string>): void {
  if (!exportsField) return;
  if (typeof exportsField === 'string') {
    out.add(exportsField);
    return;
  }
  if (typeof exportsField === 'object') {
    for (const val of Object.values(exportsField as Record<string, unknown>)) {
      collectExportTargets(val, out);
    }
  }
}

function traceBuiltEsmImports(
  distDir: string,
  relEntry: string,
  seen = new Set<string>()
): Set<string> {
  const abs = path.resolve(distDir, relEntry);
  if (seen.has(abs) || !fs.existsSync(abs)) return seen;
  seen.add(abs);
  const code = fs.readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, code, ts.ScriptTarget.ES2022, false);
  const specs: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specs.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]!)
    ) {
      specs.push(node.arguments[0]!.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  for (const spec of specs) {
    if (spec.startsWith('.')) {
      const nextAbs = path.resolve(path.dirname(abs), spec);
      if (fs.existsSync(nextAbs)) {
        traceBuiltEsmImports(distDir, path.relative(distDir, nextAbs), seen);
      }
    } else {
      seen.add(`PKG:${spec}`);
    }
  }
  return seen;
}

function inspectTarball(
  pkg: PackageSpec,
  pkgDir: string,
  tarballPath: string
): void {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  assert(fs.existsSync(pkgJsonPath), `Missing ${pkg.dir}/package.json`);
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
    name?: string;
    version?: string;
    exports?: Record<string, unknown>;
    bin?: string | Record<string, string>;
  };

  assert(
    pkgJson.name === pkg.name,
    `Expected ${pkg.dir}/package.json name="${pkg.name}", got "${String(pkgJson.name)}"`
  );

  const rawEntries = execFileSync('tar', ['-tzf', tarballPath], {
    encoding: 'utf8',
  })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entrySet = new Set(rawEntries);

  // 1. Secret leak check
  for (const entry of entrySet) {
    const base = path.posix.basename(entry);
    assert(
      base !== '.env' && base !== '.env.local' && !base.startsWith('.env.'),
      `SECRET LEAK DETECTED in ${pkg.name} tarball: ${entry}`
    );
  }

  // 2. Verify every declared export target (.mjs, .cjs, .d.ts) exists in tarball
  if (pkgJson.exports) {
    for (const [subpathKey, subpathVal] of Object.entries(pkgJson.exports)) {
      const targets = new Set<string>();
      collectExportTargets(subpathVal, targets);
      assert(
        targets.size > 0,
        `${pkg.name} exports["${subpathKey}"] declared no target paths`
      );

      if (!subpathKey.endsWith('.css') && !subpathKey.endsWith('.json')) {
        const targetArr = Array.from(targets);
        assert(
          targetArr.some((t) => t.endsWith('.mjs')),
          `${pkg.name} exports["${subpathKey}"] is missing an ESM (.mjs) target`
        );
        assert(
          targetArr.some((t) => t.endsWith('.cjs')),
          `${pkg.name} exports["${subpathKey}"] is missing a CJS (.cjs) target`
        );
        assert(
          targetArr.some((t) => t.endsWith('.d.ts')),
          `${pkg.name} exports["${subpathKey}"] is missing a TypeScript (.d.ts) target`
        );
      }

      for (const relTarget of targets) {
        const cleanRel = relTarget.replace(/^\.\//, '');
        const archiveEntry = `package/${cleanRel}`;
        assert(
          entrySet.has(archiveEntry),
          `${pkg.name} tarball missing export target "${archiveEntry}" (from exports["${subpathKey}"])`
        );
      }
    }
  }

  // 3. Verify declared bin targets exist in tarball
  if (pkgJson.bin) {
    const binPaths =
      typeof pkgJson.bin === 'string'
        ? [pkgJson.bin]
        : Object.values(pkgJson.bin);
    for (const relBin of binPaths) {
      const archiveBin = `package/${relBin.replace(/^\.\//, '')}`;
      assert(
        entrySet.has(archiveBin),
        `${pkg.name} tarball missing bin target "${archiveBin}"`
      );
    }
  }

  // 4. Package-specific invariants
  if (pkg.name === '@make-pictures/remotion') {
    const distDir = path.join(pkgDir, 'dist');
    for (const sub of ZERO_THREE_SUBPATHS) {
      for (const ext of ['mjs', 'cjs'] as const) {
        const deps = [...traceBuiltEsmImports(distDir, `${sub}.${ext}`)];
        const forbidden = deps.filter((d) =>
          /^PKG:(three|@react-three\/|@remotion\/three)/.test(d)
        );
        assert(
          forbidden.length === 0,
          `@make-pictures/remotion/dist/${sub}.${ext} must not import optional 3D peers, found: ${forbidden.join(', ')}`
        );
      }
    }
  }

  if (pkg.name === '@make-pictures/cli') {
    assert(
      entrySet.has('package/dist/bin.mjs'),
      '@make-pictures/cli tarball must contain package/dist/bin.mjs'
    );
    for (const skill of EXPECTED_SKILLS) {
      const skillEntry = `package/assets/skills/${skill}/SKILL.md`;
      assert(
        entrySet.has(skillEntry),
        `@make-pictures/cli tarball missing bundled skill "${skillEntry}"`
      );
    }
  }

  console.log(
    `  ✓ ${pkg.name}: ${entrySet.size} files verified (exports, types, assets, zero secrets)`
  );
}

/**
 * Populates `<consumerDir>/node_modules` hermetically and 100% offline:
 * - Symlinks third-party dependencies from `<monorepo>/node_modules` (skipping `@make-pictures` & `create-make-pictures`).
 * - Extracts packed `.tgz` tarballs into `node_modules/@make-pictures/*`.
 * - Verifies via `realpathSync` that `@make-pictures/*` resolves inside `tmpRoot`.
 */
function populateHermeticConsumerNodeModules(params: {
  consumerDir: string;
  tmpRoot: string;
  tarballsByPkgName: Map<string, string>;
}): void {
  const { consumerDir, tmpRoot, tarballsByPkgName } = params;
  const monorepoNodeModules = path.join(MONOREPO_ROOT, 'node_modules');
  const consumerNodeModules = path.join(consumerDir, 'node_modules');
  fs.mkdirSync(consumerNodeModules, { recursive: true });

  for (const entry of fs.readdirSync(monorepoNodeModules, { withFileTypes: true })) {
    if (
      entry.name === '@make-pictures' ||
      entry.name === 'create-make-pictures' ||
      entry.name === '.bin' ||
      entry.name === '.cache' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }

    const srcPath = path.join(monorepoNodeModules, entry.name);
    const destPath = path.join(consumerNodeModules, entry.name);
    fs.symlinkSync(
      srcPath,
      destPath,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  }

  const realTmpRoot = fs.realpathSync(tmpRoot);
  for (const pkg of PACKAGES) {
    if (!pkg.scopedInstallPath) continue;
    const tarball = tarballsByPkgName.get(pkg.name);
    assert(tarball, `Missing packed tarball for ${pkg.name}`);

    const targetPkgDir = path.join(consumerNodeModules, pkg.scopedInstallPath);
    fs.mkdirSync(targetPkgDir, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      tarball,
      '-C',
      targetPkgDir,
      '--strip-components=1',
    ]);

    const stat = fs.lstatSync(targetPkgDir);
    assert(
      !stat.isSymbolicLink(),
      `${pkg.name} in consumer node_modules must NOT be a symlink`
    );
    const realInstalled = fs.realpathSync(targetPkgDir);
    assert(
      realInstalled.startsWith(realTmpRoot + path.sep),
      `${pkg.name} resolved outside tmpRoot (${realInstalled})`
    );
  }

  const consumerBinDir = path.join(consumerNodeModules, '.bin');
  fs.mkdirSync(consumerBinDir, { recursive: true });

  const monorepoBinDir = path.join(monorepoNodeModules, '.bin');
  if (fs.existsSync(monorepoBinDir)) {
    for (const binEntry of fs.readdirSync(monorepoBinDir)) {
      if (
        binEntry === 'make-pictures' ||
        binEntry === 'create-make-pictures' ||
        binEntry.startsWith('.')
      ) {
        continue;
      }
      const monoBinTarget = fs.realpathSync(path.join(monorepoBinDir, binEntry));
      const destBin = path.join(consumerBinDir, binEntry);
      if (!fs.existsSync(destBin)) {
        fs.symlinkSync(monoBinTarget, destBin);
      }
    }
  }

  const cliBinFile = path.join(
    consumerNodeModules,
    '@make-pictures',
    'cli',
    'dist',
    'bin.mjs'
  );
  assert(fs.existsSync(cliBinFile), `Missing unpacked CLI bin: ${cliBinFile}`);
  fs.chmodSync(cliBinFile, 0o755);

  fs.symlinkSync(
    path.relative(consumerBinDir, cliBinFile),
    path.join(consumerBinDir, 'make-pictures')
  );
}

function assertSyncedSkills(projectDir: string, label: string): void {
  for (const base of ['.agents/skills', '.claude/skills']) {
    for (const skill of EXPECTED_SKILLS) {
      const skillFile = path.join(projectDir, base, skill, 'SKILL.md');
      assert(
        fs.existsSync(skillFile),
        `${label} missing ${base}/${skill}/SKILL.md`
      );
      assert(
        fs.readFileSync(skillFile, 'utf8').trim().length > 0,
        `${label} ${base}/${skill}/SKILL.md is empty`
      );
    }
  }
}

async function main(): Promise<void> {
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-pack-verify-')
  );
  const tarballsDir = path.join(tmpRoot, 'tarballs');
  fs.mkdirSync(tarballsDir, { recursive: true });

  console.log(`🧪 Hermetic workspace: ${tmpRoot}`);

  try {
    // 1. Build all 3 workspace packages
    logStep('1/5 • Building all 3 packages (npm run build:packages)');
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    runCmd(npmBin, ['run', 'build:packages'], { cwd: MONOREPO_ROOT });

    // 2. Pack all 3 tarballs & inspect contents
    logStep('2/5 • Packing .tgz tarballs & auditing exports / skills / zero-three / secrets');
    const tarballsByPkgName = new Map<string, string>();

    for (const pkg of PACKAGES) {
      const pkgAbsDir = path.join(MONOREPO_ROOT, pkg.dir);
      const packStdout = runCmd(
        npmBin,
        ['pack', '--pack-destination', tarballsDir, '--silent'],
        {
          cwd: pkgAbsDir,
          label: `npm pack (${pkg.dir}) -> ${tarballsDir}`,
        }
      );
      const tgzFilename = packStdout
        .trim()
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.endsWith('.tgz'))
        .pop();
      assert(
        tgzFilename,
        `npm pack did not output a .tgz filename for ${pkg.name} (stdout: ${packStdout})`
      );
      const tgzPath = path.join(tarballsDir, tgzFilename);
      assert(fs.existsSync(tgzPath), `Tarball missing on disk: ${tgzPath}`);

      inspectTarball(pkg, pkgAbsDir, tgzPath);
      tarballsByPkgName.set(pkg.name, tgzPath);
    }

    const rootTgzLeaks = fs
      .readdirSync(MONOREPO_ROOT)
      .filter((f) => f.endsWith('.tgz'));
    assert(
      rootTgzLeaks.length === 0,
      `Tarball leaked into monorepo root: ${rootTgzLeaks.join(', ')}`
    );

    // 3. Path A — Fresh project via `create-make-pictures`
    logStep('3/5 • Path A: Fresh project via create-make-pictures');
    const createTarball = tarballsByPkgName.get('create-make-pictures');
    assert(createTarball, 'Missing create-make-pictures tarball');

    const unpackedCreateDir = path.join(tmpRoot, 'unpacked-create');
    fs.mkdirSync(unpackedCreateDir, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      createTarball,
      '-C',
      unpackedCreateDir,
      '--strip-components=1',
    ]);

    const createBin = path.join(unpackedCreateDir, 'dist', 'index.mjs');
    assert(fs.existsSync(createBin), `Missing ${createBin}`);

    const standaloneDir = path.join(tmpRoot, 'standalone-app');
    runCmd(
      process.execPath,
      [createBin, standaloneDir, '--lang=pl', '--no-install'],
      {
        cwd: tmpRoot,
        label:
          'node create-make-pictures/dist/index.mjs standalone-app --lang=pl --no-install',
      }
    );

    populateHermeticConsumerNodeModules({
      consumerDir: standaloneDir,
      tmpRoot,
      tarballsByPkgName,
    });

    const tscBin = path.join(standaloneDir, 'node_modules', '.bin', 'tsc');
    const mpBin = path.join(
      standaloneDir,
      'node_modules',
      '.bin',
      'make-pictures'
    );
    const remotionBin = path.join(
      standaloneDir,
      'node_modules',
      '.bin',
      'remotion'
    );

    // A1: Typecheck fresh scaffold
    runCmd(tscBin, ['--noEmit'], {
      cwd: standaloneDir,
      label: '(Path A) tsc --noEmit [initial]',
    });

    // A2: Scaffold new 2D video + generate mock audio + typecheck
    runCmd(process.execPath, [mpBin, 'new', 'demo', '--space=2d'], {
      cwd: standaloneDir,
      label: '(Path A) make-pictures new demo --space=2d',
    });
    runCmd(process.execPath, [mpBin, 'audio', 'demo', '--mock'], {
      cwd: standaloneDir,
      label: '(Path A) make-pictures audio demo --mock',
    });
    assert(
      fs.existsSync(
        path.join(standaloneDir, 'src', 'videos', 'demo', 'generated', 'audio-manifest.ts')
      ),
      'Path A missing generated/audio-manifest.ts for demo'
    );
    runCmd(tscBin, ['--noEmit'], {
      cwd: standaloneDir,
      label: '(Path A) tsc --noEmit [with demo video]',
    });

    // A3: Native Remotion QA on StyleLab
    runCmd(process.execPath, [mpBin, 'qa', 'StyleLab'], {
      cwd: standaloneDir,
      label: '(Path A) make-pictures qa StyleLab',
    });
    const qaStyleLabPng = path.join(standaloneDir, 'out', 'qa-StyleLab.png');
    assert(
      fs.existsSync(qaStyleLabPng) && fs.statSync(qaStyleLabPng).size > 10_000,
      `Expected valid QA contact sheet at ${qaStyleLabPng}`
    );

    // A4: Remotion Elements build
    runCmd(
      process.execPath,
      [mpBin, 'elements', 'build', '--out=out/elements'],
      {
        cwd: standaloneDir,
        label: '(Path A) make-pictures elements build --out=out/elements',
      }
    );
    const elementsIndexPath = path.join(
      standaloneDir,
      'out',
      'elements',
      'index.json'
    );
    assert(
      fs.existsSync(elementsIndexPath),
      `Expected ${elementsIndexPath}`
    );
    const elementsIndex = JSON.parse(
      fs.readFileSync(elementsIndexPath, 'utf8')
    ) as { count?: number; elements?: Array<{ slug: string }> };
    assert(
      elementsIndex.count === 7 && elementsIndex.elements?.length === 7,
      `Expected 7 built Remotion Elements, got ${elementsIndex.count}`
    );

    // A5: Short 0.5s Remotion render smoke (30 frames @ 60 FPS)
    runCmd(
      remotionBin,
      ['render', 'src/index.ts', 'StyleLab', 'out/smoke.mp4', '--frames=0-29'],
      {
        cwd: standaloneDir,
        label:
          '(Path A) remotion render src/index.ts StyleLab out/smoke.mp4 --frames=0-29',
      }
    );
    const smokeMp4 = path.join(standaloneDir, 'out', 'smoke.mp4');
    assert(
      fs.existsSync(smokeMp4) && fs.statSync(smokeMp4).size > 5_000,
      `Expected rendered smoke video at ${smokeMp4}`
    );
    console.log(
      `  ✓ Path A verified (typecheck, new demo, audio --mock, qa StyleLab, elements build [7], smoke render ${Math.round(fs.statSync(smokeMp4).size / 1024)} KB)`
    );

    // 4. Path B — Add-on `make-pictures init` inside a bare Remotion project
    logStep('4/5 • Path B: make-pictures init inside bare Remotion project');
    const bareRemotionDir = path.join(tmpRoot, 'bare-remotion');
    fs.mkdirSync(path.join(bareRemotionDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(bareRemotionDir, 'package.json'),
      JSON.stringify(
        {
          name: 'bare-remotion-app',
          version: '1.0.0',
          private: true,
          type: 'module',
          dependencies: {
            react: '^19.1.0',
            'react-dom': '^19.1.0',
            remotion: '^4.0.545',
            '@remotion/cli': '^4.0.545',
            '@remotion/bundler': '^4.0.545',
            '@remotion/renderer': '^4.0.545',
            '@remotion/google-fonts': '^4.0.545',
            '@remotion/media-utils': '^4.0.545',
            '@make-pictures/remotion': '^3.0.0',
            '@make-pictures/cli': '^3.0.0',
            'lucide-react': '^0.475.0',
            zod: '^3.24.2',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(bareRemotionDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ['src/**/*'],
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(bareRemotionDir, 'src', 'index.ts'),
      `import { registerRoot } from 'remotion';\nimport { RemotionRoot } from './Root';\nregisterRoot(RemotionRoot);\n`,
      'utf8'
    );
    const bareRootSource = `import React from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';

export const HelloWorld: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#F8FAFC' }} />;
  }
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#F8FAFC',
        color: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 48,
        fontWeight: 700,
      }}
    >
      Hello Bare Remotion
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="HelloWorld"
    component={HelloWorld}
    durationInFrames={300}
    fps={60}
    width={1920}
    height={1080}
  />
);
`;
    const bareRootPath = path.join(bareRemotionDir, 'src', 'Root.tsx');
    fs.writeFileSync(bareRootPath, bareRootSource, 'utf8');

    populateHermeticConsumerNodeModules({
      consumerDir: bareRemotionDir,
      tmpRoot,
      tarballsByPkgName,
    });

    const bareTscBin = path.join(bareRemotionDir, 'node_modules', '.bin', 'tsc');
    const bareMpBin = path.join(
      bareRemotionDir,
      'node_modules',
      '.bin',
      'make-pictures'
    );

    runCmd(process.execPath, [bareMpBin, 'init'], {
      cwd: bareRemotionDir,
      label: '(Path B) make-pictures init',
    });

    // Verify existing src/Root.tsx was NOT overwritten!
    assert(
      fs.readFileSync(bareRootPath, 'utf8') === bareRootSource,
      'Path B: make-pictures init MUST NOT modify existing src/Root.tsx'
    );
    assertSyncedSkills(bareRemotionDir, 'Path B bare Remotion project');

    runCmd(bareTscBin, ['--noEmit'], {
      cwd: bareRemotionDir,
      label: '(Path B) tsc --noEmit',
    });

    runCmd(process.execPath, [bareMpBin, 'qa', 'HelloWorld'], {
      cwd: bareRemotionDir,
      label: '(Path B) make-pictures qa HelloWorld',
    });
    const qaHelloPng = path.join(bareRemotionDir, 'out', 'qa-HelloWorld.png');
    assert(
      fs.existsSync(qaHelloPng) && fs.statSync(qaHelloPng).size > 5_000,
      `Expected valid QA contact sheet at ${qaHelloPng}`
    );
    console.log(
      `  ✓ Path B verified (existing src/Root.tsx untouched, 5 skills synced, tsc --noEmit, qa HelloWorld ${Math.round(fs.statSync(qaHelloPng).size / 1024)} KB)`
    );

    logStep('5/5 • Cleanup & Final Summary');
    console.log(
      '✅ ALL 3 NPM PACKAGES PACKED & VERIFIED END-TO-END (PATH A + PATH B)!'
    );
  } finally {
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
      console.log(`🧹 Cleaned hermetic temp directory: ${tmpRoot}`);
    }
  }
}

main().catch((err) => {
  console.error(
    '\n❌ npm pack verification failed:',
    err instanceof Error ? err.stack ?? err.message : err
  );
  process.exit(1);
});
