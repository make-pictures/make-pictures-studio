import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useCurrentFrame } from 'remotion';
import { Thumbnail } from '@remotion/player';
import {
  ArtWorldSchema,
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  CINEMATIC_SPRINGS,
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  DIRECTOR_PACING_BUDGET,
  OpticalCrossDissolve,
  SceneSubViewDissolve,
  ScenicBackdropLayers,
  StageLightingRig,
  StylePresetSchema,
  StyleProvider,
  computeContinuousSceneWindows,
  computeSceneTimingFromVoiceover,
  getTactileSurfaceStyle,
  interpolateStylePresets,
  resolveArtWorld,
  useFocalStagger,
  type ArtWorld,
  type ContinuousSceneSpec,
} from '../../core/src/index';
import { introspectZodObject } from '../../studio/src/client/index';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('ArtWorldSchema, BUILT_IN_STYLES artWorld mapping, fallbacks, and 7-section StylePresetSchema stability', () => {
  assert.deepEqual(ArtWorldSchema.options, [
    'atelier',
    'illustrative',
    'editorial-gallery',
  ]);
  assert.throws(() => ArtWorldSchema.parse('unknown-world'));

  const expectedWorlds: Record<(typeof BUILT_IN_STYLE_IDS)[number], ArtWorld> = {
    'minimal-product': 'atelier',
    'cyber-telemetry': 'atelier',
    'retro-pc': 'atelier',
    'glass-studio': 'atelier',
    'tactile-craft': 'illustrative',
    'sketch-notebook': 'illustrative',
    'soft-clay': 'illustrative',
    'editorial-press': 'editorial-gallery',
    'archival-chronicle': 'editorial-gallery',
    'brutalist-poster': 'editorial-gallery',
  };

  for (const id of BUILT_IN_STYLE_IDS) {
    const preset = BUILT_IN_STYLES[id];
    const parsed = StylePresetSchema.parse(preset);
    assert.equal(parsed.artWorld, expectedWorlds[id], `Expected ${id}.artWorld`);
    assert.equal(resolveArtWorld(preset), expectedWorlds[id]);
  }

  // Calibrated minimal-product studio canvas contrast
  assert.equal(BUILT_IN_STYLES['minimal-product'].palette.bgCanvas, '#F1F5F9');
  assert.equal(BUILT_IN_STYLES['minimal-product'].palette.bgSurface, '#FFFFFF');
  assert.equal(BUILT_IN_STYLES['minimal-product'].palette.bgElevated, '#E2E8F0');

  // Heuristic fallbacks when artWorld is omitted on custom styles
  const baseCustom = {
    ...BUILT_IN_STYLES['minimal-product'],
    id: 'custom-brand-v1',
    artWorld: undefined,
  };
  assert.equal(
    resolveArtWorld({
      ...baseCustom,
      surface: { ...baseCustom.surface, cardTreatment: 'minimal-clean' },
    }),
    'atelier'
  );
  assert.equal(
    resolveArtWorld({
      ...baseCustom,
      surface: { ...baseCustom.surface, cardTreatment: 'glass-glow' },
    }),
    'atelier'
  );
  assert.equal(
    resolveArtWorld({
      ...baseCustom,
      surface: { ...baseCustom.surface, cardTreatment: 'tactile-cutout' },
    }),
    'illustrative'
  );
  assert.equal(
    resolveArtWorld({
      ...baseCustom,
      surface: { ...baseCustom.surface, cardTreatment: 'editorial-ink' },
    }),
    'editorial-gallery'
  );
  assert.equal(
    resolveArtWorld({
      ...baseCustom,
      surface: { ...baseCustom.surface, cardTreatment: 'brutalist-hard' },
    }),
    'editorial-gallery'
  );

  // Explicit artWorld overrides surface heuristics
  assert.equal(
    resolveArtWorld({
      ...baseCustom,
      artWorld: 'illustrative',
      surface: { ...baseCustom.surface, cardTreatment: 'minimal-clean' },
    }),
    'illustrative'
  );

  // CRITICAL: Preserve exact 7 Polish section titles in StylePresetSchema
  const sections = introspectZodObject(
    StylePresetSchema,
    BUILT_IN_STYLES['editorial-press'] as unknown as Record<string, unknown>
  );
  assert.deepEqual(
    sections.map((s) => s.title),
    [
      'Informacje',
      'Paleta kolorów',
      'Typografia',
      'Powierzchnia & Tło',
      'Fizyka ruchu',
      'Optyka & Światło',
      'Domyślne Audio',
    ]
  );
  const infoFields = sections.find((s) => s.title === 'Informacje')?.fields ?? [];
  const artWorldField = infoFields.find((f) => f.key === 'artWorld');
  assert.ok(artWorldField, 'Expected artWorld field in Informacje section');
  assert.equal(artWorldField.label, 'Świat artystyczny');
  assert.equal(artWorldField.kind, 'enum');
});

test('interpolateStylePresets smoothly morphs palette, surface, motion & optics at 60 FPS and switches discrete enums at t >= 0.5', () => {
  const fromStyle = BUILT_IN_STYLES['minimal-product'];
  const toStyle = BUILT_IN_STYLES['cyber-telemetry'];

  assert.deepEqual(interpolateStylePresets(fromStyle, toStyle, 0), fromStyle);
  assert.deepEqual(interpolateStylePresets(fromStyle, toStyle, -0.25), fromStyle);
  assert.deepEqual(interpolateStylePresets(fromStyle, toStyle, 1), toStyle);
  assert.deepEqual(interpolateStylePresets(fromStyle, toStyle, 1.4), toStyle);

  for (const t of [0, 0.15, 0.35, 0.49, 0.5, 0.75, 1]) {
    const morphed = interpolateStylePresets(fromStyle, toStyle, t);
    const parsed = StylePresetSchema.parse(morphed);
    assert.ok(parsed.optics);
    // Opaque hex endpoints stay 6-digit #RRGGBB so `${palette.accentPrimary}26` suffixes stay valid CSS
    assert.match(parsed.palette.bgCanvas, /^#[0-9A-Fa-f]{6}$/);
    assert.match(parsed.palette.accentPrimary, /^#[0-9A-Fa-f]{6}$/);
  }

  const beforeHalf = interpolateStylePresets(fromStyle, toStyle, 0.49);
  const atHalf = interpolateStylePresets(fromStyle, toStyle, 0.5);

  // Discrete switches occur cleanly at t >= 0.5
  assert.equal(beforeHalf.typography.displayFont, 'Plus Jakarta Sans');
  assert.equal(atHalf.typography.displayFont, 'Space Grotesk');
  assert.equal(beforeHalf.optics?.lightingRig, 'studio-macro');
  assert.equal(atHalf.optics?.lightingRig, 'darkroom-halation');
  assert.equal(beforeHalf.surface.isDark, false);
  assert.equal(atHalf.surface.isDark, true);

  // Continuous smoothstep midpoint values
  assert.notEqual(atHalf.palette.bgCanvas, fromStyle.palette.bgCanvas);
  assert.notEqual(atHalf.palette.bgCanvas, toStyle.palette.bgCanvas);
  assert.ok(Math.abs(atHalf.surface.radiusScale - (1 + 0.85) / 2) < 1e-3);
  assert.ok(Math.abs((atHalf.optics?.halation ?? 0) - (0.08 + 0.58) / 2) < 1e-3);
  assert.ok(Math.abs((atHalf.optics?.aperture ?? 0) - (0.36 + 0.5) / 2) < 1e-3);
  assert.ok(Math.abs((atHalf.optics?.lightAngleDeg ?? 0) - (-20 + -24) / 2) < 1e-3);

  // Supports #RGB, #RRGGBBAA, and rgba(...) color formats safely
  const customRgbaA = StylePresetSchema.parse({
    ...fromStyle,
    id: 'rgba-from',
    palette: {
      ...fromStyle.palette,
      bgCanvas: '#FFF',
      bgSurface: 'rgba(255, 255, 255, 0.4)',
      accentPrimary: '#FF000080',
    },
  });
  const customRgbaB = StylePresetSchema.parse({
    ...BUILT_IN_STYLES['editorial-press'],
    id: 'rgba-to',
    palette: {
      ...BUILT_IN_STYLES['editorial-press'].palette,
      bgCanvas: '#000',
      bgSurface: 'rgba(0, 0, 0, 0.8)',
      accentPrimary: '#0000FF80',
    },
  });
  const midRgba = StylePresetSchema.parse(
    interpolateStylePresets(customRgbaA, customRgbaB, 0.5)
  );
  assert.equal(beforeHalf.artWorld, 'atelier');
  assert.equal(midRgba.artWorld, 'editorial-gallery');
  assert.match(midRgba.palette.bgSurface, /^rgba\(/);
  assert.match(midRgba.palette.accentPrimary, /^rgba\(/);
});

test('DIRECTOR_PACING_BUDGET, computeSceneTimingFromVoiceover, SceneSubViewDissolve, CINEMATIC_SPRINGS, and useFocalStagger enforce calm single-focus timing', () => {
  assert.deepEqual(DIRECTOR_PACING_BUDGET, {
    minSceneDurationFrames: 270,
    preSpeechSettleFrames: 42,
    minPreSpeechSettleFrames: 36,
    postSpeechHoldFrames: 96,
    minPostSpeechHoldFrames: 90,
    finalScenePostHoldFrames: 144,
    minFinalScenePostHoldFrames: 132,
    maxSubViewsPerScene: 2,
    defaultCrossDissolveFrames: 54,
    minSettleHoldFrames: 45,
    maxWordsPerSecond: 2.8,
  });

  // Middle scene timing: 42 + ceil(3.5 * 60) + 96 = 348 frames
  const midTiming = computeSceneTimingFromVoiceover(3.5);
  assert.deepEqual(midTiming, {
    voiceoverStartFrame: 42,
    voiceoverDurationFrames: 210,
    voiceoverEndFrame: 252,
    postHoldFrames: 96,
    durationInFrames: 348,
  });

  // Final scene timing: 42 + ceil(3.5 * 60) + 144 = 396 frames
  const finalTiming = computeSceneTimingFromVoiceover(3.5, { isFinalScene: true });
  assert.deepEqual(finalTiming, {
    voiceoverStartFrame: 42,
    voiceoverDurationFrames: 210,
    voiceoverEndFrame: 252,
    postHoldFrames: 144,
    durationInFrames: 396,
  });

  // Short voiceover clamps to 270f (4.5s) minimum scene duration and expands postHoldFrames
  const shortTiming = computeSceneTimingFromVoiceover(1.0);
  assert.deepEqual(shortTiming, {
    voiceoverStartFrame: 42,
    voiceoverDurationFrames: 60,
    voiceoverEndFrame: 102,
    postHoldFrames: 168,
    durationInFrames: 270,
  });

  // Fractional seconds ceil cleanly so final consonants never clip
  const fracTiming = computeSceneTimingFromVoiceover(4.01);
  assert.equal(fracTiming.voiceoverDurationFrames, 241);
  assert.equal(fracTiming.durationInFrames, 42 + 241 + 96);

  // SceneSubViewDissolve: Clean Frame 0, >= 48f clamp, A -> B soft crossfade
  const SubViewProbe: React.FC<{ curve?: 'sin' | 'cubic'; dissolveFrames?: number }> = ({
    curve,
    dissolveFrames,
  }) =>
    React.createElement(SceneSubViewDissolve, {
      firstView: React.createElement('div', { 'data-subview': 'A' }, 'Widok A'),
      secondView: React.createElement('div', { 'data-subview': 'B' }, 'Widok B'),
      switchAtFrame: 180,
      dissolveFrames,
      curve,
    });

  const subF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: () => React.createElement(SubViewProbe),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 360,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(subF0, /Widok A|Widok B/);

  // Even when dissolveFrames=20 (< 48) is passed, span clamps to 48 ([156..204])
  const subClampedMid = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: () => React.createElement(SubViewProbe, { dissolveFrames: 20, curve: 'cubic' }),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 360,
      fps: 60,
      frameToDisplay: 160,
    })
  );
  assert.match(subClampedMid, /Widok A/);
  assert.match(subClampedMid, /Widok B/);

  const subEarly = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: () => React.createElement(SubViewProbe),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 360,
      fps: 60,
      frameToDisplay: 120,
    })
  );
  assert.match(subEarly, /Widok A/);
  assert.doesNotMatch(subEarly, /Widok B/);

  const subLate = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: () => React.createElement(SubViewProbe),
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 360,
      fps: 60,
      frameToDisplay: 240,
    })
  );
  assert.doesNotMatch(subLate, /Widok A/);
  assert.match(subLate, /Widok B/);

  assert.deepEqual(CINEMATIC_SPRINGS, {
    entrance: { mass: 1.45, damping: 200, stiffness: 58 },
    drift: { mass: 1.8, damping: 200, stiffness: 34 },
    emphasis: { mass: 1.25, damping: 200, stiffness: 72 },
  });

  // Clean Frame 0 & startFrame >= 2 enforcement even when startFrame: 0 is requested
  assert.deepEqual(useFocalStagger(0, 60, { startFrame: 0 }), {
    lead: 0,
    support: 0,
    ambient: 0,
  });
  assert.deepEqual(useFocalStagger(1, 60, { startFrame: 0 }), {
    lead: 0,
    support: 0,
    ambient: 0,
  });

  const at20 = useFocalStagger(20, 60);
  assert.ok(at20.lead > 0.25, `Expected lead > 0.25 at f=20, got ${at20.lead}`);
  assert.equal(at20.support, 0, 'Support must wait >= 22 frames after lead start');
  assert.equal(at20.ambient, 0, 'Ambient must wait >= 40 frames after lead start');

  const at32 = useFocalStagger(32, 60);
  assert.ok(at32.lead > at32.support);
  assert.ok(at32.support > 0);
  assert.equal(at32.ambient, 0);

  const at56 = useFocalStagger(56, 60);
  assert.ok(at56.lead > at56.support);
  assert.ok(at56.support > at56.ambient);
  assert.ok(at56.ambient > 0);

  // Monotonic critically damped convergence without overshoot
  let prevLead = 0;
  for (let f = 0; f <= 180; f++) {
    const s = useFocalStagger(f, 60);
    assert.ok(s.lead >= prevLead - 1e-6 && s.lead <= 1.0001);
    prevLead = s.lead;
  }
  assert.ok(prevLead > 0.99);
});

test('computeContinuousSceneWindows and ContinuousSceneFlow guarantee <= 1 WebGL context per frame and optical cross-dissolve continuity', () => {
  // Case 1: 2D -> 2D -> 3D -> 3D -> 2D
  const specs = [
    { id: 's1-editorial', durationInFrames: 300, usesThree: false },
    { id: 's2-atelier', durationInFrames: 360, usesThree: false },
    { id: 's3a-diorama', durationInFrames: 330, usesThree: true },
    { id: 's3b-isometric', durationInFrames: 360, usesThree: true },
    { id: 's4-finale', durationInFrames: 300, usesThree: false },
  ];
  const totalFrames = specs.reduce((acc, s) => acc + s.durationInFrames, 0);
  const windows = computeContinuousSceneWindows(specs, 54);

  assert.equal(windows.length, 5);
  // Boundary s1(0..300) -> s2(300..660): 2D <-> 2D overlaps [273, 327)
  assert.equal(windows[0]!.nominalStart, 0);
  assert.equal(windows[0]!.nominalEnd, 300);
  assert.equal(windows[0]!.mountFrom, 0);
  assert.equal(windows[0]!.mountDuration, 327);
  assert.equal(windows[0]!.useVeilAtStart, false);
  assert.equal(windows[0]!.useVeilAtEnd, false);

  assert.equal(windows[1]!.nominalStart, 300);
  assert.equal(windows[1]!.nominalEnd, 660);
  assert.equal(windows[1]!.mountFrom, 273);
  assert.equal(windows[1]!.mountDuration, 660 + 27 - 273);

  // Boundary s3a(660..990, 3D) -> s3b(990..1350, 3D): ZERO mount overlap, luminous veil enabled!
  assert.equal(windows[2]!.nominalStart, 660);
  assert.equal(windows[2]!.nominalEnd, 990);
  assert.equal(windows[2]!.mountFrom + windows[2]!.mountDuration, 990);
  assert.equal(windows[2]!.useVeilAtEnd, true);

  assert.equal(windows[3]!.nominalStart, 990);
  assert.equal(windows[3]!.nominalEnd, 1350);
  assert.equal(windows[3]!.mountFrom, 990);
  assert.equal(windows[3]!.useVeilAtStart, true);

  // Exhaustive frame-by-frame WebGL budget audit across 0..totalFrames - 1
  for (let f = 0; f < totalFrames; f++) {
    const activeThree = windows.filter(
      (w) => w.usesThree && f >= w.mountFrom && f < w.mountFrom + w.mountDuration
    );
    assert.ok(
      activeThree.length <= 1,
      `Frame ${f} mounted ${activeThree.length} WebGL scenes: ${activeThree.map((w) => w.id).join(', ')}`
    );
  }

  // Case 2: Short 2D bridge between two 3D scenes [3D, 2D(40f), 3D] still never overlaps WebGL
  const tightBridge = [
    { id: 'three-a', durationInFrames: 120, usesThree: true },
    { id: 'bridge-2d', durationInFrames: 40, usesThree: false },
    { id: 'three-b', durationInFrames: 120, usesThree: true },
  ];
  const tightWin = computeContinuousSceneWindows(tightBridge, 54);
  for (let f = 0; f < 280; f++) {
    const activeThree = tightWin.filter(
      (w) => w.usesThree && f >= w.mountFrom && f < w.mountFrom + w.mountDuration
    );
    assert.ok(activeThree.length <= 1, `Tight bridge frame ${f} overlapped 3D scenes`);
  }

  // Component render checks via Remotion Thumbnail
  const LocalFrameProbe: React.FC<{ tag: string }> = ({ tag }) => {
    const localFrame = useCurrentFrame();
    if (localFrame <= 0) {
      return React.createElement('div', { 'data-clean-zero': tag });
    }
    return React.createElement('div', { 'data-scene-tag': `${tag}:f${localFrame}` }, tag);
  };

  const flowScenes: ContinuousSceneSpec[] = [
    {
      id: 'flow-2d-a',
      durationInFrames: 300,
      usesThree: false,
      render: () => React.createElement(LocalFrameProbe, { tag: 'A2D' }),
    },
    {
      id: 'flow-3d-b',
      durationInFrames: 300,
      usesThree: true,
      render: () => React.createElement(LocalFrameProbe, { tag: 'B3D' }),
    },
    {
      id: 'flow-3d-c',
      durationInFrames: 300,
      usesThree: true,
      veilColor: '#F5EFE6',
      render: () => React.createElement(LocalFrameProbe, { tag: 'C3D' }),
    },
  ];

  const FlowComp: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'minimal-product', renderBackdrop: true },
      React.createElement(ContinuousSceneFlow, {
        scenes: flowScenes,
        crossDissolveFrames: 54,
      })
    );

  // Frame 0: Clean Frame 0 (only A2D clean zero, filter:none, no veil)
  const htmlF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FlowComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 900,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.match(htmlF0, /data-clean-zero="A2D"/);
  assert.doesNotMatch(htmlF0, /B3D|C3D/);
  assert.doesNotMatch(htmlF0, /filter:blur\(/);
  assert.doesNotMatch(htmlF0, /data-optical-veil/);

  // Settled frame 120: only A2D, sharp filter:none, scale(1)
  const htmlF120 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FlowComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 900,
      fps: 60,
      frameToDisplay: 120,
    })
  );
  assert.match(htmlF120, /data-scene-tag="A2D:f120"/);
  assert.doesNotMatch(htmlF120, /B3D/);
  assert.doesNotMatch(htmlF120, /filter:blur\(/);

  // Boundary 300 (2D -> 3D overlap midpoint): both A2D and B3D mounted with optical blur
  const htmlF300 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FlowComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 900,
      fps: 60,
      frameToDisplay: 300,
    })
  );
  assert.match(htmlF300, /A2D:f300/);
  assert.match(htmlF300, /B3D:f27/);
  assert.match(htmlF300, /filter:blur\(/);

  // Boundary 600 (3D -> 3D seam): ONLY C3D mounted (B3D already unmounted!), covered by optical veil
  const htmlF599 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FlowComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 900,
      fps: 60,
      frameToDisplay: 599,
    })
  );
  assert.match(htmlF599, /B3D/);
  assert.doesNotMatch(htmlF599, /C3D/);
  assert.match(htmlF599, /data-optical-veil=/);

  const htmlF600 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FlowComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 900,
      fps: 60,
      frameToDisplay: 600,
    })
  );
  assert.doesNotMatch(htmlF600, /B3D/);
  assert.match(htmlF600, /data-clean-zero="C3D"|C3D/);
  assert.match(htmlF600, /data-optical-veil=/);

  // Standalone OpticalCrossDissolve verification (progress-driven & frame-driven)
  const standaloneSharp = renderToStaticMarkup(
    React.createElement(
      OpticalCrossDissolve,
      { enterProgress: 1, exitProgress: 0 },
      React.createElement('span', null, 'Crisp card')
    )
  );
  assert.match(standaloneSharp, /filter:none/);
  assert.match(standaloneSharp, /transform:scale\(1\)/);
  assert.match(standaloneSharp, /Crisp card/);

  const standaloneEnterStart = renderToStaticMarkup(
    React.createElement(
      OpticalCrossDissolve,
      { enterProgress: 0, exitProgress: 0 },
      React.createElement('span', null, 'Entering')
    )
  );
  assert.match(standaloneEnterStart, /transform:scale\(0\.9880\)/);
  assert.match(standaloneEnterStart, /opacity:0(?:[;"']|$)/);

  const standaloneExitEnd = renderToStaticMarkup(
    React.createElement(
      OpticalCrossDissolve,
      { enterProgress: 1, exitProgress: 1 },
      React.createElement('span', null, 'Exiting')
    )
  );
  assert.match(standaloneExitEnd, /transform:scale\(1\.0160\)/);
  assert.match(standaloneExitEnd, /opacity:0(?:[;"']|$)/);

  const TimedComp: React.FC = () =>
    React.createElement(
      OpticalCrossDissolve,
      { enterFromFrame: 10, exitFromFrame: 70, durationInFrames: 20 },
      React.createElement('div', { 'data-timed-layer': 'yes' })
    );
  const timedBefore = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: TimedComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 5,
    })
  );
  assert.doesNotMatch(timedBefore, /data-timed-layer/);
  const timedMid = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: TimedComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 20,
    })
  );
  assert.match(timedMid, /data-timed-layer="yes"/);
  assert.match(timedMid, /filter:blur\(/);
  const timedAfter = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: TimedComp,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 92,
    })
  );
  assert.doesNotMatch(timedAfter, /data-timed-layer/);
});

test('ScenicBackdropLayers, ClippedSurfaceChrome, tactileSurface, and StageLightingRig studio-macro contrast & Clean Frame 0', () => {
  // 1. ScenicBackdropLayers across all 3 ArtWorlds
  for (const [styleId, world] of [
    ['minimal-product', 'atelier'],
    ['tactile-craft', 'illustrative'],
    ['editorial-press', 'editorial-gallery'],
  ] as const) {
    const ScenicComp: React.FC = () =>
      React.createElement(
        StyleProvider,
        { style: styleId },
        React.createElement(StageLightingRig),
        React.createElement(ScenicBackdropLayers, { seed: `test-${styleId}` })
      );

    const f0 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: ScenicComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 0,
      })
    );
    assert.doesNotMatch(f0, /data-scenic-backdrop/);
    assert.doesNotMatch(f0, /data-lighting-rig/);

    const f36 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: ScenicComp,
        compositionWidth: 1920,
        compositionHeight: 1080,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 36,
      })
    );
    assert.match(f36, new RegExp(`data-scenic-backdrop="${world}"`));
    if (styleId === 'minimal-product') {
      assert.match(f36, /data-cyclorama-horizon="true"/);
    }
  }

  // 2. ClippedSurfaceChrome geometry contract
  const chromeMarkup = renderToStaticMarkup(
    React.createElement(
      StyleProvider,
      { style: 'minimal-product' },
      React.createElement(
        'div',
        { style: { position: 'relative', borderRadius: 22, overflow: 'visible' } },
        React.createElement(
          ClippedSurfaceChrome,
          {
            topBarHeight: 4,
            topBarColor: '#2563EB',
            specularRim: true,
            tintGradient: 'linear-gradient(180deg, rgba(255,255,255,0.5), transparent)',
          },
          React.createElement('span', { 'data-inner-deco': 'true' })
        )
      )
    )
  );
  assert.match(chromeMarkup, /position:absolute/);
  assert.match(chromeMarkup, /inset:0/);
  assert.match(chromeMarkup, /border-radius:inherit/);
  assert.match(chromeMarkup, /overflow:hidden/);
  assert.match(chromeMarkup, /pointer-events:none/);
  assert.match(chromeMarkup, /left:14px/);
  assert.match(chromeMarkup, /right:14px/);
  assert.match(chromeMarkup, /height:2\.5px/);
  assert.match(chromeMarkup, /linear-gradient\(90deg, transparent 0%/);
  assert.match(chromeMarkup, /data-inner-deco="true"/);

  const brutalistChromeMarkup = renderToStaticMarkup(
    React.createElement(
      StyleProvider,
      { style: 'brutalist-poster' },
      React.createElement(ClippedSurfaceChrome, {
        topBarHeight: 4,
        topBarColor: '#FF2A85',
      })
    )
  );
  assert.match(brutalistChromeMarkup, /left:0;right:0;height:4px/);

  // 3. Light-mode tactileSurface crisp studio figure-ground contrast
  const lightSurface = getTactileSurfaceStyle(BUILT_IN_STYLES['minimal-product'], {
    elevation: 'resting',
  });
  assert.match(
    String(lightSurface.boxShadow),
    /inset 0 1px 0 rgba\(\s*255,\s*255,\s*255,\s*0\.92\s*\)/
  );
  // Multi-layer ambient-occlusion + contact + cast shadow (>= 3 layers besides inset)
  assert.ok(String(lightSurface.boxShadow).split('rgba(').length >= 4);

  // 4. Determinism & Three.js isolation source audit in packages/core/src/director/ & interpolate.ts
  const directorDir = path.resolve(__dirname, '../../core/src/director');
  for (const entry of fs.readdirSync(directorDir)) {
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue;
    const src = fs.readFileSync(path.join(directorDir, entry), 'utf8');
    assert.doesNotMatch(src, /Math\.random\s*\(/, `Forbidden Math.random in ${entry}`);
    assert.doesNotMatch(
      src,
      /@react-three\/fiber|from\s+['"]three['"]/,
      `Forbidden 3D import in ${entry}`
    );
  }
  const interpSrc = fs.readFileSync(
    path.resolve(__dirname, '../../core/src/style/interpolate.ts'),
    'utf8'
  );
  assert.doesNotMatch(interpSrc, /Math\.random\s*\(/);
});
