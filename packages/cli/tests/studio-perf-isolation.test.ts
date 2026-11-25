import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import { StyleProvider, type StudioCompositionEntry } from '../../core/src/index';
import {
  FloatingEditorialDisplay,
  PaperRibbonTimeline,
} from '../../kits/src/editorial-collage/index';
import {
  buildCrispTranslateYTransform,
  sanitizeEditorialOverlayStyle,
  snapSettledProgress,
} from '../../kits/src/editorial-collage/overlayStability';
import {
  DirectorTimelinePanel,
  LiveTranscriptBar,
  StageViewport,
  StudioApp,
  StyleLabShowcase,
  useRemotionPlayer,
} from '../../studio/src/client/index';
import { TransportScrubber } from '../../studio/src/client/components/TransportScrubber';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_CLIENT_DIR = path.resolve(TEST_DIR, '../../studio/src/client');

const DummyComp: React.FC<Record<string, unknown>> = () =>
  React.createElement('div', { 'data-testid': 'perf-dummy' }, 'ok');

const SAMPLE_COMP: StudioCompositionEntry = {
  id: 'perf-smoke-comp',
  title: 'Perf Smoke Comp',
  subtitle: '60 FPS isolation test',
  group: 'Tests',
  origin: 'production',
  productionId: 'perf-smoke',
  kit: 'editorial-collage',
  component: DummyComp,
  defaultProps: { styleId: 'minimal-product' },
  propsFile: 'productions/perf-smoke/compositions/Main.props.json',
  width: 1920,
  height: 1080,
  fps: 60,
  durationInFrames: 600,
  usesThree: true,
  sceneTimeline: [
    { sceneId: 'sc-1', label: 'Akt 1', fromFrame: 0, durationInFrames: 300 },
    { sceneId: 'sc-2', label: 'Akt 2', fromFrame: 300, durationInFrames: 300 },
  ],
  cameraTimeline: [
    { shotLabel: 'Establishing', fromFrame: 0, durationInFrames: 300 },
    { shotLabel: 'Close-Up', fromFrame: 300, durationInFrames: 300 },
  ],
  sfxTimeline: [{ sfxId: 'whoosh', label: 'Whoosh', fromFrame: 295 }],
};

test('useRemotionPlayer supports trackDisplayFrame:false with imperative getFrame + subscribeFrame in SSR', () => {
  const Probe: React.FC = () => {
    const player = useRemotionPlayer({
      fps: 60,
      durationInFrames: 300,
      resetKey: 'perf-probe',
      initialFrame: 42,
      trackDisplayFrame: false,
    });
    assert.equal(typeof player.getFrame, 'function');
    assert.equal(typeof player.subscribeFrame, 'function');
    return React.createElement(
      'div',
      { 'data-frame': player.getFrame() },
      'probe'
    );
  };

  const html = renderToStaticMarkup(React.createElement(Probe));
  assert.match(html, /data-frame="42"/);
});

test('TransportScrubber, DirectorTimelinePanel, and LiveTranscriptBar render cleanly with imperative frame streams', () => {
  const noopSubscribe = () => () => {};
  const getFrame = () => 150;

  const scrubberHtml = renderToStaticMarkup(
    React.createElement(TransportScrubber, {
      resetKey: SAMPLE_COMP.id,
      fps: 60,
      maxFrameIndex: 599,
      ariaLabel: 'Oś czasu klatek',
      getFrame,
      subscribeFrame: noopSubscribe,
      onScrub: () => {},
    })
  );
  assert.match(scrubberHtml, /class="mp-scrubber-wrap"/);
  assert.match(scrubberHtml, /value="150"/);
  assert.match(scrubberHtml, /00:02\.50 • f:150\/599/);

  const timelineHtml = renderToStaticMarkup(
    React.createElement(DirectorTimelinePanel, {
      composition: SAMPLE_COMP,
      getFrame,
      subscribeFrame: noopSubscribe,
      onSeek: () => {},
      hideQaActions: true,
    })
  );
  assert.match(timelineHtml, /--mp-playhead-pct:25\.0417/);
  assert.match(timelineHtml, /class="mp-dt-playhead"/);
  assert.doesNotMatch(
    timelineHtml,
    /class="mp-dt-playhead"[^>]*style="left:/,
    'Timeline playhead must be driven by GPU CSS variable transform rather than inline left%'
  );

  const transcriptHtml = renderToStaticMarkup(
    React.createElement(LiveTranscriptBar, {
      composition: SAMPLE_COMP,
      getFrame,
      subscribeFrame: noopSubscribe,
      onSeek: () => {},
    })
  );
  assert.match(transcriptHtml, /class="mp-transcript-bar"/);
});

test('StageViewport and StyleLabShowcase isolate <Player /> from 60 Hz frame re-renders and unmount closed drawer tracks', () => {
  const stageSrc = fs.readFileSync(
    path.join(STUDIO_CLIENT_DIR, 'components/StageViewport.tsx'),
    'utf8'
  );
  const styleLabSrc = fs.readFileSync(
    path.join(STUDIO_CLIENT_DIR, 'components/StyleLabShowcase.tsx'),
    'utf8'
  );
  const studioAppSrc = fs.readFileSync(
    path.join(STUDIO_CLIENT_DIR, 'StudioApp.tsx'),
    'utf8'
  );
  const stylesCss = fs.readFileSync(
    path.join(STUDIO_CLIENT_DIR, 'styles.css'),
    'utf8'
  );

  // 1. Both stages disable 60 Hz React displayFrame state above <Player />
  assert.match(stageSrc, /trackDisplayFrame:\s*false/);
  assert.match(styleLabSrc, /trackDisplayFrame:\s*false/);

  // 2. Both stages isolate <Player /> inside a React.memo boundary with constant style ref
  assert.match(stageSrc, /const MemoizedPlayerStage[^=]*=\s*React\.memo/);
  assert.match(stageSrc, /style=\{PLAYER_FILL_STYLE\}/);
  assert.match(styleLabSrc, /const MemoizedStyleLabPlayer[^=]*=\s*React\.memo/);
  assert.match(styleLabSrc, /style=\{PLAYER_FILL_STYLE\}/);

  // 3. ResizeObserver is rAF-coalesced and bails out when dimensions are unchanged
  assert.match(stageSrc, /requestAnimationFrame\(/);
  assert.match(stageSrc, /prev\.w === nextW && prev\.h === nextH/);
  assert.match(styleLabSrc, /requestAnimationFrame\(/);
  assert.match(styleLabSrc, /prev\.w === nextW && prev\.h === nextH/);

  // 4. StudioApp memoizes heavy panes so 500ms measuredFps ticks never cascade into <Player /> or PropsInspector
  assert.match(studioAppSrc, /const MemoStageViewport = React\.memo\(StageViewport\)/);
  assert.match(studioAppSrc, /const MemoStyleLabShowcase = React\.memo\(StyleLabShowcase\)/);
  assert.match(studioAppSrc, /const MemoPropsInspector = React\.memo\(PropsInspector\)/);
  assert.equal(typeof StageViewport, 'function');
  assert.equal(typeof StyleLabShowcase, 'function');
  assert.equal(typeof StudioApp, 'function');

  // 5. Closed drawer does not mount DirectorTimelinePanel / LiveTranscriptBar
  const closedStageHtml = renderToStaticMarkup(
    React.createElement(StageViewport, {
      composition: SAMPLE_COMP,
      inputProps: SAMPLE_COMP.defaultProps,
      overlays: { goldenSafeBox: false, ruleOfThirds: false, safeMargins: false },
      onToggleOverlay: () => {},
    })
  );
  assert.match(closedStageHtml, /class="mp-bottom-drawer\s*"\s+aria-hidden="true"/);
  assert.doesNotMatch(
    closedStageHtml,
    /class="mp-director-timeline"/,
    'DirectorTimelinePanel must stay unmounted while bottom drawer is collapsed'
  );
  assert.doesNotMatch(
    closedStageHtml,
    /class="mp-transcript-bar"/,
    'LiveTranscriptBar must stay unmounted while bottom drawer is collapsed'
  );

  // 6. GPU compositing isolation & transform-driven playhead in styles.css
  assert.match(stylesCss, /\.mp-player-frame\s*\{[^}]*contain:\s*layout paint style/);
  assert.match(stylesCss, /\.mp-player-frame\s*\{[^}]*isolation:\s*isolate/);
  assert.match(stylesCss, /\.mp-bottom-drawer\s*\{[^}]*backdrop-filter:\s*none/);
  assert.match(
    stylesCss,
    /\.mp-dt-playhead\s*\{[^}]*transform:\s*translate3d\(calc\(var\(--mp-playhead-pct,\s*0\)\s*\*\s*1%\),\s*0,\s*0\)/
  );
});

test('editorial overlays snap to transform:none + integer px and strip will-change:transform to prevent multi-worker Chromium subpixel jitter', () => {
  // Pure helper invariants
  assert.equal(snapSettledProgress(0.9991), 1);
  assert.equal(snapSettledProgress(1.0004), 1);
  assert.equal(snapSettledProgress(0.001), 0);
  assert.equal(buildCrispTranslateYTransform(-0.004), 'none');
  assert.equal(buildCrispTranslateYTransform(0.004), 'none');
  assert.equal(buildCrispTranslateYTransform(-15.42), 'translateY(-15px)');
  assert.equal(buildCrispTranslateYTransform(0, true), 'translateY(-50%)');
  assert.equal(
    buildCrispTranslateYTransform(9.63, true),
    'translateY(calc(-50% + 10px))'
  );

  // Sanitizer neutralizes legacy caller willChange + fractional translate3d overrides
  assert.deepEqual(
    sanitizeEditorialOverlayStyle({
      transform: 'translate3d(0, -0.00px, 0)',
      willChange: 'transform',
    }),
    { transform: 'none' }
  );
  assert.deepEqual(
    sanitizeEditorialOverlayStyle({
      transform: 'translate3d(0, 0.00px, 0) scale(1.0000)',
      willChange: 'transform',
    }),
    { transform: 'none' }
  );
  assert.deepEqual(
    sanitizeEditorialOverlayStyle({
      transform: 'translate3d(0, -15.42px, 0)',
      willChange: 'transform',
    }),
    { transform: 'translateY(-15px)' }
  );

  const milestones = [
    { id: 'm1', era: '00:05', label: 'Chill', fromFrame: 0 },
    { id: 'm2', era: 'LIVE', label: 'On Air', fromFrame: 120 },
  ] as const;

  const OverlayHarness: React.FC<{ callerTransform?: string }> = ({
    callerTransform,
  }) =>
    React.createElement(
      StyleProvider,
      { style: 'soft-clay' },
      React.createElement(FloatingEditorialDisplay, {
        eyebrow: '00:05 • STUDIO COUNTDOWN',
        headline: 'Five Seconds to Air',
        subline: 'Chaos backstage. Pure charm on camera.',
        enterFrame: 2,
        style: callerTransform
          ? { transform: callerTransform, willChange: 'transform' }
          : undefined,
      }),
      React.createElement(PaperRibbonTimeline, {
        milestones,
        enterFrame: 3,
        style: callerTransform
          ? { transform: callerTransform, willChange: 'transform' }
          : undefined,
      })
    );

  // Entering frame (f=9): integer pixel translateY only, zero fractional px, zero translate3d, zero will-change
  const htmlEntering = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: OverlayHarness,
      inputProps: { callerTransform: 'translate3d(0, -15.42px, 0)' },
      compositionWidth: 1920,
      compositionHeight: 1080,
      frameToDisplay: 9,
      durationInFrames: 300,
      fps: 60,
    })
  );
  assert.doesNotMatch(htmlEntering, /will-change/i);
  assert.doesNotMatch(htmlEntering, /translate3d/i);
  assert.doesNotMatch(htmlEntering, /translateY\([^)]*\.\d+px\)/);
  assert.match(htmlEntering, /translateY\(-15px\)/);

  // Settled frame (f=200): exact transform:none + opacity:1 + bold width reservation in PaperRibbonTimeline
  const htmlSettled = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: OverlayHarness,
      inputProps: { callerTransform: 'translate3d(0, -0.00px, 0)' },
      compositionWidth: 1920,
      compositionHeight: 1080,
      frameToDisplay: 200,
      durationInFrames: 300,
      fps: 60,
    })
  );
  assert.doesNotMatch(htmlSettled, /will-change/i);
  assert.doesNotMatch(htmlSettled, /translate3d/i);
  assert.match(htmlSettled, /transform:none/);
  assert.match(htmlSettled, /opacity:1(?:;|")/);
  assert.match(htmlSettled, /font-weight:700;visibility:hidden/);
});
