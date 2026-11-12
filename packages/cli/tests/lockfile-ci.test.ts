import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

test('package-lock.json stays synchronized with all workspace package.json manifests and passes npm ci --dry-run', () => {
  const lockPath = path.join(MONOREPO_ROOT, 'package-lock.json');
  assert.ok(fs.existsSync(lockPath), 'Missing root package-lock.json');

  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as {
    packages?: Record<string, { name?: string; version?: string }>;
  };
  const lockPackages = lock.packages ?? {};

  const packagesDir = path.join(MONOREPO_ROOT, 'packages');
  const workspaceDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  for (const dirName of workspaceDirs) {
    const wsPkgPath = path.join(packagesDir, dirName, 'package.json');
    if (!fs.existsSync(wsPkgPath)) continue;
    const wsPkg = JSON.parse(fs.readFileSync(wsPkgPath, 'utf8')) as {
      name: string;
      version: string;
    };
    const lockEntryKey = `packages/${dirName}`;
    const lockEntry = lockPackages[lockEntryKey];

    assert.ok(
      lockEntry,
      `Workspace "${lockEntryKey}" (${wsPkg.name}) is missing from package-lock.json — run \`npm install --package-lock-only\` after editing workspace manifests`
    );
    assert.equal(
      lockEntry.version,
      wsPkg.version,
      `Version mismatch for ${lockEntryKey}: package.json has ${wsPkg.version}, package-lock.json has ${lockEntry.version}`
    );
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const dryRun = spawnSync(npmCmd, ['ci', '--dry-run', '--ignore-scripts'], {
    cwd: MONOREPO_ROOT,
    encoding: 'utf8',
  });

  assert.equal(
    dryRun.status,
    0,
    `\`npm ci --dry-run\` failed (exit ${dryRun.status}):\n${dryRun.stderr || dryRun.stdout}`
  );
});
