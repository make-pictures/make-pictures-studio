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

test('createMakePicturesApp scaffolds directly into current directory containing IDE metadata and preserves existing .gitignore lines', async () => {
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
    assert.equal(fs.existsSync(path.join(targetDir, 'package.json')), true);
    assert.equal(
      fs.existsSync(
        path.join(targetDir, 'productions', 'hello-studio', 'production.json')
      ),
      true
    );
    const gitignore = fs.readFileSync(path.join(targetDir, '.gitignore'), 'utf8');
    assert.match(gitignore, /custom-secret\.txt/);
    assert.match(gitignore, /\.env\.local/);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});
