import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { StudioProtocolInternals } from '@remotion/studio-protocol';
import { REMOTION_ELEMENTS_CATALOG } from '../../remotion/src/elements';
import { runElementsBuildCommand } from '../src/commands/elements';

test('REMOTION_ELEMENTS_CATALOG defines 7 flagship elements with null @remotion/* versions', () => {
  assert.equal(REMOTION_ELEMENTS_CATALOG.length, 7);
  const slugs = REMOTION_ELEMENTS_CATALOG.map((e) => e.slug);
  assert.deepEqual(slugs, [
    'editorial-media-card',
    'floating-editorial-display',
    'animated-bar-race',
    'product-browser-frame',
    'motion-diagram-stage',
    'paper-cutout-3d',
    'smart-music-bed',
  ]);
  for (const item of REMOTION_ELEMENTS_CATALOG) {
    assert.ok(
      StudioProtocolInternals.getElementComponentNameFromSourceCode(
        item.sourceCode
      ),
      `${item.slug} must export exactly one named React component`
    );
    assert.doesNotMatch(
      item.sourceCode,
      /@make-pictures\/(?:studio|core|kits)|\.props\.json|registry\.ts/
    );
    for (const dep of item.dependencies) {
      if (dep.name.startsWith('@remotion/')) {
        assert.equal(
          dep.version,
          null,
          `${item.slug} dep ${dep.name} must have version: null`
        );
      }
    }
  }
});

test('runElementsBuildCommand writes valid JSON payloads, HTML embeds, and index.json', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-elements-'));
  try {
    const result = await runElementsBuildCommand({
      outDir,
      baseUrl: 'https://make.pictures/elements',
    });
    assert.equal(result.count, 7);
    assert.equal(fs.existsSync(path.join(outDir, 'index.json')), true);

    const index = JSON.parse(
      fs.readFileSync(path.join(outDir, 'index.json'), 'utf8')
    );
    assert.equal(index.elements.length, 7);

    for (const entry of index.elements) {
      const jsonPath = path.join(outDir, `${entry.slug}.json`);
      const htmlPath = path.join(outDir, entry.slug, 'index.html');
      assert.equal(fs.existsSync(jsonPath), true);
      assert.equal(fs.existsSync(htmlPath), true);

      const rawPayload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const parsedJson =
        StudioProtocolInternals.parseStudioElementPayload(rawPayload);
      assert.ok(parsedJson, `${entry.slug}.json must parse as StudioElementPayload`);
      assert.equal(parsedJson.element.slug, entry.slug);

      const html = fs.readFileSync(htmlPath, 'utf8');
      assert.match(html, /remotion-element/i);

      const parsedHtml =
        StudioProtocolInternals.parseElementPayloadsFromHtml(html);
      assert.equal(parsedHtml.invalidPayloadCount, 0);
      assert.equal(parsedHtml.payloads.length, 1);
      assert.equal(parsedHtml.payloads[0]?.element.slug, entry.slug);
      assert.equal(parsedHtml.siteName, 'make.pictures');
      assert.deepEqual(parsedHtml.alternateHrefs, [
        `https://make.pictures/elements/${entry.slug}.json`,
      ]);
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
