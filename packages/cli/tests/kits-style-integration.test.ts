import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import { BUILT_IN_STYLE_IDS, StyleProvider } from '../../core/src/index';
import {
  DioramaStage3D,
  PaperCloudCutout3D,
  PaperMountainBackdrop3D,
  PaperPineTree3D,
} from '../../kits/src/paper-diorama-3d';
import {
  IsometricStage3D,
  IsometricStudioEnvironment,
} from '../../kits/src/isometric-3d';
import {
  AnimatedMetricCounter,
  ImpactKeywordCard,
  WordByWordStage,
  formatTabularMetric,
  groupWordsIntoBeats,
} from '../../kits/src/kinetic-typography';
import { WorldBox } from '../../kits/src/motion-diagrams-2d/NodeBox';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('DioramaStage3D and IsometricStage3D are exported as neutral 3D stage components while legacy exports remain intact', () => {
  assert.equal(typeof DioramaStage3D, 'function');
  assert.equal(typeof IsometricStage3D, 'function');
  assert.equal(typeof PaperMountainBackdrop3D, 'function');
  assert.equal(typeof PaperPineTree3D, 'function');
  assert.equal(typeof PaperCloudCutout3D, 'function');
  assert.equal(typeof IsometricStudioEnvironment, 'function');
});

test('Everest and demo-specific 3D props are marked @deprecated in JSDoc', () => {
  const popUpSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/paper-diorama-3d/PaperPopUpBook3D.tsx'),
    'utf8'
  );
  const isoSrc = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../kits/src/isometric-3d/IsometricStudioEnvironment.tsx'
    ),
    'utf8'
  );
  assert.match(popUpSrc, /@deprecated[\s\S]*?export const PaperMountainBackdrop3D/);
  assert.match(popUpSrc, /@deprecated[\s\S]*?export const PaperPineTree3D/);
  assert.match(popUpSrc, /@deprecated[\s\S]*?export const PaperCloudCutout3D/);
  assert.match(isoSrc, /@deprecated[\s\S]*?export const IsometricStudioEnvironment/);
});

test('all 13 2D kit components wire useStudioStyle() for theme-aware defaults and contain zero Math.random()', () => {
  const kitFiles = [
    'kinetic-typography/WordByWordStage.tsx',
    'kinetic-typography/ImpactKeywordCard.tsx',
    'kinetic-typography/AnimatedMetricCounter.tsx',
    'data-storytelling/AnimatedBarRace.tsx',
    'data-storytelling/TimelineTrack.tsx',
    'data-storytelling/MetricComparisonCard.tsx',
    'motion-diagrams-2d/NodeBox.tsx',
    'motion-diagrams-2d/SystemNode.tsx',
    'motion-diagrams-2d/DataFlowEdge.tsx',
    'motion-diagrams-2d/CodePayloadToast.tsx',
    'product-frames/BrowserFrame.tsx',
    'product-frames/PhoneFrame.tsx',
    'product-frames/ScreenSpotlightOverlay.tsx',
  ];

  for (const rel of kitFiles) {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../kits/src', rel),
      'utf8'
    );
    assert.match(
      src,
      /useStudioStyle/,
      `Expected ${rel} to consume useStudioStyle()`
    );
    assert.doesNotMatch(
      src,
      /Math\.random\s*\(/,
      `Expected ${rel} to contain zero Math.random()`
    );
  }

  for (const stageRel of [
    'paper-diorama-3d/DioramaStage3D.tsx',
    'isometric-3d/IsometricStage3D.tsx',
  ]) {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../kits/src', stageRel),
      'utf8'
    );
    assert.doesNotMatch(src, /Math\.random\s*\(/);
  }
});

test('WorldBox inherits active StyleProvider chrome and body font when no explicit variant override is passed', () => {
  const brutalMarkup = renderToStaticMarkup(
    React.createElement(StyleProvider, {
      style: 'brutalist-poster',
      children: React.createElement(WorldBox, {
        node: { cx: 200, cy: 150, w: 300, h: 120 },
        children: 'Brutalist Card',
      }),
    })
  );
  assert.match(brutalMarkup, /Space Grotesk/);
  assert.match(brutalMarkup, /6px 6px 0px/);
  assert.match(brutalMarkup, /border-radius:0/);

  const editorialMarkup = renderToStaticMarkup(
    React.createElement(StyleProvider, {
      style: 'editorial-press',
      children: React.createElement(WorldBox, {
        node: { cx: 200, cy: 150, w: 300, h: 120 },
        children: 'Editorial Card',
      }),
    })
  );
  assert.match(editorialMarkup, /DM Sans/);
  assert.match(editorialMarkup, /1\.5px solid/);
});

test('kinetic-typography renders swiss-spatial, optical-gate, and risograph-poster grammars without karaoke pills or default Sparkles icon', () => {
  assert.equal(typeof groupWordsIntoBeats, 'function');
  assert.equal(typeof formatTabularMetric, 'function');
  assert.equal(formatTabularMetric(12345.67, 1, ','), '12,345.7');

  const sampleWords = [
    { word: 'Sztuka', normalizedWord: 'sztuka', start: 0.1, end: 0.4, startFrame: 6, endFrame: 24 },
    { word: 'żywego', normalizedWord: 'żywego', start: 0.42, end: 0.72, startFrame: 25, endFrame: 43 },
    { word: 'światła', normalizedWord: 'światła', start: 0.75, end: 1.1, startFrame: 45, endFrame: 66 },
    { word: 'buduje', normalizedWord: 'buduje', start: 1.5, end: 1.8, startFrame: 90, endFrame: 108 },
    { word: 'głębię', normalizedWord: 'głębię', start: 1.82, end: 2.2, startFrame: 109, endFrame: 132 },
  ];

  const beats = groupWordsIntoBeats(sampleWords, 4, 60);
  assert.equal(beats.length, 2);

  const styleGrammarPairs = [
    { styleId: 'editorial-press', expectedGrammar: 'swiss-spatial' },
    { styleId: 'cyber-telemetry', expectedGrammar: 'optical-gate' },
    { styleId: 'brutalist-poster', expectedGrammar: 'risograph-poster' },
  ] as const;

  for (const { styleId, expectedGrammar } of styleGrammarPairs) {
    const KineticScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(WordByWordStage, {
          words: sampleWords,
          eyebrow: 'AKT I • RYTM',
          startFrame: 2,
        }),
        React.createElement(ImpactKeywordCard, {
          keyword: 'Głębia ostrości',
          eyebrow: 'OPTYKA',
          badge: '60 FPS',
          startFrame: 2,
        }),
        React.createElement(AnimatedMetricCounter, {
          value: 98.4,
          decimals: 1,
          suffix: '%',
          label: 'Ostrość kadru',
          badge: '-14 LUFS',
          startFrame: 2,
        }),
        React.createElement(AnimatedMetricCounter, {
          value: 60,
          suffix: ' FPS',
          variant: 'inline',
          startFrame: 2,
        })
      );

    // Frame 0 invariant
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: KineticScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 160,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /Głębia ostrości/);
    assert.doesNotMatch(f0, /Sztuka/);
    assert.doesNotMatch(f0, /FPS/);

    // Frame 52: active word "światła" in beat 1, ImpactKeywordCard without Sparkles SVG, vernier/poster counter without 5px bar
    const f52 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: KineticScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 160,
        fps: 60,
        frameToDisplay: 52,
      })
    );
    assert.match(f52, new RegExp(`data-typography-grammar="${expectedGrammar}"`));
    assert.match(f52, new RegExp(`data-card-grammar="${expectedGrammar}"`));
    assert.doesNotMatch(f52, /lucide-sparkles/i);
    assert.doesNotMatch(f52, /height:5px;border-radius:9999px/);
    assert.doesNotMatch(f52, /blur\(0(?:\.0+)?px\)/);
    if (expectedGrammar !== 'risograph-poster') {
      assert.match(f52, /data-vernier-scale="true"/);
      assert.equal((f52.match(/<line /g) ?? []).length, 21);
      assert.match(f52, /filter:none/);
    } else {
      assert.match(f52, /data-risograph-meter="true"/);
      const meterChunk = f52.split('data-risograph-meter="true"')[1] ?? '';
      assert.equal((meterChunk.match(/height:8px/g) ?? []).length, 10);
    }
  }

  // Explicit icon prop renders clean inline mark without gradient icon tile, and startFrame=0 still obeys Clean Frame 0
  const ExplicitIconScene: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press' },
      React.createElement(ImpactKeywordCard, {
        keyword: 'Znak autorski',
        icon: React.createElement('span', { 'data-custom-mark': 'true' }, '§'),
        startFrame: 0,
      })
    );
  const iconF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ExplicitIconScene,
      compositionWidth: 1080,
      compositionHeight: 1920,
      durationInFrames: 60,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(iconF0, /Znak autorski/);
  const iconF24 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: ExplicitIconScene,
      compositionWidth: 1080,
      compositionHeight: 1920,
      durationInFrames: 60,
      fps: 60,
      frameToDisplay: 24,
    })
  );
  assert.match(iconF24, /data-custom-mark="true"/);
  assert.doesNotMatch(iconF24, /linear-gradient\(135deg/);

  // Verify all 7 BUILT_IN_STYLES × explicit 3 grammars render cleanly in both 16:9 and 9:16 with Polish diacritics
  for (const styleId of BUILT_IN_STYLE_IDS) {
    for (const grammar of [
      'swiss-spatial',
      'optical-gate',
      'risograph-poster',
    ] as const) {
      for (const [w, h] of [
        [1920, 1080],
        [1080, 1920],
      ] as const) {
        const PolyScene: React.FC = () =>
          React.createElement(
            StyleProvider,
            { style: styleId },
            React.createElement(WordByWordStage, {
              words: sampleWords,
              grammar,
              startFrame: 2,
            }),
            React.createElement(ImpactKeywordCard, {
              keyword: 'Żółć i źdźbło',
              grammar,
              startFrame: 2,
            }),
            React.createElement(AnimatedMetricCounter, {
              value: 100,
              grammar,
              startFrame: 2,
            })
          );

        const html = renderToStaticMarkup(
          React.createElement(Thumbnail, {
            component: PolyScene,
            compositionWidth: w,
            compositionHeight: h,
            durationInFrames: 160,
            fps: 60,
            frameToDisplay: 36,
          })
        );
        assert.match(html, new RegExp(`data-typography-grammar="${grammar}"`));
        assert.match(html, /światła|ŚWIATŁA/);
        assert.match(html, /Żółć i źdźbło|ŻÓŁĆ I ŹDŹBŁO/);
        assert.doesNotMatch(html, /blur\(0(?:\.0+)?px\)/);
      }
    }
  }
});
