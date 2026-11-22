import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CANONICAL_SKILLS_DIR = path.join(REPO_ROOT, 'plugins/make-pictures/skills');
const CANONICAL_RULES_DIR = path.join(REPO_ROOT, 'plugins/make-pictures/rules');
const ROOT_SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const AGENTS_PLUGIN_DIR = path.join(REPO_ROOT, '.agents/plugins/make-pictures');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

function assertAllTokens(label: string, content: string, tokens: readonly (string | RegExp)[]): void {
  for (const token of tokens) {
    if (typeof token === 'string') {
      assert.ok(
        content.includes(token),
        `Expected ${label} to document "${token}"`
      );
    } else {
      assert.match(
        content,
        token,
        `Expected ${label} to match ${String(token)}`
      );
    }
  }
}

test('exactly 9 canonical skills exist and stay synced with skills/ and .agents mirrors', () => {
  const canonicalDirs = fs
    .readdirSync(CANONICAL_SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  assert.equal(canonicalDirs.length, 9, 'Must preserve exact 9 canonical skills');

  for (const dir of canonicalDirs) {
    const canonical = fs.readFileSync(path.join(CANONICAL_SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
    const rootMirror = fs.readFileSync(path.join(ROOT_SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
    const agentsMirror = fs.readFileSync(path.join(AGENTS_PLUGIN_DIR, 'skills', dir, 'SKILL.md'), 'utf8');
    assert.equal(rootMirror, canonical, `skills/${dir}/SKILL.md out of sync`);
    assert.equal(agentsMirror, canonical, `.agents mirror ${dir}/SKILL.md out of sync`);
  }
});

test('synced AGENTS.md and CLAUDE.md cover Sub-projects 1-3 APIs and workflows concisely', () => {
  const sharedTokens: readonly (string | RegExp)[] = [
    '@make-pictures/core/kinematics',
    'obbClearanceSat3D',
    'auditSceneCollisions3D',
    '@make-pictures/kits/tactile-3d',
    'DeformableSheet3D',
    'ScreenGlassLayer3D',
    'SyncStudioIbl3D',
    'getProceduralPbrMaps',
    'DaylightArcRig3D',
    'PaperRibbonTimeline',
    'FloatingEditorialDisplay',
    'assets clean-scan',
    'assets sheet',
    'eleven_v3',
    '[thoughtful]',
    '[warmly]',
    /fact-check/i,
    /Pilotażowe Demo|Pilot Demo/i,
  ];

  for (const relPath of [
    'plugins/make-pictures/rules/AGENTS.md',
    'AGENTS.md',
    'plugins/make-pictures/rules/CLAUDE.md',
    'CLAUDE.md',
  ]) {
    assertAllTokens(relPath, readFile(relPath), sharedTokens);
  }
});

test('synced 6 updated skills cover every Sub-project 1-3 API and workflow', () => {
  const coverageBySkill: Record<string, readonly (string | RegExp)[]> = {
    'make-pictures-director': [
      /Pilot Demo/i,
      /Fact-Check/i,
      'assets clean-scan',
      'assets sheet',
      'SOURCES.md',
      'auditSceneCollisions3D',
      'computeDeformedSheetAabb3D',
      'eleven_v3',
    ],
    'sound-and-music-design': [
      'eleven_v3',
      '[thoughtful]',
      '[warmly]',
      '[playful]',
      '[amazed]',
      '[whispers]',
      '[sighs]',
      '[v3-audio-tags]',
      '[v3-stability]',
      /0\.0.*0\.5.*1\.0/,
      /micro-segment/i,
      '--audition',
    ],
    'cinematography-and-vfx': [
      '@make-pictures/core/kinematics',
      'disneyEase',
      'evaluateAnticipation',
      'evaluateArc3D',
      'evaluateSurfaceImpact',
      'evaluateVelocityStretch',
      'evaluateSecondaryCascade',
      "'macro'",
      'computeCameraBasis3D',
      'evaluateCameraKeyframes3D',
      'projectScreenGlassPose',
      'computeGlassLightingBlend',
      'ScreenGlassLayer3D',
      'ScreenGlassSlot',
    ],
    'kit-paper-diorama-3d': [
      '@make-pictures/kits/tactile-3d',
      'DeformableSheet3D',
      'customDepthMaterial',
      'SHEET_MATERIAL_FINISHES',
      'parchment-matte',
      'linen-glaze',
      'bleedInsetUv',
      'computeGridAtlasUvRect',
      'usePreloadedTextures3D',
      'obbClearanceSat3D',
      'obbIntersectsSat3D',
      'computeDeformedSheetAabb3D',
      'computeSurfaceClearanceY',
      'auditSceneCollisions3D',
    ],
    'kit-isometric-3d': [
      'SyncStudioIbl3D',
      'PMREMGenerator',
      'frameloop="never"',
      'DEFAULT_STUDIO_IBL_PANELS',
      'getProceduralPbrMaps',
      'linen-weave',
      'wood-grain',
      'cotton-paper',
      'brushed-metal',
      'DaylightArcRig3D',
      'evaluateTimeOfDayLighting',
      'timeOfDay',
    ],
    'kit-editorial-and-vector': [
      'PaperRibbonTimeline',
      'resolveActivePaperMilestoneId',
      'FloatingEditorialDisplay',
      /19–22\s*px|20\s*px/,
      /background:\s*'transparent'/,
    ],
  };

  for (const [skillName, tokens] of Object.entries(coverageBySkill)) {
    const syncedPath = `skills/${skillName}/SKILL.md`;
    assertAllTokens(syncedPath, readFile(syncedPath), tokens);
  }
});

test('all 9 canonical skills and AGENTS.md / CLAUDE.md stay 100% domain-agnostic (zero playing-card specifics)', () => {
  const forbiddenDomainPatterns: readonly RegExp[] = [
    /wynalazek-52-kart/i,
    /visconti-sforza/i,
    /\b52-kart\b/i,
    /playing\s+card/i,
    /talia\s+kart/i,
    /kart(?:a|y|ach|ami|om)?\s+do\s+gry/i,
    /\bmamluk\b/i,
    /\bdondorf\b/i,
    /\brouen\b/i,
    /french[\s-]suit/i,
  ];

  const filesToAudit: string[] = [
    path.join(CANONICAL_RULES_DIR, 'AGENTS.md'),
    path.join(CANONICAL_RULES_DIR, 'CLAUDE.md'),
  ];

  for (const dir of fs.readdirSync(CANONICAL_SKILLS_DIR, { withFileTypes: true })) {
    if (dir.isDirectory()) {
      filesToAudit.push(path.join(CANONICAL_SKILLS_DIR, dir.name, 'SKILL.md'));
    }
  }

  assert.equal(filesToAudit.length, 11, 'Expected 2 rules + 9 canonical skills');

  for (const filePath of filesToAudit) {
    const content = fs.readFileSync(filePath, 'utf8');
    const rel = path.relative(REPO_ROOT, filePath);
    for (const pattern of forbiddenDomainPatterns) {
      assert.doesNotMatch(
        content,
        pattern,
        `Found forbidden playing-card domain reference ${String(pattern)} in ${rel}`
      );
    }
  }
});
