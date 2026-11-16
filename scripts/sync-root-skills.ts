import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const CANONICAL_PLUGIN_DIR = path.join(ROOT_DIR, 'plugins/make-pictures');
const CANONICAL_PLUGIN_REAL = fs.realpathSync(CANONICAL_PLUGIN_DIR);
const SRC_SKILLS_DIR = path.join(CANONICAL_PLUGIN_DIR, 'skills');
const SRC_RULES_DIR = path.join(CANONICAL_PLUGIN_DIR, 'rules');

const AGENTS_PLUGIN_DIR = path.join(ROOT_DIR, '.agents/plugins/make-pictures');

function replaceSymlinkWithRealDir(dirPath: string): void {
  try {
    const stat = fs.lstatSync(dirPath);
    if (stat.isSymbolicLink() || stat.isFile()) {
      fs.unlinkSync(dirPath);
    }
  } catch {
    // Path does not exist yet
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

function assertNotInsideCanonicalPlugin(targetPath: string): void {
  const parentDir = fs.existsSync(targetPath)
    ? targetPath
    : path.dirname(targetPath);
  if (!fs.existsSync(parentDir)) return;
  const realParent = fs.realpathSync(parentDir);
  if (
    realParent === CANONICAL_PLUGIN_REAL ||
    realParent.startsWith(`${CANONICAL_PLUGIN_REAL}${path.sep}`)
  ) {
    throw new Error(
      `Refusing to overwrite canonical plugin path via symlink: ${targetPath} -> ${realParent}`
    );
  }
}

// Ensure .agents/plugins/make-pictures is a real directory (not a symlink) for cross-OS Git/tarball safety
replaceSymlinkWithRealDir(AGENTS_PLUGIN_DIR);

// Sync plugin manifests into .agents/plugins/make-pictures/
const srcPluginJson = path.join(CANONICAL_PLUGIN_DIR, 'plugin.json');
if (fs.existsSync(srcPluginJson)) {
  const dstPluginJson = path.join(AGENTS_PLUGIN_DIR, 'plugin.json');
  assertNotInsideCanonicalPlugin(dstPluginJson);
  fs.copyFileSync(srcPluginJson, dstPluginJson);
}

const srcClaudePluginDir = path.join(CANONICAL_PLUGIN_DIR, '.claude-plugin');
if (fs.existsSync(srcClaudePluginDir)) {
  const dstClaudePluginDir = path.join(AGENTS_PLUGIN_DIR, '.claude-plugin');
  replaceSymlinkWithRealDir(dstClaudePluginDir);
  assertNotInsideCanonicalPlugin(dstClaudePluginDir);
  fs.cpSync(srcClaudePluginDir, dstClaudePluginDir, {
    recursive: true,
    dereference: true,
    filter: (src) => path.basename(src) !== '.DS_Store',
  });
}

// Sync canonical skills -> skills/* AND .agents/plugins/make-pictures/skills/*
const SKILL_MIRROR_DIRS = [
  path.join(ROOT_DIR, 'skills'),
  path.join(AGENTS_PLUGIN_DIR, 'skills'),
];

for (const dstDir of SKILL_MIRROR_DIRS) {
  replaceSymlinkWithRealDir(dstDir);
  assertNotInsideCanonicalPlugin(dstDir);
  fs.rmSync(dstDir, { recursive: true, force: true });
  fs.mkdirSync(dstDir, { recursive: true });

  for (const entry of fs.readdirSync(SRC_SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcSkillDir = path.join(SRC_SKILLS_DIR, entry.name);
    const dstSkillDir = path.join(dstDir, entry.name);
    fs.cpSync(srcSkillDir, dstSkillDir, {
      recursive: true,
      dereference: true,
      filter: (src) => path.basename(src) !== '.DS_Store',
    });
  }
}

// Sync canonical rules/AGENTS.md & rules/CLAUDE.md -> root AND .agents/plugins/make-pictures/rules/
const AGENTS_RULES_MIRROR_DIR = path.join(AGENTS_PLUGIN_DIR, 'rules');
replaceSymlinkWithRealDir(AGENTS_RULES_MIRROR_DIR);
assertNotInsideCanonicalPlugin(AGENTS_RULES_MIRROR_DIR);

const srcAgentsMd = path.join(SRC_RULES_DIR, 'AGENTS.md');
if (fs.existsSync(srcAgentsMd)) {
  fs.copyFileSync(srcAgentsMd, path.join(ROOT_DIR, 'AGENTS.md'));
  fs.copyFileSync(srcAgentsMd, path.join(AGENTS_RULES_MIRROR_DIR, 'AGENTS.md'));
}

const srcClaudeMd = path.join(SRC_RULES_DIR, 'CLAUDE.md');
if (fs.existsSync(srcClaudeMd)) {
  fs.copyFileSync(srcClaudeMd, path.join(ROOT_DIR, 'CLAUDE.md'));
  fs.copyFileSync(srcClaudeMd, path.join(AGENTS_RULES_MIRROR_DIR, 'CLAUDE.md'));
}

console.log(
  `Synced skills/ + .agents/plugins/make-pictures/ and AGENTS.md + CLAUDE.md from plugins/make-pictures/`
);
