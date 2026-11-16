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
const CANONICAL_RULES_DIR = path.join(
  REPO_ROOT,
  'plugins/make-pictures/rules'
);
const ROOT_SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const AGENTS_PLUGIN_DIR = path.join(
  REPO_ROOT,
  '.agents/plugins/make-pictures'
);

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

    const agentsSkillDir = path.join(AGENTS_PLUGIN_DIR, 'skills', skillName);
    const agentsSkillMd = path.join(agentsSkillDir, 'SKILL.md');
    assert.equal(
      fs.lstatSync(agentsSkillDir).isSymbolicLink(),
      false,
      `.agents/plugins/make-pictures/skills/${skillName} must not be a symlink`
    );
    assert.equal(
      fs.readFileSync(agentsSkillMd, 'utf8'),
      srcContent,
      `.agents/plugins/make-pictures/skills/${skillName}/SKILL.md is out of sync`
    );
  }
});

test('root AGENTS.md and CLAUDE.md mirror plugins/make-pictures/rules/{AGENTS,CLAUDE}.md as real files', () => {
  assert.equal(
    fs.lstatSync(AGENTS_PLUGIN_DIR).isSymbolicLink(),
    false,
    '.agents/plugins/make-pictures must be a real directory, not a symlink'
  );

  for (const ruleFile of ['AGENTS.md', 'CLAUDE.md'] as const) {
    const canonicalPath = path.join(CANONICAL_RULES_DIR, ruleFile);
    const rootPath = path.join(REPO_ROOT, ruleFile);
    const agentsMirrorPath = path.join(AGENTS_PLUGIN_DIR, 'rules', ruleFile);

    assert.ok(fs.existsSync(canonicalPath), `Missing canonical rules/${ruleFile}`);
    assert.ok(fs.existsSync(rootPath), `Missing root ${ruleFile}`);
    assert.ok(fs.existsSync(agentsMirrorPath), `Missing .agents mirror rules/${ruleFile}`);

    assert.equal(fs.lstatSync(rootPath).isSymbolicLink(), false);
    assert.equal(fs.lstatSync(agentsMirrorPath).isSymbolicLink(), false);

    const canonicalContent = fs.readFileSync(canonicalPath, 'utf8');
    assert.equal(
      fs.readFileSync(rootPath, 'utf8'),
      canonicalContent,
      `Root ${ruleFile} is out of sync with plugins/make-pictures/rules/${ruleFile}`
    );
    assert.equal(
      fs.readFileSync(agentsMirrorPath, 'utf8'),
      canonicalContent,
      `.agents/plugins/make-pictures/rules/${ruleFile} is out of sync`
    );
    assert.match(canonicalContent, /soft-clay/);
    assert.match(canonicalContent, /retro-pc/);
    assert.match(canonicalContent, /glass-studio/);
  }
});
