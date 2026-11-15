import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import { StyleProvider } from '../../core/src/index';
import {
  ChapterTitleCard,
  EditorialDeskStage,
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
  VectorSceneStage2D,
  computeSafeSplitBounds,
} from '../../kits/src/vector-scene-2d';
import * as kitsRoot from '../../kits/src/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('editorial-collage, vector-scene-2d, and @make-pictures/kits root export all narrative components', () => {
  assert.equal(typeof EditorialDeskStage, 'function');
  assert.equal(typeof ChapterTitleCard, 'function');
  assert.equal(typeof EditorialMediaCard, 'function');
  assert.equal(typeof HighlightQuoteStage, 'function');
  assert.equal(typeof SplitStoryLayout, 'function');
  assert.equal(typeof VectorSceneStage2D, 'function');
  assert.equal(typeof StoryCard2D, 'function');
  assert.equal(typeof AnnotatedCallout2D, 'function');
  assert.equal(typeof ComparisonSplit2D, 'function');

  assert.equal(kitsRoot.EditorialDeskStage, EditorialDeskStage);
  assert.equal(kitsRoot.ChapterTitleCard, ChapterTitleCard);
  assert.equal(kitsRoot.EditorialMediaCard, EditorialMediaCard);
  assert.equal(kitsRoot.HighlightQuoteStage, HighlightQuoteStage);
  assert.equal(kitsRoot.SplitStoryLayout, SplitStoryLayout);
  assert.equal(kitsRoot.VectorSceneStage2D, VectorSceneStage2D);
  assert.equal(kitsRoot.StoryCard2D, StoryCard2D);
  assert.equal(kitsRoot.AnnotatedCallout2D, AnnotatedCallout2D);
  assert.equal(kitsRoot.ComparisonSplit2D, ComparisonSplit2D);
});

test('computeSafeSplitBounds and computeSplitStoryVerticalBounds enforce 9:16 Golden Safe Box x in [40, 910], y in [220, 1380]', () => {
  const vertical = computeSafeSplitBounds(1080, 1920);
  assert.equal(vertical.isVertical, true);
  assert.ok(vertical.left >= 70);
  assert.ok(vertical.left + vertical.width <= 870);
  assert.ok(vertical.top >= 260);
  assert.ok(vertical.top + vertical.height <= 1320);
  // Even under VectorSceneStage2D worst-case optical dolly (camX = 547, zoom = 1.042 + 8px hard shadow)
  assert.ok(540 + (vertical.left - 547) * 1.042 >= 46);
  assert.ok(540 + (vertical.left + vertical.width - 535) * 1.042 + 8 <= 904);

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

test('EditorialDeskStage, baryta/slide EditorialMediaCard, ink-brush HighlightQuoteStage, and SplitStoryLayout rack focus render cleanly across styles and 9:16', () => {
  const deskStageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/editorial-collage/EditorialDeskStage.tsx'),
    'utf8'
  );
  assert.doesNotMatch(
    deskStageSrc,
    /Math\.random\s*\(/,
    'Forbidden Math.random() found in EditorialDeskStage.tsx'
  );
  assert.match(
    deskStageSrc,
    /frame\s*<=\s*0/,
    'Expected Clean Frame 0 guard (frame <= 0) in EditorialDeskStage.tsx'
  );

  for (const styleId of [
    'editorial-press',
    'archival-chronicle',
    'cyber-telemetry',
    'minimal-product',
  ] as const) {
    const SceneComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          EditorialDeskStage,
          { sheetCode: 'ARKUSZ 04 • KRONIKA' },
          React.createElement(SplitStoryLayout, {
            startFrame: 2,
            focusShiftFrame: 40,
            initialFocus: 'primary',
            primary: React.createElement(EditorialMediaCard, {
              caption: 'Rękopis z żółtą pieczęcią cechową',
              sourceTag: 'ARCHIWUM • 1889',
              startFrame: 2,
            }),
            secondary: React.createElement(HighlightQuoteStage, {
              quote: 'Każda warstwa papieru niesie ślad światła i dłoni.',
              highlightPhrase: 'ślad światła',
              author: 'Kronika rzemiosła',
              startFrame: 2,
              highlightFrame: 18,
            }),
          })
        )
      );

    // Frame 0 invariant: pure bgCanvas, zero card text
    const htmlF0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SceneComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(htmlF0, /Rękopis z żółtą/);
    assert.doesNotMatch(htmlF0, /ARKUSZ 04/);

    // Frame 24 (before focusShiftFrame=40): primary sharp, contact-sheet SVG fallback rendered, ink-brush SVG present
    const htmlF24 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SceneComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 24,
      })
    );
    assert.match(htmlF24, /Rękopis z żółtą pieczęcią cechową/);
    assert.match(htmlF24, /data-mount-type="/);
    assert.match(htmlF24, /data-contact-sheet="true"/);
    assert.match(htmlF24, /data-ink-brush="true"/);
    assert.doesNotMatch(htmlF24, /blur\(0(?:\.0+)?px\)/);

    // Frame 90 (after focusShiftFrame=40): rack focus shifted cleanly
    const htmlF90 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SceneComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 90,
      })
    );
    assert.match(htmlF90, /Każda warstwa papieru/);
    assert.doesNotMatch(htmlF90, /blur\(0(?:\.0+)?px\)/);
    if (styleId === 'editorial-press') {
      assert.match(htmlF90, /data-mount-type="archival-tape"/);
    }
    if (styleId === 'cyber-telemetry') {
      assert.match(htmlF90, /data-mount-type="slide-mount"/);
    }
    if (styleId === 'archival-chronicle') {
      assert.match(htmlF90, /data-mount-type="photo-corners"/);
    }
    if (styleId === 'minimal-product') {
      assert.match(htmlF90, /data-mount-type="none"/);
    }
  }

  // ChapterTitleCard optical focus pull settles to crisp filter:none
  const ChapterComp: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press' },
      React.createElement(ChapterTitleCard, {
        chapterLabel: 'Rozdział 01',
        title: 'Zażółć gęślą jaźń',
        subtitle: 'Szlachetna typografia i światło boczne',
        startFrame: 2,
      })
    );
  const chapterEarly = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ChapterComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 4,
    })
  );
  const chapterSettled = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ChapterComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 48,
    })
  );
  assert.match(chapterEarly, /filter:blur\(/);
  assert.match(chapterSettled, /filter:none/);
});

test('VectorSceneStage2D, engraved StoryCard2D medallion, elbow AnnotatedCallout2D, and ComparisonSplit2D rack focus render cleanly across styles and 9:16', () => {
  assert.equal(typeof VectorSceneStage2D, 'function');
  assert.equal(kitsRoot.VectorSceneStage2D, VectorSceneStage2D);

  const stageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/vector-scene-2d/VectorSceneStage2D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(stageSrc, /Math\.random\s*\(/);
  assert.doesNotMatch(stageSrc, /useRef\s*[<(]/);
  assert.match(stageSrc, /frame\s*<=\s*0/);

  const storyCardSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/vector-scene-2d/StoryCard2D.tsx'),
    'utf8'
  );
  assert.doesNotMatch(storyCardSrc, /999\s*\*/);
  assert.doesNotMatch(storyCardSrc, /9999/);

  for (const [styleId, expectedGrammar] of [
    ['minimal-product', 'swiss-spatial'],
    ['editorial-press', 'swiss-spatial'],
    ['archival-chronicle', 'swiss-spatial'],
    ['cyber-telemetry', 'optical-gate'],
    ['brutalist-poster', 'risograph-poster'],
    ['sketch-notebook', 'risograph-poster'],
    ['tactile-craft', 'risograph-poster'],
  ] as const) {
    const VectorComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          VectorSceneStage2D,
          {
            plateCode: 'TABLICA 01 • ARCHITEKTURA',
            foregroundCallouts: React.createElement(AnnotatedCallout2D, {
              target: [420, 620],
              labelPosition: [680, 820],
              label: 'Punkt zwrotny zażółć',
              sublabel: 'Precyzyjny celownik osiowy',
              code: 'DETAL A·1',
              startFrame: 6,
            }),
          },
          React.createElement(StoryCard2D, {
            title: 'Żółta pieczęć i geometria',
            subtitle: 'Karta tablicowa bez pigułek SaaS',
            badge: 'FIG. 01',
            plateCode: 'Z +0.00',
            startFrame: 2,
          })
        )
      );

    // Frame 0 invariant: pure bgCanvas, zero text or stage headers
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: VectorComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /TABLICA 01/);
    assert.doesNotMatch(f0, /Żółta pieczęć/);
    assert.doesNotMatch(f0, /Punkt zwrotny/);
    assert.doesNotMatch(f0, /CAL • 1:1/);

    // renderBaseFill={false} returns pure empty stage at frame 0
    const NoFillComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(VectorSceneStage2D, {
          renderBaseFill: false,
          plateCode: 'HIDDEN_AT_ZERO',
        })
      );
    const f0NoFill = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: NoFillComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 60,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0NoFill, /HIDDEN_AT_ZERO/);

    // Frame 42: engraved medallion, elbow polyline + reticle, elevated callout plane z = +0.42
    const f42 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: VectorComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 42,
      })
    );
    assert.match(f42, /TABLICA 01 • ARCHITEKTURA/);
    assert.match(f42, new RegExp(`data-medallion-grammar="${expectedGrammar}"`));
    assert.match(f42, /data-callout-reticle="true"/);
    assert.match(f42, /data-callout-elbow="auto"/);
    assert.match(f42, /data-depth-z="-0\.6"/);
    assert.match(f42, /data-depth-z="0"/);
    assert.match(f42, /data-depth-z="0\.42"/);
    assert.match(f42, /data-depth-z="0\.72"/);
    assert.match(f42, /DETAL A·1/);
    assert.doesNotMatch(f42, /blur\(0(?:\.0+)?px\)/);

    // Straight elbow reduction when elbowMode="straight" or collinear
    const StraightCalloutComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(AnnotatedCallout2D, {
          target: [400, 600],
          labelPosition: [880, 1370],
          label: 'Klamrowana chorągiewka 9:16',
          elbowMode: 'straight',
          startFrame: 2,
        })
      );
    const fStraight = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: StraightCalloutComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 60,
        fps: 60,
        frameToDisplay: 30,
      })
    );
    assert.match(fStraight, /data-callout-elbow="straight"/);
    assert.doesNotMatch(fStraight, /left:880px/);
    assert.doesNotMatch(fStraight, /top:1370px/);

    // StoryCard2D optical pull-in settles cleanly to filter:none
    const CardPullComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(StoryCard2D, {
          title: 'Zażółć gęślą jaźń',
          startFrame: 2,
        })
      );
    const cardEarly = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: CardPullComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 80,
        fps: 60,
        frameToDisplay: 4,
      })
    );
    const cardSettled = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: CardPullComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 80,
        fps: 60,
        frameToDisplay: 30,
      })
    );
    assert.match(cardEarly, /(?:^|;)filter:blur\(/);
    assert.match(cardSettled, /(?:^|;)filter:none/);

    // ComparisonSplit2D rack focus from left -> right after focusShiftFrame=36
    const SplitComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(ComparisonSplit2D, {
          startFrame: 2,
          focusShiftFrame: 36,
          left: {
            tag: '01 • PRZED',
            title: 'Płaski szablon',
            detail: 'Brak głębi i światła kierunkowego.',
          },
          right: {
            tag: '02 • PO',
            title: 'Wieloplanowa optyka',
            detail: 'Przeostrzenie prowadzi wzrok widza.',
          },
        })
      );

    const splitBefore = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SplitComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 24,
      })
    );
    const splitAfter = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SplitComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 90,
      })
    );
    assert.match(splitBefore, /data-comparison-axis="true"/);
    assert.match(splitBefore, /data-comparison-rack="left"/);
    assert.match(splitBefore, /(?:^|;)filter:blur\(/);
    assert.doesNotMatch(splitBefore, /blur\(0(?:\.0+)?px\)/);
    assert.match(splitAfter, /Wieloplanowa optyka/i);
    assert.match(splitAfter, /(?:^|;)filter:blur\(/);
    assert.match(splitAfter, /(?:^|;)filter:none/);
    assert.doesNotMatch(splitAfter, /blur\(0(?:\.0+)?px\)/);

    // Standalone ComparisonSplit2D without focusShiftFrame keeps both sides sharp
    const SplitBothComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(ComparisonSplit2D, {
          startFrame: 2,
          left: { tag: 'A', title: 'Lewa', detail: 'Opis A' },
          right: { tag: 'B', title: 'Prawa', detail: 'Opis B' },
        })
      );
    const splitBoth = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: SplitBothComp,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 80,
        fps: 60,
        frameToDisplay: 40,
      })
    );
    assert.match(splitBoth, /data-comparison-rack="both"/);
    assert.doesNotMatch(splitBoth, /(?:^|;)filter:blur\(/);
  }
});
