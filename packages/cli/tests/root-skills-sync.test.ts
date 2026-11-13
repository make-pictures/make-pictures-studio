import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CANONICAL_SKILLS_DIR = path.join(
  REPO_ROOT,
  'plugins/make-pictures/skills'
);
const ROOT_SKILLS_DIR = path.join(REPO_ROOT, 'skills');

test('root skills/ mirrors plugins/make-pictures/skills/ as real files for skills.sh', () => {
  assert.ok(
    fs.existsSync(ROOT_SKILLS_DIR),
    'Expected root skills/ directory to exist for npx skills discovery'
  );
  const rootStat = fs.lstatSync(ROOT_SKILLS_DIR);
  assert.equal(
    rootStat.isSymbolicLink(),
    false,
    'Root skills/ must be a real directory (not a symlink) so GitHub tarballs unpack on all OSes'
  );

  const canonicalDirs = fs
    .readdirSync(CANONICAL_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  assert.equal(canonicalDirs.length, 9, 'Expected all 9 canonical skills');

  const rootDirs = fs
    .readdirSync(ROOT_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  assert.deepEqual(rootDirs, canonicalDirs);

  for (const skillName of canonicalDirs) {
    const srcSkillMd = path.join(CANONICAL_SKILLS_DIR, skillName, 'SKILL.md');
    const dstDir = path.join(ROOT_SKILLS_DIR, skillName);
    const dstSkillMd = path.join(dstDir, 'SKILL.md');

    assert.equal(
      fs.lstatSync(dstDir).isSymbolicLink(),
      false,
      `skills/${skillName} must not be a symlink`
    );
    assert.ok(fs.existsSync(dstSkillMd), `Missing skills/${skillName}/SKILL.md`);

    const srcContent = fs.readFileSync(srcSkillMd, 'utf8');
    const dstContent = fs.readFileSync(dstSkillMd, 'utf8');
    assert.equal(
      dstContent,
      srcContent,
      `skills/${skillName}/SKILL.md is out of sync with plugins/make-pictures/skills/${skillName}/SKILL.md`
    );
    assert.match(dstContent, /^---\n[\s\S]*?name:\s*\S+[\s\S]*?description:\s*\S+[\s\S]*?\n---/);
  }
});
