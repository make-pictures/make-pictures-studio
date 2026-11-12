import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ChapterTitleCard,
  EditorialMediaCard,
  HighlightQuoteStage,
  SplitStoryLayout,
  computeSplitStoryVerticalBounds,
  resolveHighlightStartFrame,
} from '../../kits/src/editorial-collage';
import {
  AnnotatedCallout2D,
  ComparisonSplit2D,
  StoryCard2D,
  computeSafeSplitBounds,
} from '../../kits/src/vector-scene-2d';
import * as kitsRoot from '../../kits/src/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('editorial-collage, vector-scene-2d, and @make-pictures/kits root export all narrative components', () => {
  assert.equal(typeof ChapterTitleCard, 'function');
  assert.equal(typeof EditorialMediaCard, 'function');
  assert.equal(typeof HighlightQuoteStage, 'function');
  assert.equal(typeof SplitStoryLayout, 'function');
  assert.equal(typeof StoryCard2D, 'function');
  assert.equal(typeof AnnotatedCallout2D, 'function');
  assert.equal(typeof ComparisonSplit2D, 'function');

  assert.equal(kitsRoot.ChapterTitleCard, ChapterTitleCard);
  assert.equal(kitsRoot.EditorialMediaCard, EditorialMediaCard);
  assert.equal(kitsRoot.HighlightQuoteStage, HighlightQuoteStage);
  assert.equal(kitsRoot.SplitStoryLayout, SplitStoryLayout);
  assert.equal(kitsRoot.StoryCard2D, StoryCard2D);
  assert.equal(kitsRoot.AnnotatedCallout2D, AnnotatedCallout2D);
  assert.equal(kitsRoot.ComparisonSplit2D, ComparisonSplit2D);
});

test('computeSafeSplitBounds and computeSplitStoryVerticalBounds enforce 9:16 Golden Safe Box x in [40, 910], y in [220, 1380]', () => {
  const vertical = computeSafeSplitBounds(1080, 1920);
  assert.equal(vertical.isVertical, true);
  assert.ok(vertical.left >= 40);
  assert.ok(vertical.left + vertical.width <= 910);
  assert.ok(vertical.top >= 220);
  assert.ok(vertical.top + vertical.height <= 1380);

  const landscape = computeSafeSplitBounds(1920, 1080);
  assert.equal(landscape.isVertical, false);
  assert.ok(landscape.width > 1200);

  const splitVertical = computeSplitStoryVerticalBounds(1080, 1920);
  assert.ok(splitVertical.left >= 40);
  assert.ok(splitVertical.left + splitVertical.width <= 910);
  assert.ok(splitVertical.top >= 220);
  assert.ok(splitVertical.top + splitVertical.maxHeight <= 1380);
});

test('resolveHighlightStartFrame matches Polish Unicode WordTimestamp tokens and falls back deterministically', () => {
  const frameFromWords = resolveHighlightStartFrame({
    effectiveStart: 2,
    highlightFrame: 30,
    highlightPhrase: 'żółtej łodzi!',
    words: [
      {
        word: 'Historia',
        normalizedWord: 'historia',
        start: 0.1,
        end: 0.4,
        startFrame: 6,
        endFrame: 24,
      },
      {
        word: 'żółtej',
        normalizedWord: 'żółtej',
        start: 0.5,
        end: 0.8,
        startFrame: 42,
        endFrame: 60,
      },
    ],
  });
  assert.equal(frameFromWords, 42);

  const fallbackFrame = resolveHighlightStartFrame({
    effectiveStart: 10,
    highlightFrame: 26,
    highlightPhrase: 'nieobecne słowo',
    words: [],
  });
  assert.equal(fallbackFrame, 26);
});

test('narrative kit source files enforce Clean Frame 0, zero Math.random(), and style helpers', () => {
  const files = [
    'editorial-collage/ChapterTitleCard.tsx',
    'editorial-collage/EditorialMediaCard.tsx',
    'editorial-collage/HighlightQuoteStage.tsx',
    'editorial-collage/SplitStoryLayout.tsx',
    'vector-scene-2d/StoryCard2D.tsx',
    'vector-scene-2d/AnnotatedCallout2D.tsx',
    'vector-scene-2d/ComparisonSplit2D.tsx',
  ];

  for (const rel of files) {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../kits/src', rel),
      'utf8'
    );
    assert.doesNotMatch(
      src,
      /Math\.random\s*\(/,
      `Forbidden Math.random() found in ${rel}`
    );
    assert.match(
      src,
      /Math\.max\(\s*2\s*,\s*startFrame\s*\)/,
      `Expected Clean Frame 0 guard Math.max(2, startFrame) in ${rel}`
    );
    assert.match(
      src,
      /return\s+null/,
      `Expected frame < effectiveStart null return in ${rel}`
    );
  }
});

test('packages/kits/package.json and scripts/build-packages.ts register both new kit subpaths', () => {
  const pkgJson = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../kits/package.json'),
      'utf8'
    )
  ) as { exports: Record<string, unknown> };
  assert.ok(pkgJson.exports['./editorial-collage']);
  assert.ok(pkgJson.exports['./vector-scene-2d']);

  const buildScript = fs.readFileSync(
    path.resolve(__dirname, '../../../scripts/build-packages.ts'),
    'utf8'
  );
  assert.match(buildScript, /editorial-collage\/index/);
  assert.match(buildScript, /vector-scene-2d\/index/);
});
