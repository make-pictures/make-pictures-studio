import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import { BUILT_IN_STYLE_IDS, BUILT_IN_STYLES, StyleProvider } from '../../core/src/index';
import {
  AnimatedBarRace,
  DataStoryStage2D,
  MetricComparisonCard,
  TimelineTrack,
  getSmoothedRanks,
  resolveTonalBarFill,
} from '../../kits/src/data-storytelling';
import * as kitsRoot from '../../kits/src/index';
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

test('DataStoryStage2D, tonal AnimatedBarRace, vernier rack-focus TimelineTrack, and 240-deg / hatched MetricComparisonCard eliminate SaaS slop across styles', () => {
  assert.equal(typeof DataStoryStage2D, 'function');
  assert.equal(typeof getSmoothedRanks, 'function');
  assert.equal(typeof resolveTonalBarFill, 'function');
  assert.equal(kitsRoot.DataStoryStage2D, DataStoryStage2D);
  assert.equal(kitsRoot.getSmoothedRanks, getSmoothedRanks);
  assert.equal(kitsRoot.resolveTonalBarFill, resolveTonalBarFill);

  const stageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/DataStoryStage2D.tsx'),
    'utf8'
  );
  const barSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/AnimatedBarRace.tsx'),
    'utf8'
  );
  const timelineSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/TimelineTrack.tsx'),
    'utf8'
  );
  const metricSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/data-storytelling/MetricComparisonCard.tsx'),
    'utf8'
  );

  assert.match(stageSrc, /frame\s*<=\s*0/);
  assert.match(stageSrc, /useStudioStyle/);
  for (const [name, src] of [
    ['DataStoryStage2D.tsx', stageSrc],
    ['AnimatedBarRace.tsx', barSrc],
    ['TimelineTrack.tsx', timelineSrc],
    ['MetricComparisonCard.tsx', metricSrc],
  ] as const) {
    assert.doesNotMatch(src, /Math\.random\s*\(/, `${name} must not use Math.random()`);
    assert.doesNotMatch(src, /useRef\b/, `${name} must not use mutable useRef`);
    assert.doesNotMatch(src, /9999/, `${name} must not use borderRadius: 9999 pills`);
  }
  assert.doesNotMatch(barSrc, /FALLBACK_BAR_SWATCHES/);
  assert.doesNotMatch(barSrc, /#10B981|#F59E0B|#F43F5E|#A855F7/);
  assert.doesNotMatch(timelineSrc, /lucide-react/);
  assert.doesNotMatch(metricSrc, /lucide-react/);
  assert.doesNotMatch(metricSrc, /strokeLinecap="round"/);

  // Tonal hierarchy: rank 0 -> accentPrimary, rank 1 -> accentSecondary, explicit color preserved
  const edStyle = BUILT_IN_STYLES['editorial-press'];
  assert.equal(resolveTonalBarFill(edStyle, 0), edStyle.palette.accentPrimary);
  assert.equal(resolveTonalBarFill(edStyle, 1), edStyle.palette.accentSecondary);
  assert.equal(resolveTonalBarFill(edStyle, 2, '#123456'), '#123456');
  assert.equal(resolveTonalBarFill(edStyle, 2), edStyle.palette.textSecondary);

  // Deterministic overtaking rank smoother
  const rankMid = getSmoothedRanks(
    [
      { id: 'a', label: 'A', value: 50, keyframes: [{ frame: 0, value: 80 }, { frame: 60, value: 40 }] },
      { id: 'b', label: 'B', value: 50, keyframes: [{ frame: 0, value: 30 }, { frame: 60, value: 90 }] },
    ],
    30
  );
  assert.ok((rankMid.get('a') ?? 0) > 0 && (rankMid.get('a') ?? 1) < 1);

  for (const [styleId, expectedGrammar] of [
    ['editorial-press', 'swiss-spatial'],
    ['cyber-telemetry', 'optical-gate'],
    ['brutalist-poster', 'risograph-poster'],
  ] as const) {
    const DataScene: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(
          DataStoryStage2D,
          { datasetCode: 'KARTOGRAFIA DANYCH • 2026' },
          React.createElement(AnimatedBarRace, {
            title: 'Udział źródeł energii',
            subtitle: 'Porównanie kwartalne',
            valueSuffix: '%',
            startFrame: 2,
            items: [
              { id: 'solar', label: 'Fotowoltaika', value: 94 },
              { id: 'wind', label: 'Wiatr morski', value: 72 },
              { id: 'hydro', label: 'Hydroenergia', value: 48 },
            ],
          }),
          React.createElement(TimelineTrack, {
            startFrame: 2,
            milestones: [
              { id: 'm1', era: '1998', label: 'Archiwum analogowe', fromFrame: 2 },
              { id: 'm2', era: '2026', label: 'Przełom optyczny', fromFrame: 30 },
              { id: 'm3', era: '2030', label: 'Pełna skala', fromFrame: 90 },
            ],
          }),
          React.createElement(MetricComparisonCard, {
            title: 'Wydajność potoku',
            beforeLabel: 'Przed',
            beforeValue: 24,
            afterLabel: 'Po zmianie',
            afterValue: 68,
            unit: ' FPS',
            mode: 'rings',
            startFrame: 2,
          }),
          React.createElement(MetricComparisonCard, {
            beforeLabel: 'Baza',
            beforeValue: 30,
            afterLabel: 'Wynik',
            afterValue: 84,
            unit: '%',
            mode: 'bars',
            startFrame: 2,
          })
        )
      );

    // Frame 0 clean canvas invariant (and startFrame=0 clamp check)
    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DataScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /KARTOGRAFIA DANYCH/);
    assert.doesNotMatch(f0, /Fotowoltaika/);
    assert.doesNotMatch(f0, /Przełom optyczny/);

    // Frame 54: active milestone m2 ('2026') sharp at filter:none while m1 & m3 blurred; 240-deg arc & hatched delta rendered
    const f54 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: DataScene,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 140,
        fps: 60,
        frameToDisplay: 54,
      })
    );
    assert.match(f54, /KARTOGRAFIA DANYCH • 2026/);
    assert.match(f54, /data-depth-z="-0\.58"/);
    assert.match(f54, /data-depth-z="0\.68"/);
    assert.match(f54, new RegExp(`data-bar-grammar="${expectedGrammar}"`));
    assert.match(f54, /data-bar-grid="true"/);
    assert.match(f54, new RegExp(`data-timeline-grammar="${expectedGrammar}"`));
    assert.match(f54, /data-vernier-rail="true"/);
    assert.match(f54, /data-instrument-arc="240"/);
    assert.match(f54, /BAZA ──┼── WYNIK/);
    assert.match(f54, /data-delta-hatch="true"/);
    assert.doesNotMatch(f54, /lucide-check/i);
    assert.doesNotMatch(f54, /lucide-arrow-right/i);
    assert.doesNotMatch(f54, /border-radius:9999px/);
    assert.doesNotMatch(f54, /blur\(0(?:\.0+)?px\)/);
    const timelineChunk54 = f54.split('data-timeline-grammar=')[1] ?? '';
    assert.match(timelineChunk54, /filter:blur\(/);
    assert.match(timelineChunk54, /filter:none/);
  }

  // Zero-aperture deadzone (< 0.25px -> filter: 'none'), renderBaseFill={false}, startFrame=0 guard, and 4-milestone 9:16 vertical TimelineTrack
  const zeroAperturePreset = {
    ...BUILT_IN_STYLES['minimal-product'],
    optics: {
      ...BUILT_IN_STYLES['minimal-product'].optics!,
      aperture: 0,
    },
  };
  const EdgeCaseScene: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: zeroAperturePreset },
      React.createElement(
        DataStoryStage2D,
        { renderBaseFill: false, foregroundAccents: false },
        React.createElement(AnimatedBarRace, {
          orientation: 'vertical',
          startFrame: 0,
          variant: 'dark',
          items: [
            { id: 'c1', label: 'Zażółć', value: 88, badge: 'TOP' },
            { id: 'c2', label: 'Gęślą', value: 52 },
          ],
        }),
        React.createElement(TimelineTrack, {
          startFrame: 0,
          variant: 'light',
          milestones: [
            { id: 's1', era: '01', label: 'Etap pierwszy', fromFrame: 2 },
            { id: 's2', era: '02', label: 'Etap drugi', fromFrame: 20 },
            { id: 's3', era: '03', label: 'Etap trzeci', fromFrame: 40 },
            { id: 's4', era: '04', label: 'Etap czwarty', fromFrame: 80 },
          ],
        }),
        React.createElement(MetricComparisonCard, {
          beforeLabel: 'Przed',
          beforeValue: 90,
          afterLabel: 'Po',
          afterValue: 30,
          mode: 'bars',
          startFrame: 0,
          variant: 'dark',
        })
      )
    );

  const edgeF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: EdgeCaseScene,
      compositionWidth: 1080,
      compositionHeight: 1920,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(edgeF0, /Zażółć/);
  assert.doesNotMatch(edgeF0, /Etap/);
  assert.doesNotMatch(edgeF0, /background-color:#F8FAFC/i);

  const edgeF1 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: EdgeCaseScene,
      compositionWidth: 1080,
      compositionHeight: 1920,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 1,
    })
  );
  assert.doesNotMatch(edgeF1, /Zażółć/);
  assert.doesNotMatch(edgeF1, /Etap/);

  const edgeF48 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: EdgeCaseScene,
      compositionWidth: 1080,
      compositionHeight: 1920,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 48,
    })
  );
  assert.match(edgeF48, /Zażółć/);
  assert.match(edgeF48, /Etap trzeci/);
  assert.match(edgeF48, /Δ -67%/);
  const edgeTimelineChunk = edgeF48.split('data-timeline-grammar=')[1] ?? '';
  assert.doesNotMatch(edgeTimelineChunk, /filter:blur\(/);
  assert.match(edgeTimelineChunk, /filter:none/);
  assert.doesNotMatch(edgeF48, /blur\(0(?:\.0+)?px\)/);

  // Verify all 7 BUILT_IN_STYLE_IDS across 16:9 and 9:16
  for (const styleId of BUILT_IN_STYLE_IDS) {
    for (const [w, h] of [
      [1920, 1080],
      [1080, 1920],
    ] as const) {
      const AllStylesDataScene: React.FC = () =>
        React.createElement(
          StyleProvider,
          { style: styleId },
          React.createElement(
            DataStoryStage2D,
            { datasetCode: 'PEŁNA MACIERZ STYLÓW' },
            React.createElement(AnimatedBarRace, {
              title: 'Żółw i źródło',
              startFrame: 2,
              items: [
                { id: 'x1', label: 'Jakość obrazu', value: 95 },
                { id: 'x2', label: 'Płynność ruchu', value: 78 },
              ],
            })
          )
        );
      const html = renderToStaticMarkup(
        React.createElement(Thumbnail, {
          component: AllStylesDataScene,
          compositionWidth: w,
          compositionHeight: h,
          durationInFrames: 90,
          fps: 60,
          frameToDisplay: 36,
        })
      );
      assert.match(html, /PEŁNA MACIERZ STYLÓW/);
      assert.match(html, /Żółw i źródło|ŻÓŁW I ŹRÓDŁO/);
      assert.doesNotMatch(html, /blur\(0(?:\.0+)?px\)/);
    }
  }
});
