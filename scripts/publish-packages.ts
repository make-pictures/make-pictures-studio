import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

interface PackageReleaseTarget {
  dir: string;
  expectedName: string;
}

const RELEASE_PACKAGES_TOPOLOGICAL: PackageReleaseTarget[] = [
  { dir: 'packages/core', expectedName: '@make-pictures/core' },
  { dir: 'packages/kits', expectedName: '@make-pictures/kits' },
  { dir: 'packages/studio', expectedName: '@make-pictures/studio' },
  { dir: 'packages/cli', expectedName: '@make-pictures/cli' },
  { dir: 'packages/create-make-pictures', expectedName: 'create-make-pictures' },
];

function parseArgs(): { dryRun: boolean; otp?: string; skipBuild: boolean } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let otp: string | undefined;
  let skipBuild = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--otp=')) {
      otp = arg.slice('--otp='.length).trim();
    } else if (arg === '--skip-build') {
      skipBuild = true;
    }
  }

  return { dryRun, otp, skipBuild };
}

function readPackageJson(pkgRelDir: string): { name: string; version: string } {
  const fullPath = path.join(ROOT_DIR, pkgRelDir, 'package.json');
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing package.json at ${fullPath}`);
  }
  const raw = fs.readFileSync(fullPath, 'utf8');
  const parsed = JSON.parse(raw) as { name?: string; version?: string };
  if (!parsed.name || !parsed.version) {
    throw new Error(`package.json in ${pkgRelDir} is missing name or version`);
  }
  return { name: parsed.name, version: parsed.version };
}

function isVersionAlreadyPublished(name: string, version: string): boolean {
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const checkSpec = `${name}@${version}`;
    const result = spawnSync(npmCmd, ['view', checkSpec, 'version', '--json'], {
      encoding: 'utf8',
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.status === 0 && result.stdout) {
      const trimmed = result.stdout.trim().replace(/^"|"$/g, '');
      if (trimmed === version) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { dryRun, otp, skipBuild } = parseArgs();
  const isCi = process.env.GITHUB_ACTIONS === 'true';

  console.log('==============================================================');
  console.log(' 🚀 make.pictures — Topological npm Package Publisher');
  console.log('    https://make.pictures');
  console.log('==============================================================');
  console.log(`  • Mode:        ${dryRun ? 'DRY RUN (no registry mutation)' : 'LIVE PUBLISH'}`);
  console.log(`  • CI:          ${isCi ? 'Yes (GitHub Actions)' : 'No (Local workstation)'}`);
  if (otp) {
    console.log(`  • OTP:         Provided (${otp.length} digits)`);
  }
  console.log('');

  // 1. Build all workspace packages first unless explicitly skipped
  if (!skipBuild) {
    console.log('📦 Step 1/2: Building all 5 packages (npm run build:packages)…');
    execSync('npm run build:packages', {
      stdio: 'inherit',
      cwd: ROOT_DIR,
    });
    console.log('✓ All packages built cleanly.\n');
  } else {
    console.log('⏭️  Step 1/2: Build skipped (--skip-build).\n');
  }

  // 2. Iterate in strict topological order
  console.log('🚀 Step 2/2: Publishing packages in strict topological order…\n');

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  for (let i = 0; i < RELEASE_PACKAGES_TOPOLOGICAL.length; i++) {
    const target = RELEASE_PACKAGES_TOPOLOGICAL[i];
    const pkg = readPackageJson(target.dir);

    if (pkg.name !== target.expectedName) {
      throw new Error(
        `Package mismatch at ${target.dir}: expected ${target.expectedName}, got ${pkg.name}`
      );
    }

    const stepLabel = `[${i + 1}/${RELEASE_PACKAGES_TOPOLOGICAL.length}] ${pkg.name}@${pkg.version}`;
    console.log(`─── ${stepLabel} (${target.dir}) ───`);

    if (!dryRun) {
      const alreadyPublished = isVersionAlreadyPublished(pkg.name, pkg.version);
      if (alreadyPublished) {
        console.log(`  ℹ️  ${pkg.name}@${pkg.version} is already published on npm. Skipping.\n`);
        continue;
      }
    }

    const publishArgs = ['publish', `./${target.dir}`, '--access', 'public'];

    if (dryRun) {
      publishArgs.push('--dry-run');
    }

    if (otp) {
      publishArgs.push(`--otp=${otp}`);
    }

    if (isCi && !dryRun) {
      publishArgs.push('--provenance');
    }

    console.log(`  $ npm ${publishArgs.join(' ')}`);

    const result = spawnSync(npmCmd, publishArgs, {
      stdio: 'inherit',
      cwd: ROOT_DIR,
      env: process.env,
    });

    if (result.status !== 0) {
      console.error(
        `\n❌ Failed to publish ${pkg.name}@${pkg.version} (exit code ${result.status}).`
      );
      process.exit(result.status ?? 1);
    }

    console.log(`  ✓ Successfully ${dryRun ? 'verified (dry-run)' : 'published'} ${pkg.name}@${pkg.version}\n`);
  }

  console.log('==============================================================');
  console.log(
    dryRun
      ? '✨ Dry-run publish completed cleanly for all 5 packages!'
      : '🎉 All 5 make.pictures packages published to npm successfully!'
  );
  console.log('==============================================================');
}

main().catch((err: unknown) => {
  console.error('\n❌ Fatal release error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
