import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const EXPECTED_SKILLS = [
  'art-direction-and-styles',
  'kits-2d',
  'kits-3d-and-kinematics',
  'make-pictures-director',
  'sound-and-music-design',
];

const FORBIDDEN_LEGACY_PATTERN =
  /@make-pictures\/studio|@make-pictures\/core|@make-pictures\/kits|\.props\.json|registry\.ts|Studio Web/i;

test('skills/ contains exactly the 5 canonical v3 skills with zero legacy references', () => {
  const dirs = fs
    .readdirSync(path.join(ROOT_DIR, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  assert.deepEqual(dirs, EXPECTED_SKILLS);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'plugins', 'make-pictures')), false);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, '.agents', 'plugins', 'make-pictures')), false);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'scripts', 'sync-root-skills.ts')), false);

  for (const skill of EXPECTED_SKILLS) {
    const skillDir = path.join(ROOT_DIR, 'skills', skill);
    assert.equal(fs.lstatSync(skillDir).isSymbolicLink(), false, `skills/${skill} must be a real directory`);
    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    assert.match(content, /^---\nname:\s+/m, `skills/${skill}/SKILL.md must have YAML frontmatter with name`);
    assert.match(
      content,
      /^---\n[\s\S]*?name:\s*\S+[\s\S]*?description:\s*\S+[\s\S]*?\n---/,
      `skills/${skill}/SKILL.md must have valid YAML frontmatter (name + description)`
    );
    assert.doesNotMatch(
      content,
      FORBIDDEN_LEGACY_PATTERN,
      `skills/${skill}/SKILL.md contains forbidden v2 reference`
    );
    assert.match(
      content,
      /remotion-dev\/skills/i,
      `skills/${skill}/SKILL.md must explicitly defer base Remotion API rules to remotion-dev/skills`
    );
  }
});

test('AGENTS.md and CLAUDE.md are lean and free of v2 Studio Web rules', () => {
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
    assert.ok(content.length < 8500, `${file} should be concise (< 8500 chars), got ${content.length}`);
    assert.doesNotMatch(
      content,
      FORBIDDEN_LEGACY_PATTERN,
      `${file} contains forbidden v2 reference`
    );
    assert.match(content, /remotion-dev\/skills/i, `${file} must mention remotion-dev/skills`);
    assert.match(content, /remotion studio/i, `${file} must mention remotion studio`);
  }
});

test('v3 skills preserve high-signal domain rules and stay domain-agnostic', () => {
  const soundSkill = fs.readFileSync(
    path.join(ROOT_DIR, 'skills', 'sound-and-music-design', 'SKILL.md'),
    'utf8'
  );
  assert.doesNotMatch(soundSkill, /a pe i instead of API/i);
  for (const token of ['eleven_v4', 'eleven_v3', 'dialogueInputs', '"api"', 'u-es-be', '-14 LUFS', 'SmartMusicBed', 'SoundCue']) {
    assert.ok(soundSkill.includes(token), `sound-and-music-design must document ${token}`);
  }

  const directorSkill = fs.readFileSync(
    path.join(ROOT_DIR, 'skills', 'make-pictures-director', 'SKILL.md'),
    'utf8'
  );
  for (const token of ['audio.json', 'make-pictures.json', 'src/Root.tsx', 'computeSceneTimingFromVoiceover', 'ContinuousSceneFlow', 'elements build']) {
    assert.ok(directorSkill.includes(token), `make-pictures-director must document ${token}`);
  }

  const artSkill = fs.readFileSync(
    path.join(ROOT_DIR, 'skills', 'art-direction-and-styles', 'SKILL.md'),
    'utf8'
  );
  for (const token of ['TYPOGRAPHY_FLOOR_1080P', 'StyleLabComposition', 'cutout', 'clean-scan', 'soft-clay', 'retro-pc']) {
    assert.ok(artSkill.includes(token), `art-direction-and-styles must document ${token}`);
  }

  const kits2dSkill = fs.readFileSync(path.join(ROOT_DIR, 'skills', 'kits-2d', 'SKILL.md'), 'utf8');
  for (const token of [
    '@make-pictures/remotion/kits/editorial-collage',
    '@make-pictures/remotion/kits/vector-scene-2d',
    '@make-pictures/remotion/kits/motion-diagrams-2d',
    '@make-pictures/remotion/kits/kinetic-typography',
    '@make-pictures/remotion/kits/data-storytelling',
    '@make-pictures/remotion/kits/product-frames',
    'EditorialPanoramaTrack',
    'PinnedMediaStage',
    'buildCubicBezierPath',
  ]) {
    assert.ok(kits2dSkill.includes(token), `kits-2d must document ${token}`);
  }

  const kits3dSkill = fs.readFileSync(
    path.join(ROOT_DIR, 'skills', 'kits-3d-and-kinematics', 'SKILL.md'),
    'utf8'
  );
  for (const token of [
    '@make-pictures/remotion/kits/paper-diorama-3d',
    '@make-pictures/remotion/kits/isometric-3d',
    '@make-pictures/remotion/kits/tactile-3d',
    '@make-pictures/remotion/kinematics',
    '@make-pictures/remotion/camera',
    'auditSceneCollisions3D',
    'obbClearanceSat3D',
    'disneyEase',
    'SyncStudioIbl3D',
    'DeformableSheet3D',
  ]) {
    assert.ok(kits3dSkill.includes(token), `kits-3d-and-kinematics must document ${token}`);
  }
});
