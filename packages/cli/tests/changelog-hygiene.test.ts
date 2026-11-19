import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

test('CHANGELOG.md documents public releases, is linked in READMEs, and respects open-source separation', () => {
  const changelogPath = path.join(REPO_ROOT, 'CHANGELOG.md');
  assert.ok(fs.existsSync(changelogPath), 'Expected root CHANGELOG.md to exist');

  const content = fs.readFileSync(changelogPath, 'utf8');
  for (const version of ['2.3.2', '2.3.1', '2.3.0', '2.2.0', '2.1.1', '2.0.3', '2.0.2', '2.0.0']) {
    assert.ok(
      content.includes(`[${version}]`),
      `Expected CHANGELOG.md to include section [${version}]`
    );
  }

  assert.ok(
    content.includes('https://github.com/make-pictures/make-pictures-studio/releases/tag/v2.3.2'),
    'Expected CHANGELOG.md to link to v2.3.2 release tag'
  );

  // Strict Open-Source Separation Rule: no private production episode names
  const forbiddenEpisodePattern =
    /everest|apollo\s*13|korotkow|sataris|agronom|\bpolon\b|polon[-\s]?3000/i;
  assert.equal(
    forbiddenEpisodePattern.test(content),
    false,
    'CHANGELOG.md must not mention private studio episode names'
  );

  const readmeEn = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
  const readmePl = fs.readFileSync(path.join(REPO_ROOT, 'README.pl.md'), 'utf8');
  assert.ok(readmeEn.includes('./CHANGELOG.md'), 'Expected README.md to link to ./CHANGELOG.md');
  assert.ok(readmePl.includes('./CHANGELOG.md'), 'Expected README.pl.md to link to ./CHANGELOG.md');
  assert.equal(
    forbiddenEpisodePattern.test(readmeEn),
    false,
    'README.md must not mention private studio episode names'
  );
  assert.equal(
    forbiddenEpisodePattern.test(readmePl),
    false,
    'README.pl.md must not mention private studio episode names'
  );
});
