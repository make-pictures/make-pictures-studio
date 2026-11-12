import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(SCRIPT_DIR, '..');

interface PackageSpec {
  dir: string;
  name: string;
  scopedInstallPath?: string;
}

const PACKAGES: PackageSpec[] = [
  {
    dir: 'packages/core',
    name: '@make-pictures/core',
    scopedInstallPath: '@make-pictures/core',
  },
  {
    dir: 'packages/kits',
    name: '@make-pictures/kits',
    scopedInstallPath: '@make-pictures/kits',
  },
  {
    dir: 'packages/studio',
    name: '@make-pictures/studio',
    scopedInstallPath: '@make-pictures/studio',
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
  'make-pictures-director',
  'style-and-art-direction',
  'kit-editorial-and-vector',
  'kit-paper-diorama-3d',
  'kit-motion-diagrams-2d',
  'kit-isometric-3d',
  'kit-kinetic-and-data',
  'sound-and-music-design',
  'cinematography-and-vfx',
];

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

  // 1. Secret leak check: ZERO .env or .env.local files allowed in any tarball
  for (const entry of entrySet) {
    const base = path.posix.basename(entry);
    assert(
      base !== '.env' && base !== '.env.local' && !base.startsWith('.env.'),
      `SECRET LEAK DETECTED in ${pkg.name} tarball: ${entry}`
    );
  }

  // 2. Verify every declared export target (.mjs, .cjs, .d.ts, .css) exists in tarball
  if (pkgJson.exports) {
    for (const [subpathKey, subpathVal] of Object.entries(pkgJson.exports)) {
      const targets = new Set<string>();
      collectExportTargets(subpathVal, targets);
      assert(
        targets.size > 0,
        `${pkg.name} exports["${subpathKey}"] declared no target paths`
      );

      // For JS module entries (not .css / .json), require .mjs, .cjs, and .d.ts
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

  // 4. Package-specific asset assertions
  if (pkg.name === '@make-pictures/core') {
    for (const ext of ['mjs', 'cjs', 'd.ts']) {
      const styleEntry = `package/dist/style/index.${ext}`;
      assert(
        entrySet.has(styleEntry),
        `@make-pictures/core tarball must contain ${styleEntry}`
      );
    }
  }

  if (pkg.name === '@make-pictures/kits') {
    for (const subpath of [
      'product-frames',
      'editorial-collage',
      'vector-scene-2d',
    ]) {
      for (const ext of ['mjs', 'cjs', 'd.ts']) {
        const kitEntry = `package/dist/${subpath}/index.${ext}`;
        assert(
          entrySet.has(kitEntry),
          `@make-pictures/kits tarball must contain ${kitEntry}`
        );
      }
    }
  }

  if (pkg.name === '@make-pictures/studio') {
    assert(
      entrySet.has('package/dist/styles.css'),
      '@make-pictures/studio tarball must contain package/dist/styles.css'
    );
  }

  if (pkg.name === '@make-pictures/cli' || pkg.name === 'create-make-pictures') {
    if (pkg.name === '@make-pictures/cli') {
      assert(
        entrySet.has('package/dist/bin.mjs'),
        '@make-pictures/cli tarball must contain package/dist/bin.mjs'
      );
    }
    assert(
      entrySet.has('package/assets/plugin/plugin.json'),
      `${pkg.name} tarball must contain package/assets/plugin/plugin.json`
    );
    for (const skill of EXPECTED_SKILLS) {
      const skillEntry = `package/assets/plugin/skills/${skill}/SKILL.md`;
      assert(
        entrySet.has(skillEntry),
        `${pkg.name} tarball missing bundled skill "${skillEntry}"`
      );
    }
  }

  console.log(
    `  ✓ ${pkg.name}: ${entrySet.size} files verified (exports, types, assets, zero secrets)`
  );
}

/**
 * Populates `<consumerDir>/node_modules` hermetically and 100% offline:
 * - Symlinks third-party dependencies from `<monorepo>/node_modules` (strictly skipping
 *   `@make-pictures`, `create-make-pictures`, `.bin`, and `.cache`).
 * - Extracts the packed `.tgz` tarballs directly into `node_modules/@make-pictures/*`.
 * - Verifies via `realpathSync` that `@make-pictures/*` resolves inside `tmpRoot`, never monorepo source.
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

  const entries = fs.readdirSync(monorepoNodeModules, { withFileTypes: true });
  for (const entry of entries) {
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

  // Extract actual packed @make-pictures/* tarballs
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

  // Populate node_modules/.bin
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

  const makePicturesBinLink = path.join(consumerBinDir, 'make-pictures');
  fs.symlinkSync(
    path.relative(consumerBinDir, cliBinFile),
    makePicturesBinLink
  );
}

function assertAgentAndClaudeSkillsDiscovery(
  projectDir: string,
  label: string
): void {
  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  assert(fs.existsSync(agentsMdPath), `${label} missing AGENTS.md`);
  assert(
    fs.readFileSync(agentsMdPath, 'utf8').trim().length > 0,
    `${label} AGENTS.md is empty`
  );

  const claudeMdPath = path.join(projectDir, 'CLAUDE.md');
  assert(fs.existsSync(claudeMdPath), `${label} missing CLAUDE.md`);
  assert(
    fs.readFileSync(claudeMdPath, 'utf8').trim().length > 0,
    `${label} CLAUDE.md is empty`
  );

  const pluginJsonPath = path.join(
    projectDir,
    '.agents',
    'plugins',
    'make-pictures',
    'plugin.json'
  );
  assert(
    fs.existsSync(pluginJsonPath),
    `${label} missing .agents/plugins/make-pictures/plugin.json`
  );

  for (const skill of EXPECTED_SKILLS) {
    const agentSkillFile = path.join(
      projectDir,
      '.agents',
      'plugins',
      'make-pictures',
      'skills',
      skill,
      'SKILL.md'
    );
    assert(
      fs.existsSync(agentSkillFile),
      `${label} missing .agents/plugins/make-pictures/skills/${skill}/SKILL.md`
    );

    const claudeSkillFile = path.join(
      projectDir,
      '.claude',
      'skills',
      skill,
      'SKILL.md'
    );
    assert(
      fs.existsSync(claudeSkillFile),
      `${label} missing .claude/skills/${skill}/SKILL.md`
    );
    const resolvedClaudeSkill = fs.realpathSync(claudeSkillFile);
    assert(
      fs.readFileSync(resolvedClaudeSkill, 'utf8').trim().length > 0,
      `${label} .claude/skills/${skill}/SKILL.md resolved to empty file (${resolvedClaudeSkill})`
    );
  }
}

function assertGitignoreAllowsProductions(gitignorePath: string): void {
  assert(fs.existsSync(gitignorePath), `Missing .gitignore at ${gitignorePath}`);
  const lines = fs
    .readFileSync(gitignorePath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  for (const line of lines) {
    assert(
      line !== 'productions' &&
        line !== 'productions/' &&
        line !== 'productions/*' &&
        line !== '/productions' &&
        line !== '/productions/',
      `Standalone consumer .gitignore MUST NOT ignore productions/, found "${line}"`
    );
  }
}

function findFreeLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Could not allocate free TCP port')));
        return;
      }
      const port = addr.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function httpGetLocal(
  port: number,
  reqPath: string
): Promise<{ statusCode: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        headers: { Connection: 'close' },
        timeout: 4000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            contentType: String(res.headers['content-type'] ?? ''),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout GET ${reqPath}`));
    });
    req.on('error', reject);
  });
}

async function verifyStandaloneStudioServer(standaloneDir: string): Promise<void> {
  const port = await findFreeLocalPort();
  const makePicturesBin = path.join(
    standaloneDir,
    'node_modules',
    '.bin',
    'make-pictures'
  );

  console.log(
    `  $ node ./node_modules/.bin/make-pictures studio --port=${port} --host=127.0.0.1`
  );

  const child: ChildProcess = spawn(
    process.execPath,
    [makePicturesBin, 'studio', `--port=${port}`, '--host=127.0.0.1'],
    {
      cwd: standaloneDir,
      env: { ...process.env, CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let serverLogs = '';
  child.stdout?.on('data', (buf: Buffer) => {
    serverLogs += buf.toString('utf8');
  });
  child.stderr?.on('data', (buf: Buffer) => {
    serverLogs += buf.toString('utf8');
  });

  const killServer = async (): Promise<void> => {
    if (child.exitCode !== null) return;
    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill('SIGKILL');
        }
      }, 2500);
      child.once('exit', () => {
        clearTimeout(killTimer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  };

  try {
    const deadline = Date.now() + 20_000;
    let statusReady = false;
    let lastErr = '';

    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(
          `make-pictures studio exited prematurely (code ${child.exitCode}):\n${serverLogs}`
        );
      }
      try {
        const statusRes = await httpGetLocal(port, '/api/studio/status');
        if (statusRes.statusCode === 200) {
          const parsed = JSON.parse(statusRes.body) as {
            scenes?: Record<string, unknown>;
          };
          assert(
            parsed && typeof parsed === 'object' && parsed.scenes,
            `/api/studio/status returned unexpected JSON: ${statusRes.body.slice(0, 200)}`
          );
          statusReady = true;
          break;
        }
        lastErr = `HTTP ${statusRes.statusCode}`;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    assert(
      statusReady,
      `Timed out waiting for Studio server /api/studio/status (${lastErr}):\n${serverLogs}`
    );

    const stylesRes = await httpGetLocal(port, '/api/studio/styles');
    assert(
      stylesRes.statusCode === 200,
      `Expected GET /api/studio/styles -> 200 OK, got ${stylesRes.statusCode}: ${stylesRes.body.slice(0, 200)}`
    );
    const parsedStyles = JSON.parse(stylesRes.body) as {
      ok?: boolean;
      styles?: Array<{ id?: string }>;
    };
    assert(
      parsedStyles &&
        parsedStyles.ok === true &&
        Array.isArray(parsedStyles.styles),
      `/api/studio/styles returned unexpected JSON: ${stylesRes.body.slice(0, 200)}`
    );
    assert(
      parsedStyles.styles.some((s) => s.id === 'bespoke-editorial'),
      `Expected /api/studio/styles to include custom style "bespoke-editorial", got: ${stylesRes.body.slice(0, 200)}`
    );

    const htmlRes = await httpGetLocal(port, '/');
    assert(
      htmlRes.statusCode === 200,
      `Expected GET / -> 200 OK, got ${htmlRes.statusCode}`
    );
    assert(
      htmlRes.body.toLowerCase().includes('<html') &&
        htmlRes.body.includes('<script'),
      `Expected GET / to return Studio HTML shell, got:\n${htmlRes.body.slice(0, 300)}`
    );

    // Also verify Vite transforms the virtual entry script without module resolution errors
    const scriptMatch = htmlRes.body.match(
      /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i
    );
    if (scriptMatch?.[1]) {
      const modRes = await httpGetLocal(port, scriptMatch[1]);
      assert(
        modRes.statusCode === 200,
        `Expected virtual entry ${scriptMatch[1]} -> 200 OK, got ${modRes.statusCode}:\n${modRes.body.slice(0, 400)}`
      );
    }

    console.log(
      `  ✓ Studio Web server verified at http://127.0.0.1:${port} (GET /api/studio/status 200 + GET /api/studio/styles 200 + GET / 200 HTML)`
    );
  } finally {
    await killServer();
  }
}

async function main(): Promise<void> {
  const keepQaArg = process.argv
    .slice(2)
    .find((a) => a.startsWith('--keep-qa-copy='));
  const keepQaCopyPath = keepQaArg
    ? path.resolve(process.cwd(), keepQaArg.slice('--keep-qa-copy='.length))
    : null;

  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-pack-verify-')
  );
  const tarballsDir = path.join(tmpRoot, 'tarballs');
  fs.mkdirSync(tarballsDir, { recursive: true });

  console.log(`🧪 Hermetic workspace: ${tmpRoot}`);

  try {
    // 1. Build all 5 workspace packages
    logStep('1/5 • Building all 5 packages (npm run build:packages)');
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    runCmd(npmBin, ['run', 'build:packages'], { cwd: MONOREPO_ROOT });

    // 2 & 3. Pack all 5 tarballs into tmpRoot/tarballs & inspect contents
    logStep('2/5 • Packing .tgz tarballs & auditing exports / assets / secrets');
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

    // Verify zero .tgz files leaked into monorepo root or packages/*
    const rootTgzLeaks = fs
      .readdirSync(MONOREPO_ROOT)
      .filter((f) => f.endsWith('.tgz'));
    assert(
      rootTgzLeaks.length === 0,
      `Tarball leaked into monorepo root: ${rootTgzLeaks.join(', ')}`
    );

    // 4. Consumer Mode A — Standalone `create-make-pictures` outside monorepo
    logStep('3/5 • Consumer Mode A: Standalone create-make-pictures app');
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

    assertGitignoreAllowsProductions(path.join(standaloneDir, '.gitignore'));
    assertAgentAndClaudeSkillsDiscovery(MONOREPO_ROOT, 'Engine monorepo root');
    assertAgentAndClaudeSkillsDiscovery(standaloneDir, 'Standalone app');
    assert(
      fs.existsSync(path.join(standaloneDir, 'styles', 'README.md')),
      'Standalone app missing styles/README.md'
    );
    assert(
      fs.existsSync(
        path.join(
          standaloneDir,
          'productions',
          'hello-studio',
          'assets',
          'videos'
        )
      ),
      'Standalone hello-studio capsule missing assets/videos/'
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

    // 4a. Typecheck initial standalone app (default vector-scene-2d + StyleProvider) against published .d.ts
    runCmd(tscBin, ['--noEmit'], {
      cwd: standaloneDir,
      label: '(standalone-app) ./node_modules/.bin/tsc --noEmit [initial]',
    });

    // 4a-bis. Create custom style & inspect styles --json via unpacked CLI binary
    runCmd(
      process.execPath,
      [
        mpBin,
        'style',
        'new',
        'bespoke-editorial',
        '--from=editorial-press',
      ],
      {
        cwd: standaloneDir,
        label:
          '(standalone-app) node ./node_modules/.bin/make-pictures style new bespoke-editorial --from=editorial-press',
      }
    );
    assert(
      fs.existsSync(
        path.join(standaloneDir, 'styles', 'bespoke-editorial.style.json')
      ),
      'Expected styles/bespoke-editorial.style.json to be created in standalone-app'
    );

    const standaloneStylesJsonRaw = runCmd(
      process.execPath,
      [mpBin, 'styles', '--json'],
      {
        cwd: standaloneDir,
        label:
          '(standalone-app) node ./node_modules/.bin/make-pictures styles --json',
      }
    );
    const standaloneStylesJson = JSON.parse(standaloneStylesJsonRaw) as {
      builtInStyles?: unknown[];
      customStyles?: Array<{ id?: string }>;
      visualKits?: unknown[];
    };
    assert(
      Array.isArray(standaloneStylesJson.builtInStyles) &&
        standaloneStylesJson.builtInStyles.length === 7,
      `Expected 7 builtInStyles in standalone styles --json, got ${standaloneStylesJson.builtInStyles?.length}`
    );
    assert(
      Array.isArray(standaloneStylesJson.customStyles) &&
        standaloneStylesJson.customStyles.some(
          (s) => s.id === 'bespoke-editorial'
        ),
      'Expected customStyles in standalone styles --json to contain "bespoke-editorial"'
    );
    assert(
      Array.isArray(standaloneStylesJson.visualKits) &&
        standaloneStylesJson.visualKits.length === 7,
      `Expected 7 visualKits in standalone styles --json, got ${standaloneStylesJson.visualKits?.length}`
    );

    // 4a-ter. Scaffold an editorial-collage film bound to bespoke-editorial to verify narrative kit .d.ts
    runCmd(
      process.execPath,
      [
        mpBin,
        'new',
        'editorial-smoke',
        '--kit=editorial-collage',
        '--style=bespoke-editorial',
        '--lang=pl',
      ],
      {
        cwd: standaloneDir,
        label:
          '(standalone-app) node ./node_modules/.bin/make-pictures new editorial-smoke --kit=editorial-collage --style=bespoke-editorial --lang=pl',
      }
    );

    // 4b. Create new film via unpacked CLI binary
    runCmd(
      process.execPath,
      [mpBin, 'new', 'test-film', '--kit=motion-diagrams-2d', '--lang=pl'],
      {
        cwd: standaloneDir,
        label:
          '(standalone-app) node ./node_modules/.bin/make-pictures new test-film --kit=motion-diagrams-2d --lang=pl',
      }
    );

    const testFilmVideosDir = path.join(
      standaloneDir,
      'productions',
      'test-film',
      'assets',
      'videos'
    );
    assert(
      fs.existsSync(testFilmVideosDir),
      'Newly scaffolded test-film capsule missing assets/videos/'
    );

    // 4c. Generate mock audio for test-film
    runCmd(
      process.execPath,
      [mpBin, 'audio', '--production=test-film', '--mock'],
      {
        cwd: standaloneDir,
        label:
          '(standalone-app) node ./node_modules/.bin/make-pictures audio --production=test-film --mock',
      }
    );

    // 4c-bis. Generate a deterministic 2s testsrc2 .mp4 and mount BrowserFrame + ScreenSpotlightOverlay
    const demoMp4Path = path.join(testFilmVideosDir, 'demo.mp4');
    runCmd(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=640x400:rate=30',
        '-t',
        '2',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        demoMp4Path,
      ],
      {
        cwd: standaloneDir,
        label:
          '(standalone-app) ffmpeg testsrc2 -> productions/test-film/assets/videos/demo.mp4 (2s)',
      }
    );

    const testFilmTsxPath = path.join(
      standaloneDir,
      'productions',
      'test-film',
      'compositions',
      'TestFilm.tsx'
    );
    fs.writeFileSync(
      testFilmTsxPath,
      `import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { z } from 'zod';
import { STUDIO_FONTS, STUDIO_THEME, SmartMusicBed, SoundCue } from '@make-pictures/core';
import { StyleProvider, type StylePreset } from '@make-pictures/core/style';
import { type ChapterTitleCardProps } from '@make-pictures/kits/editorial-collage';
import { type StoryCard2DProps } from '@make-pictures/kits/vector-scene-2d';
import {
  BrowserFrame,
  ScreenSpotlightOverlay,
  type PhoneFrameProps,
} from '@make-pictures/kits/product-frames';
import {
  MUSIC_MANIFEST,
  SFX_MANIFEST,
  VOICEOVER_MANIFEST,
} from '../generated/audio-manifest';

export const TestFilmSchema = z.object({
  headline: z.string().describe('Texts & Labels :: Headline'),
  subheadline: z.string().describe('Texts & Labels :: Subheadline'),
  badgeLabel: z.string().describe('Texts & Labels :: Kit Badge'),
  accentColor: z.string().describe('Colors & Style :: Primary Accent'),
  secondaryColor: z.string().describe('Colors & Style :: Secondary Accent'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Voiceover Volume'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Music Base Volume'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: SFX Volume'),
});

export type TestFilmProps = z.infer<typeof TestFilmSchema>;
export type _PhoneCheck = PhoneFrameProps;
export type _StyleCheck = [StylePreset, ChapterTitleCardProps, StoryCard2DProps];
export const _StyleProviderRef = StyleProvider;

const DIALOGUE_SEGMENTS = [
  { sceneId: 'test-film-intro', fromFrame: 12, durationInFrames: 300 },
  { sceneId: 'test-film-payoff', fromFrame: 324, durationInFrames: 306 },
];

export const TestFilm: React.FC<TestFilmProps> = (props) => {
  const introVo = VOICEOVER_MANIFEST['test-film-intro'];
  const payoffVo = VOICEOVER_MANIFEST['test-film-payoff'];
  const whooshSfx = SFX_MANIFEST['whoosh-open'];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: STUDIO_THEME.bgCanvas,
        fontFamily: STUDIO_FONTS.sans,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {MUSIC_MANIFEST?.audioFile ? (
        <SmartMusicBed
          src={staticFile(MUSIC_MANIFEST.audioFile)}
          dialogueSegments={DIALOGUE_SEGMENTS}
          voiceoverManifest={VOICEOVER_MANIFEST}
          baseVolume={props.musicVolume}
          duckedVolume={Math.min(props.musicVolume * 0.34, 0.09)}
        />
      ) : null}

      {introVo?.audioFile ? (
        <Sequence from={12} durationInFrames={300} layout="none">
          <Audio src={staticFile(introVo.audioFile)} volume={props.voiceoverVolume} />
        </Sequence>
      ) : null}

      {payoffVo?.audioFile ? (
        <Sequence from={324} durationInFrames={306} layout="none">
          <Audio src={staticFile(payoffVo.audioFile)} volume={props.voiceoverVolume} />
        </Sequence>
      ) : null}

      {whooshSfx?.audioFile ? (
        <SoundCue src={staticFile(whooshSfx.audioFile)} atFrame={8} volume={props.sfxVolume} />
      ) : null}

      <BrowserFrame
        url="app.example.com"
        title={props.headline}
        accentColor={props.accentColor}
        videoSrc={staticFile('_productions/test-film/videos/demo.mp4')}
      >
        <ScreenSpotlightOverlay
          x={50}
          y={50}
          width={40}
          height={30}
          startFrame={20}
          label="Live MP4"
        />
      </BrowserFrame>
    </AbsoluteFill>
  );
};
`,
      'utf8'
    );

    // Re-run tsc --noEmit to verify newly scaffolded test-film + product-frames + generated audio-manifest.ts typecheck cleanly
    runCmd(tscBin, ['--noEmit'], {
      cwd: standaloneDir,
      label: '(standalone-app) ./node_modules/.bin/tsc --noEmit [with test-film + product-frames]',
    });

    // 4d. Run Contact-Sheet QA in standalone consumer repo (proves Remotion bundles dist ESM/CJS cleanly)
    runCmd(process.execPath, [mpBin, 'qa', 'TestFilm'], {
      cwd: standaloneDir,
      label: '(standalone-app) node ./node_modules/.bin/make-pictures qa TestFilm',
    });

    const qaTestFilmPng = path.join(standaloneDir, 'out', 'qa-TestFilm.png');
    assert(
      fs.existsSync(qaTestFilmPng),
      `Expected QA contact sheet at ${qaTestFilmPng}`
    );
    const qaSize = fs.statSync(qaTestFilmPng).size;
    assert(
      qaSize > 10_000,
      `Expected non-trivial PNG at ${qaTestFilmPng}, got ${qaSize} bytes`
    );
    console.log(
      `  ✓ Rendered standalone QA contact sheet: out/qa-TestFilm.png (${Math.round(
        qaSize / 1024
      )} KB)`
    );

    if (keepQaCopyPath) {
      fs.mkdirSync(path.dirname(keepQaCopyPath), { recursive: true });
      fs.copyFileSync(qaTestFilmPng, keepQaCopyPath);
    }

    // 4e. Spawn Studio Web server in standalone consumer repo & verify HTTP 200 JSON + HTML
    await verifyStandaloneStudioServer(standaloneDir);

    // 5. Consumer Mode B — Existing SaaS repo (`make-pictures init --dir=videos`)
    logStep('4/5 • Consumer Mode B: Existing SaaS repo (make-pictures init --dir=videos)');
    const existingSaasDir = path.join(tmpRoot, 'existing-saas');
    fs.mkdirSync(existingSaasDir, { recursive: true });
    fs.writeFileSync(
      path.join(existingSaasDir, 'package.json'),
      JSON.stringify(
        { name: 'acme-saas-dashboard', version: '1.0.0', private: true },
        null,
        2
      ) + '\n',
      'utf8'
    );

    populateHermeticConsumerNodeModules({
      consumerDir: existingSaasDir,
      tmpRoot,
      tarballsByPkgName,
    });

    const saasMpBin = path.join(
      existingSaasDir,
      'node_modules',
      '.bin',
      'make-pictures'
    );
    runCmd(process.execPath, [saasMpBin, 'init', '--dir=videos'], {
      cwd: existingSaasDir,
      label:
        '(existing-saas) node ./node_modules/.bin/make-pictures init --dir=videos',
    });

    const saasProdJson = path.join(
      existingSaasDir,
      'videos',
      'productions',
      'hello-studio',
      'production.json'
    );
    assert(
      fs.existsSync(saasProdJson),
      `Expected ${saasProdJson} after make-pictures init --dir=videos`
    );
    assert(
      fs.existsSync(
        path.join(
          existingSaasDir,
          'videos',
          'productions',
          'hello-studio',
          'assets',
          'videos'
        )
      ),
      'SaaS hello-studio capsule missing videos/productions/hello-studio/assets/videos/'
    );
    assert(
      fs.existsSync(path.join(existingSaasDir, 'videos', 'styles', 'README.md')),
      'SaaS workspace missing videos/styles/README.md after make-pictures init --dir=videos'
    );
    runCmd(
      process.execPath,
      [
        saasMpBin,
        'style',
        'new',
        'saas-brand',
        '--from=cyber-telemetry',
        '--dir=videos',
      ],
      {
        cwd: existingSaasDir,
        label:
          '(existing-saas) node ./node_modules/.bin/make-pictures style new saas-brand --from=cyber-telemetry --dir=videos',
      }
    );
    assert(
      fs.existsSync(
        path.join(
          existingSaasDir,
          'videos',
          'styles',
          'saas-brand.style.json'
        )
      ),
      'Expected videos/styles/saas-brand.style.json in existing-saas'
    );
    const saasStylesJsonRaw = runCmd(
      process.execPath,
      [saasMpBin, 'styles', '--json', '--dir=videos'],
      {
        cwd: existingSaasDir,
        label:
          '(existing-saas) node ./node_modules/.bin/make-pictures styles --json --dir=videos',
      }
    );
    const saasStylesJson = JSON.parse(saasStylesJsonRaw) as {
      builtInStyles?: unknown[];
      customStyles?: Array<{ id?: string }>;
      visualKits?: unknown[];
    };
    assert(
      Array.isArray(saasStylesJson.builtInStyles) &&
        saasStylesJson.builtInStyles.length === 7 &&
        Array.isArray(saasStylesJson.customStyles) &&
        saasStylesJson.customStyles.some((s) => s.id === 'saas-brand') &&
        Array.isArray(saasStylesJson.visualKits) &&
        saasStylesJson.visualKits.length === 7,
      'Unexpected payload from make-pictures styles --json --dir=videos'
    );
    assertAgentAndClaudeSkillsDiscovery(existingSaasDir, 'Existing SaaS app');
    console.log(
      `  ✓ Verified videos/productions/hello-studio/production.json + videos/styles/saas-brand.style.json + AGENTS.md/.agents + CLAUDE.md/.claude/skills (all ${EXPECTED_SKILLS.length} skills)`
    );

    logStep('5/5 • Cleanup & Final Summary');
    console.log(
      '✅ ALL 5 NPM PACKAGES PACKED & VERIFIED END-TO-END IN HERMETIC CONSUMER REPOS!'
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
