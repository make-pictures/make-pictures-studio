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

test('Part I universal guidelines are documented across canonical AGENTS.md, CLAUDE.md, and all 8 updated skills (with upstream API -> "a pe i" anti-pattern removed)', () => {
  const agentsMd = fs.readFileSync(
    path.join(CANONICAL_RULES_DIR, 'AGENTS.md'),
    'utf8'
  );
  const claudeMd = fs.readFileSync(
    path.join(CANONICAL_RULES_DIR, 'CLAUDE.md'),
    'utf8'
  );

  // AGENTS.md & CLAUDE.md core Part I invariants
  for (const [label, doc] of [
    ['AGENTS.md', agentsMd],
    ['CLAUDE.md', claudeMd],
  ] as const) {
    assert.match(doc, /computeSceneTimingFromVoiceover/, `${label} must document computeSceneTimingFromVoiceover`);
    assert.match(doc, /SceneSubViewDissolve/, `${label} must document SceneSubViewDissolve`);
    assert.match(doc, /PinnedMediaStage/, `${label} must document PinnedMediaStage`);
    assert.match(doc, /cutout/, `${label} must document npx make-pictures cutout`);
    assert.match(doc, /--grid=auto|auto-grid/i, `${label} must document --grid=auto QA coverage`);
    assert.match(doc, /border-box/, `${label} must document boxSizing: 'border-box'`);
  }

  // sound-and-music-design/SKILL.md: mandatory fix of upstream anti-pattern `a pe i instead of API`
  const soundSkill = fs.readFileSync(
    path.join(CANONICAL_SKILLS_DIR, 'sound-and-music-design', 'SKILL.md'),
    'utf8'
  );
  assert.doesNotMatch(
    soundSkill,
    /a pe i instead of API/i,
    'sound-and-music-design/SKILL.md must NOT contain the upstream anti-pattern "a pe i instead of API"'
  );
  assert.match(soundSkill, /"api"/, 'sound-and-music-design must document "api" as a głoskowiec');
  assert.match(soundSkill, /u-es-be/, 'sound-and-music-design must document hyphenated literowce (u-es-be)');
  assert.match(soundSkill, /es-ku-el/, 'sound-and-music-design must document hyphenated es-ku-el');
  assert.match(soundSkill, /e-er-pe/, 'sound-and-music-design must document hyphenated e-er-pe');
  assert.match(soundSkill, /mejk pikczers/);
  assert.match(soundSkill, /retro pi si/);

  // Domain skill coverage checks across the remaining 7 canonical skills
  const skillExpectations: Array<[string, RegExp]> = [
    ['make-pictures-director', /computeSceneTimingFromVoiceover[\s\S]*cutout|--grid=auto/],
    ['style-and-art-direction', /TYPOGRAPHY_FLOOR_1080P|18/],
    ['cinematography-and-vfx', /SceneSubViewDissolve/],
    ['kit-editorial-and-vector', /EditorialPanoramaTrack[\s\S]*PinnedMediaStage|PinnedMediaStage[\s\S]*EditorialPanoramaTrack/],
    ['kit-motion-diagrams-2d', /buildCubicBezierPath|evaluateCubicBezier/],
    ['kit-kinetic-and-data', /tabular-nums/],
    ['kit-paper-diorama-3d', /cutout/],
  ];

  for (const [skillName, pattern] of skillExpectations) {
    const content = fs.readFileSync(
      path.join(CANONICAL_SKILLS_DIR, skillName, 'SKILL.md'),
      'utf8'
    );
    assert.match(
      content,
      pattern,
      `Expected ${skillName}/SKILL.md to document ${String(pattern)}`
    );
  }
});
