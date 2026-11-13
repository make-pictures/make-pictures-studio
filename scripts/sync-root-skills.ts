import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'plugins/make-pictures/skills');
const DST_DIR = path.join(ROOT_DIR, 'skills');

fs.rmSync(DST_DIR, { recursive: true, force: true });
fs.mkdirSync(DST_DIR, { recursive: true });

for (const entry of fs.readdirSync(SRC_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const srcSkillDir = path.join(SRC_DIR, entry.name);
  const dstSkillDir = path.join(DST_DIR, entry.name);
  fs.cpSync(srcSkillDir, dstSkillDir, {
    recursive: true,
    dereference: true,
    filter: (src) => path.basename(src) !== '.DS_Store',
  });
}

console.log(`Synced skills/ from plugins/make-pictures/skills/ -> ${DST_DIR}`);
