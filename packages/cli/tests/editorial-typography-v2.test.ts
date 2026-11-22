import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import { StyleProvider } from '../../core/src/index';
import { scanTsxForSmallFontSizes } from '../src/director/audit-direction';
import * as editorialCollage from '../../kits/src/editorial-collage';
import * as kitsRoot from '../../kits/src/index';
import {
  PaperRibbonTimeline,
  resolveActivePaperMilestoneId,
  type PaperTimelineMilestone,
} from '../../kits/src/editorial-collage/PaperRibbonTimeline';
import { FloatingEditorialDisplay } from '../../kits/src/editorial-collage/FloatingEditorialDisplay';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SAMPLE_MILESTONES: ReadonlyArray<PaperTimelineMilestone> = [
  { id: 'stack', era: '01', label: 'Macro Stack', fromFrame: 2 },
  { id: 'arc', era: '02', label: 'Disney Arc', fromFrame: 91 },
  { id: 'glass', era: '03', label: 'Screen Glass', fromFrame: 156 },
  { id: 'settle', era: '04', label: 'Settle', fromFrame: 271 },
];

test('resolveActivePaperMilestoneId switches deterministically at fromFrame, respects explicitActiveId, and handles empty arrays', () => {
  assert.equal(resolveActivePaperMilestoneId([], 30), null);
  assert.equal(resolveActivePaperMilestoneId([], 30, 'explicit'), null);

  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 0), 'stack');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 2), 'stack');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 90), 'stack');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 91), 'arc');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 155), 'arc');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 156), 'glass');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 270), 'glass');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 271), 'settle');
  assert.equal(resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 359), 'settle');

  // Explicit activeId overrides frame-based resolution
  assert.equal(
    resolveActivePaperMilestoneId(SAMPLE_MILESTONES, 300, 'arc'),
    'arc'
  );

  // Milestones without fromFrame fall back to first entry
  assert.equal(
    resolveActivePaperMilestoneId(
      [
        { id: 'a', era: '01', label: 'One' },
        { id: 'b', era: '02', label: 'Two' },
      ],
      100
    ),
    'a'
  );
});

test('PaperRibbonTimeline, resolveActivePaperMilestoneId, and FloatingEditorialDisplay are exported from editorial-collage and kits root', () => {
  assert.equal(typeof PaperRibbonTimeline, 'function');
  assert.equal(typeof resolveActivePaperMilestoneId, 'function');
  assert.equal(typeof FloatingEditorialDisplay, 'function');

  assert.equal(editorialCollage.PaperRibbonTimeline, PaperRibbonTimeline);
  assert.equal(
    editorialCollage.resolveActivePaperMilestoneId,
    resolveActivePaperMilestoneId
  );
  assert.equal(
    editorialCollage.FloatingEditorialDisplay,
    FloatingEditorialDisplay
  );

  assert.equal(kitsRoot.PaperRibbonTimeline, PaperRibbonTimeline);
  assert.equal(
    kitsRoot.resolveActivePaperMilestoneId,
    resolveActivePaperMilestoneId
  );
  assert.equal(kitsRoot.FloatingEditorialDisplay, FloatingEditorialDisplay);
});

test('PaperRibbonTimeline.tsx and FloatingEditorialDisplay.tsx pass typography floor (>= 18px & >= 19px), Clean Frame 0, border-box, zero Math.random(), and frameless invariants', () => {
  const ribbonPath = path.resolve(
    __dirname,
    '../../kits/src/editorial-collage/PaperRibbonTimeline.tsx'
  );
  const displayPath = path.resolve(
    __dirname,
    '../../kits/src/editorial-collage/FloatingEditorialDisplay.tsx'
  );

  const ribbonSrc = fs.readFileSync(ribbonPath, 'utf8');
  const displaySrc = fs.readFileSync(displayPath, 'utf8');

  for (const [name, filePath, src] of [
    ['PaperRibbonTimeline.tsx', ribbonPath, ribbonSrc],
    ['FloatingEditorialDisplay.tsx', displayPath, displaySrc],
  ] as const) {
    assert.deepEqual(
      scanTsxForSmallFontSizes(src, filePath, 18),
      [],
      `Expected 0 fontSize < 18px violations in ${name}`
    );
    assert.deepEqual(
      scanTsxForSmallFontSizes(src, filePath, 19),
      [],
      `Expected 0 fontSize < 19px violations in ${name}`
    );
    assert.doesNotMatch(
      src,
      /Math\.random\s*\(/,
      `Forbidden Math.random() found in ${name}`
    );
    assert.match(
      src,
      /frame\s*<=\s*0\s*\|\|\s*frame\s*<\s*effectiveStart/,
      `Expected Clean Frame 0 guard in ${name}`
    );
    assert.match(
      src,
      /Math\.max\(\s*2\s*,\s*enterFrame\s*\)/,
      `Expected Math.max(2, enterFrame) Clean Frame 0 floor in ${name}`
    );
    assert.match(
      src,
      /boxSizing:\s*['"]border-box['"]/,
      `Expected boxSizing: 'border-box' in ${name}`
    );
  }

  // FloatingEditorialDisplay must be strictly frameless (background: 'transparent')
  assert.match(
    displaySrc,
    /background:\s*['"]transparent['"]/,
    'FloatingEditorialDisplay must enforce frameless background: "transparent"'
  );
});

test('PaperRibbonTimeline and FloatingEditorialDisplay enforce Clean Frame 0 at runtime and render frameless typography >= 19px', () => {
  const SceneComp: React.FC<{
    tone?: 'auto' | 'light-on-dark' | 'dark-on-light';
    headlinePx?: number;
    sublinePx?: number;
    enterFrame?: number;
  }> = ({ tone = 'auto', headlinePx = 52, sublinePx = 21, enterFrame = 2 }) =>
    React.createElement(
      StyleProvider,
      { style: 'tactile-craft' },
      React.createElement(FloatingEditorialDisplay, {
        eyebrow: 'TACTILE 3D ENGINE',
        headline: 'Studio Specimen Sheet',
        subline: 'Deterministic 60 FPS PBR paper & glass kinematics',
        tone,
        headlinePx,
        sublinePx,
        monoSubline: true,
        enterFrame,
      }),
      React.createElement(PaperRibbonTimeline, {
        milestones: SAMPLE_MILESTONES,
        enterFrame,
      })
    );

  // Frame 0: Clean Frame 0 — zero editorial overlays rendered even if enterFrame=0
  const htmlF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: SceneComp,
      inputProps: { enterFrame: 0 },
      compositionWidth: 1920,
      compositionHeight: 1080,
      frameToDisplay: 0,
      durationInFrames: 360,
      fps: 60,
    })
  );
  assert.doesNotMatch(htmlF0, /paper-ribbon-timeline/);
  assert.doesNotMatch(htmlF0, /floating-editorial-display/);
  assert.doesNotMatch(htmlF0, /Studio Specimen Sheet/);

  // Frame 1: still before Math.max(2, enterFrame)
  const htmlF1 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: SceneComp,
      inputProps: { enterFrame: 0 },
      compositionWidth: 1920,
      compositionHeight: 1080,
      frameToDisplay: 1,
      durationInFrames: 360,
      fps: 60,
    })
  );
  assert.doesNotMatch(htmlF1, /paper-ribbon-timeline/);
  assert.doesNotMatch(htmlF1, /floating-editorial-display/);

  // Frame 100: active milestone is 'arc' (02 Disney Arc), frameless transparent background, clamped small sizes
  const htmlF100 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: SceneComp,
      inputProps: { tone: 'light-on-dark', headlinePx: 12, sublinePx: 11 },
      compositionWidth: 1920,
      compositionHeight: 1080,
      frameToDisplay: 100,
      durationInFrames: 360,
      fps: 60,
    })
  );
  assert.match(htmlF100, /data-component="floating-editorial-display"/);
  assert.match(htmlF100, /data-component="paper-ribbon-timeline"/);
  assert.match(htmlF100, /background:transparent/);
  assert.match(htmlF100, /#FAF3E3/i);
  assert.match(htmlF100, /font-size:32px/); // headlinePx=12 clamped to 32px
  assert.match(htmlF100, /font-size:20px/); // sublinePx=11 clamped to 20px (and era=20px)
  assert.match(htmlF100, /font-size:21px/); // milestone label=21px
  assert.match(htmlF100, /font-size:19px/); // eyebrow=19px
  assert.match(htmlF100, /tabular-nums/);
  assert.match(htmlF100, /Disney Arc/);
});
