import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createMakePicturesApp,
  isEffectivelyEmptyDir,
} from '../../create-make-pictures/src/index';

test('isEffectivelyEmptyDir ignores benign OS and IDE metadata entries', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-empty-check-'));
  try {
    assert.equal(isEffectivelyEmptyDir(tmpDir), true);
    fs.writeFileSync(path.join(tmpDir, '.DS_Store'), '');
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, '.vscode'));
    fs.mkdirSync(path.join(tmpDir, '.claude'));
    fs.mkdirSync(path.join(tmpDir, '.antigravity'));
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.DS_Store\n');
    assert.equal(isEffectivelyEmptyDir(tmpDir), true);

    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log(1);\n');
    assert.equal(isEffectivelyEmptyDir(tmpDir), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createMakePicturesApp scaffolds a standard Remotion 4 + React 19 project with StyleLab and preserves .gitignore', async () => {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-dot-dir-'));
  const targetDir = path.join(parentDir, 'Moje Filmy 2026');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, '.DS_Store'), '');
  fs.mkdirSync(path.join(targetDir, '.git'));
  fs.writeFileSync(path.join(targetDir, '.gitignore'), 'custom-secret.txt\n');

  const prevCwd = process.cwd();
  try {
    process.chdir(targetDir);
    const result = await createMakePicturesApp({
      targetDir: '.',
      lang: 'pl',
      install: false,
    });

    assert.equal(result.projectName, 'moje-filmy-2026');

    const pkg = JSON.parse(
      fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8')
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    assert.equal(pkg.scripts.studio, 'remotion studio src/index.ts');
    assert.equal(pkg.dependencies['@make-pictures/remotion'], '^3.0.0');
    assert.equal(pkg.dependencies.remotion, '^4.0.545');
    assert.equal(pkg.dependencies.react, '^19.1.0');
    assert.equal(pkg.devDependencies['@make-pictures/cli'], '^3.0.0');
    assert.equal('vite' in pkg.dependencies, false);
    assert.equal('vite' in pkg.devDependencies, false);

    const indexTs = fs.readFileSync(path.join(targetDir, 'src', 'index.ts'), 'utf8');
    assert.match(indexTs, /registerRoot\(RemotionRoot\)/);

    const rootTsx = fs.readFileSync(path.join(targetDir, 'src', 'Root.tsx'), 'utf8');
    assert.match(rootTsx, /@make-pictures\/remotion\/style-lab/);
    assert.match(rootTsx, /id="StyleLab"/);
    assert.match(rootTsx, /StyleLabComposition/);
    assert.match(rootTsx, /StyleLabSchema/);

    assert.ok(fs.existsSync(path.join(targetDir, 'remotion.config.ts')));
    assert.ok(fs.existsSync(path.join(targetDir, 'tsconfig.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'make-pictures.json')));
    assert.ok(fs.existsSync(path.join(targetDir, 'src', 'videos')));
    assert.ok(fs.existsSync(path.join(targetDir, 'styles')));
    assert.ok(fs.existsSync(path.join(targetDir, 'public')));

    const config = JSON.parse(
      fs.readFileSync(path.join(targetDir, 'make-pictures.json'), 'utf8')
    ) as { lang: string; videosDir: string; fps: number };
    assert.equal(config.lang, 'pl');
    assert.equal(config.videosDir, 'src/videos');
    assert.equal(config.fps, 60);

    const gitignore = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
    assert.match(gitignore, /custom-secret\.txt/);
    assert.match(gitignore, /\.env\.local/);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test('create-make-pictures stays ultra-thin (< 350 LOC) with version 3.0.0 and zero bundled assets', () => {
  const pkg = JSON.parse(
    fs.readFileSync(
      path.resolve(import.meta.dirname, '../../create-make-pictures/package.json'),
      'utf8'
    )
  ) as { version: string; files: string[] };
  assert.equal(pkg.version, '3.0.0');
  assert.equal(pkg.files.includes('assets'), false);

  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, '../../create-make-pictures/src/index.ts'),
    'utf8'
  );
  const lineCount = src.split('\n').length;
  assert.ok(
    lineCount <= 350,
    `Expected ultra-thin create-make-pictures/src/index.ts (<= 350 LOC), got ${lineCount}`
  );
});
