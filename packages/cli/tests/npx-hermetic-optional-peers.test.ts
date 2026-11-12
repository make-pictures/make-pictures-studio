import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function copyBuiltPackageIntoNodeModules(
  pkgDirName: string,
  scopedTargetRel: string,
  destNodeModules: string
): void {
  const srcPkgDir = path.join(MONOREPO_ROOT, 'packages', pkgDirName);
  const destPkgDir = path.join(destNodeModules, scopedTargetRel);
  fs.mkdirSync(destPkgDir, { recursive: true });
  fs.copyFileSync(
    path.join(srcPkgDir, 'package.json'),
    path.join(destPkgDir, 'package.json')
  );
  fs.cpSync(path.join(srcPkgDir, 'dist'), path.join(destPkgDir, 'dist'), {
    recursive: true,
  });
  const assetsDir = path.join(srcPkgDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    fs.cpSync(assetsDir, path.join(destPkgDir, 'assets'), { recursive: true });
  }
}

function symlinkThirdPartyPkg(name: string, destNodeModules: string): void {
  const src = path.join(MONOREPO_ROOT, 'node_modules', name);
  const dest = path.join(destNodeModules, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.symlinkSync(src, dest, process.platform === 'win32' ? 'junction' : 'dir');
}

test('built @make-pictures/cli runs `onboard --lang=pl --json` in a minimal npx cache without @react-three/fiber, three, react, or remotion', () => {
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mp-npx-minimal-cache-')
  );
  try {
    const npxCacheDir = path.join(tmpRoot, 'npx-cache');
    const npxNodeModules = path.join(npxCacheDir, 'node_modules');
    const emptyUserDir = path.join(tmpRoot, 'make-pictures-videos');
    fs.mkdirSync(npxNodeModules, { recursive: true });
    fs.mkdirSync(emptyUserDir, { recursive: true });

    copyBuiltPackageIntoNodeModules('core', '@make-pictures/core', npxNodeModules);
    copyBuiltPackageIntoNodeModules(
      'studio',
      '@make-pictures/studio',
      npxNodeModules
    );
    copyBuiltPackageIntoNodeModules('cli', '@make-pictures/cli', npxNodeModules);

    // Only direct runtime dependencies (no @react-three/fiber, no three, no react, no remotion)
    for (const dep of ['dotenv', '@elevenlabs/elevenlabs-js', 'zod']) {
      symlinkThirdPartyPkg(dep, npxNodeModules);
    }

    const binMjs = path.join(
      npxNodeModules,
      '@make-pictures',
      'cli',
      'dist',
      'bin.mjs'
    );
    const res = spawnSync(
      process.execPath,
      [binMjs, 'onboard', '--lang=pl', '--json'],
      {
        cwd: emptyUserDir,
        encoding: 'utf8',
      }
    );

    assert.equal(
      res.status,
      0,
      `Expected bin.mjs onboard to exit 0 without 3D/React peers, got ${res.status}:\nSTDERR:\n${res.stderr}\nSTDOUT:\n${res.stdout}`
    );

    const payload = JSON.parse(res.stdout.trim()) as {
      next?: string;
      say?: string;
    };
    assert.ok(payload.next, 'Expected onboard JSON `next` field');
    assert.ok(payload.say, 'Expected onboard JSON `say` field');

    const stylesRes = spawnSync(
      process.execPath,
      [binMjs, 'styles', '--json'],
      {
        cwd: emptyUserDir,
        encoding: 'utf8',
      }
    );
    assert.equal(
      stylesRes.status,
      0,
      `Expected bin.mjs styles --json to exit 0 without 3D/React peers:\n${stylesRes.stderr}`
    );
    const stylesPayload = JSON.parse(stylesRes.stdout.trim()) as {
      builtInStyles?: unknown[];
    };
    assert.equal(stylesPayload.builtInStyles?.length, 7);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('built @make-pictures/core and @make-pictures/core/camera load in ESM without optional @react-three/fiber or three installed', () => {
  const tmpRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'mp-core-2d-only-')
  );
  try {
    const consumerNodeModules = path.join(tmpRoot, 'node_modules');
    fs.mkdirSync(consumerNodeModules, { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'package.json'),
      JSON.stringify({ name: 'consumer-2d-only', private: true, type: 'module' }),
      'utf8'
    );

    copyBuiltPackageIntoNodeModules(
      'core',
      '@make-pictures/core',
      consumerNodeModules
    );

    // Install ONLY 2D required peers — strictly NO three, @react-three/fiber, @react-three/drei, @remotion/three
    for (const peer of [
      'react',
      'react-dom',
      'scheduler',
      'remotion',
      '@remotion/media-utils',
      '@remotion/google-fonts',
      'zod',
    ]) {
      symlinkThirdPartyPkg(peer, consumerNodeModules);
    }

    const probeOut = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import * as core from '@make-pictures/core';
          import * as cam from '@make-pictures/core/camera';
          if (typeof core.StyleProvider !== 'function') throw new Error('Missing StyleProvider');
          if (typeof core.DirectorCamera2D !== 'function') throw new Error('Missing DirectorCamera2D');
          if (typeof cam.DirectorCamera3D !== 'function') throw new Error('Missing DirectorCamera3D');
          if (typeof cam.evaluateDirectorCamera3D !== 'function') throw new Error('Missing evaluateDirectorCamera3D');
          console.log('OK_2D_CORE');
        `,
      ],
      { cwd: tmpRoot, encoding: 'utf8' }
    );

    assert.match(probeOut, /OK_2D_CORE/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
