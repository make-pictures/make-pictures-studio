import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import {
  BUILT_IN_STYLES,
  StyleProvider,
  evaluateDirectorCamera3D,
  resolveStyleMaterial3D,
  type StyleMaterial3DFinish,
  type StyleStudioHdrPreset,
} from '../../core/src/index';
import * as kitsRoot from '../../kits/src/index';
import {
  ClayCharacter3D,
  PodcastStudioSet3D,
  StudioHdrRig3D,
  computeClayBlinkProgress,
  computePodcastStudioLayout,
  resolvePhysicalFinishProps,
  resolveStudioHdrRigSpec,
} from '../../kits/src/isometric-3d';
import { projectPoint } from './_helpers/camera-projection';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('exports StudioHdrRig3D, ClayCharacter3D, PodcastStudioSet3D, and pure helpers from @make-pictures/kits', () => {
  assert.equal(typeof StudioHdrRig3D, 'function');
  assert.equal(typeof ClayCharacter3D, 'function');
  assert.equal(typeof PodcastStudioSet3D, 'function');
  assert.equal(typeof computeClayBlinkProgress, 'function');
  assert.equal(typeof resolvePhysicalFinishProps, 'function');
  assert.equal(typeof resolveStudioHdrRigSpec, 'function');
  assert.equal(typeof computePodcastStudioLayout, 'function');

  assert.equal(kitsRoot.StudioHdrRig3D, StudioHdrRig3D);
  assert.equal(kitsRoot.ClayCharacter3D, ClayCharacter3D);
  assert.equal(kitsRoot.PodcastStudioSet3D, PodcastStudioSet3D);
  assert.equal(kitsRoot.computeClayBlinkProgress, computeClayBlinkProgress);
  assert.equal(kitsRoot.resolvePhysicalFinishProps, resolvePhysicalFinishProps);
  assert.equal(kitsRoot.resolveStudioHdrRigSpec, resolveStudioHdrRigSpec);
  assert.equal(kitsRoot.computePodcastStudioLayout, computePodcastStudioLayout);
});

test('computeClayBlinkProgress is deterministic, returns 0 on frame <= 0, and blinks every ~3.2s with seeded phase offset', () => {
  assert.equal(computeClayBlinkProgress(0, 60, 'host-a'), 0);
  assert.equal(computeClayBlinkProgress(-10, 60, 'host-a'), 0);
  assert.equal(computeClayBlinkProgress(0, 60, 42), 0);

  const fps = 60;
  const periodFrames = Math.round(3.2 * fps); // 192 frames

  const seriesA1 = Array.from({ length: periodFrames * 2 }, (_, f) =>
    computeClayBlinkProgress(f, fps, 'host-left')
  );
  const seriesA2 = Array.from({ length: periodFrames * 2 }, (_, f) =>
    computeClayBlinkProgress(f, fps, 'host-left')
  );
  assert.deepEqual(seriesA1, seriesA2, 'Expected 100% deterministic blink series');

  for (const val of seriesA1) {
    assert.ok(val >= 0 && val <= 1, `Blink value ${val} out of [0, 1]`);
  }

  // First 3.2s cycle and second 3.2s cycle both contain an open baseline (0) and full blink (>= 0.95)
  const firstCycle = seriesA1.slice(1, periodFrames + 1);
  const secondCycle = seriesA1.slice(periodFrames + 1, periodFrames * 2);
  assert.ok(
    Math.max(...firstCycle) >= 0.95,
    'Expected full blink closure in first 3.2s cycle'
  );
  assert.ok(
    Math.max(...secondCycle) >= 0.95,
    'Expected full blink closure in second 3.2s cycle'
  );
  const openCount = firstCycle.filter((v) => v === 0).length;
  assert.ok(
    openCount >= periodFrames - 20,
    `Expected eyes open for most of the 3.2s cycle (got ${openCount}/${periodFrames})`
  );

  // Different seeds must produce different peak blink frames
  const seriesB = Array.from({ length: periodFrames }, (_, f) =>
    computeClayBlinkProgress(f + 1, fps, 'host-right')
  );
  const peakA = firstCycle.indexOf(Math.max(...firstCycle));
  const peakB = seriesB.indexOf(Math.max(...seriesB));
  assert.notEqual(peakA, peakB, 'Different seeds must desynchronize blink phase');
});

test('resolvePhysicalFinishProps maps all 4 StyleMaterial3DFinish presets accurately', () => {
  const finishes: StyleMaterial3DFinish[] = [
    'soft-clay',
    'frosted-glass',
    'retro-voxel',
    'matte-ceramic',
  ];

  for (const finish of finishes) {
    const props = resolvePhysicalFinishProps(finish);
    assert.equal(typeof props.roughness, 'number');
    assert.equal(typeof props.metalness, 'number');
    assert.equal(typeof props.clearcoat, 'number');
    assert.equal(typeof props.clearcoatRoughness, 'number');
    assert.equal(typeof props.sheen, 'number');
    assert.equal(typeof props.transmission, 'number');
    assert.equal(typeof props.ior, 'number');
    assert.ok(props.roughness >= 0 && props.roughness <= 1);
    assert.ok(props.ior >= 1.0 && props.ior <= 2.4);
  }

  const clay = resolvePhysicalFinishProps(
    resolveStyleMaterial3D(BUILT_IN_STYLES['soft-clay']).finish
  );
  assert.equal(clay.roughness, 0.52);
  assert.equal(clay.clearcoat, 0.16);
  assert.equal(clay.clearcoatRoughness, 0.55);
  assert.equal(clay.sheen, 0.35);
  assert.equal(clay.transmission, 0);

  const glass = resolvePhysicalFinishProps(
    resolveStyleMaterial3D(BUILT_IN_STYLES['glass-studio']).finish
  );
  assert.ok(glass.clearcoat >= 0.75);
  assert.equal(glass.transmission, 0);
  assert.ok(glass.roughness <= 0.25);

  const voxel = resolvePhysicalFinishProps(
    resolveStyleMaterial3D(BUILT_IN_STYLES['retro-pc']).finish
  );
  assert.ok(voxel.roughness >= 0.25 && voxel.roughness <= 0.45);
  assert.equal(voxel.transmission, 0);

  const ceramic = resolvePhysicalFinishProps('matte-ceramic');
  assert.ok(ceramic.roughness >= 0.6);
  assert.equal(ceramic.transmission, 0);
});

test('resolveStudioHdrRigSpec configures rich offline Lightformer panels for warm-softbox, clean-atelier, and neon-grid', () => {
  const presets: StyleStudioHdrPreset[] = [
    'warm-softbox',
    'clean-atelier',
    'neon-grid',
  ];

  for (const preset of presets) {
    const spec = resolveStudioHdrRigSpec(preset, 1);
    assert.equal(spec.preset, preset);
    assert.ok(
      spec.lightformers.length >= 4,
      `Expected >= 4 Lightformer panels for ${preset}`
    );
    assert.equal(spec.directionalPosition.length, 3);
    assert.ok(spec.directionalIntensity > 0);
    assert.ok(spec.hemiIntensity > 0);
  }

  const warm = resolveStudioHdrRigSpec('warm-softbox', 1);
  const warmColors = warm.lightformers.map((p) => p.color.toUpperCase());
  assert.ok(warmColors.includes('#FFF4E4'));
  assert.ok(warmColors.includes('#FFE0B5'));

  const scaled = resolveStudioHdrRigSpec('warm-softbox', 1.5);
  assert.ok(scaled.directionalIntensity > warm.directionalIntensity);
});

test('StudioHdrRig3D, ClayCharacter3D, and PodcastStudioSet3D obey offline IBL, Clean Frame 0, RoundedBox, and determinism rules', () => {
  const hdrSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/StudioHdrRig3D.tsx'),
    'utf8'
  );
  const claySrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/ClayCharacter3D.tsx'),
    'utf8'
  );
  const studioSrc = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../kits/src/isometric-3d/PodcastStudioSet3D.tsx'
    ),
    'utf8'
  );

  for (const [name, src] of [
    ['StudioHdrRig3D.tsx', hdrSrc],
    ['ClayCharacter3D.tsx', claySrc],
    ['PodcastStudioSet3D.tsx', studioSrc],
  ] as const) {
    assert.doesNotMatch(
      src,
      /Math\.random\s*\(/,
      `${name} must never call Math.random()`
    );
    assert.doesNotMatch(
      src,
      /\buseRef\b/,
      `${name} must never use cross-frame mutable useRef`
    );
    assert.match(
      src,
      /if\s*\(\s*frame\s*<=\s*0\b/,
      `${name} must enforce Clean Frame 0 guard`
    );
  }

  // Offline hermetic IBL invariants on StudioHdrRig3D
  assert.match(hdrSrc, /<Environment\b/);
  assert.match(hdrSrc, /resolution=\{256\}/);
  assert.match(hdrSrc, /frames=\{1\}/);
  assert.match(hdrSrc, /<Lightformer\b/);
  assert.match(hdrSrc, /<ContactShadowDisc3D\b/);
  assert.doesNotMatch(hdrSrc, /<ContactShadows\b/);
  assert.match(hdrSrc, /shadow-mapSize=\{\[1024,\s*1024\]\}/);
  assert.match(hdrSrc, /shadow-bias=\{-0\.0004\}/);
  assert.match(hdrSrc, /<hemisphereLight\b/);
  assert.doesNotMatch(
    hdrSrc,
    /<Environment[^>]*\b(preset|files)\s*=/,
    'StudioHdrRig3D must NEVER pass preset= or files= to <Environment>'
  );
  assert.doesNotMatch(
    hdrSrc,
    /https?:\/\/|\.hdr\b|\.exr\b/i,
    'StudioHdrRig3D must contain zero remote HDR/EXR URLs'
  );

  // ClayCharacter3D craft & animation invariants
  assert.match(claySrc, /<meshPhysicalMaterial\b/);
  assert.match(claySrc, /<RoundedBox\b/);
  assert.match(claySrc, /talkBounce\s*=\s*0/);
  assert.doesNotMatch(
    claySrc,
    /<boxGeometry\b/,
    'ClayCharacter3D must use RoundedBox / curved primitives instead of sharp boxGeometry'
  );

  const clayFreqs = [...claySrc.matchAll(/frame\s*\*\s*(\d*\.?\d+)/g)].map(
    (m) => Number(m[1])
  );
  assert.ok(clayFreqs.length >= 2);
  for (const freq of clayFreqs) {
    assert.ok(
      freq > 0 && freq <= 0.045,
      `Expected ClayCharacter3D angular frequency ${freq} <= 0.045 rad/frame`
    );
  }

  // PodcastStudioSet3D RoundedBox bevel invariant (zero sharp 90° boxGeometry)
  assert.match(studioSrc, /<RoundedBox\b/);
  assert.match(studioSrc, /smoothness=\{4\}/);
  assert.match(studioSrc, /<pointLight\b/);
  assert.doesNotMatch(
    studioSrc,
    /<boxGeometry\b/,
    'PodcastStudioSet3D must be built without sharp 90-degree boxGeometry'
  );

  // Runtime Clean Frame 0 verification via Thumbnail + renderToStaticMarkup
  const FrameZeroAllProbe: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'soft-clay', renderBackdrop: false },
      React.createElement(StudioHdrRig3D, { preset: 'warm-softbox' }),
      React.createElement(
        PodcastStudioSet3D,
        { compactVertical: false, onAirActive: true },
        React.createElement(ClayCharacter3D, {
          position: [-1.2, 0, 0.14],
          accessory: 'headphones',
          seated: true,
          speakingWeight: 1,
          speechEnergy: 0.6,
        })
      )
    );

  const markupF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FrameZeroAllProbe,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 120,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(markupF0, /<group|<mesh|podcast-studio-set-3d|clay-character-3d/);

  // Active frame SSR smoke check across accessories & seated/standing modes
  const ActiveSceneProbe: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'soft-clay', renderBackdrop: false },
      React.createElement(
        PodcastStudioSet3D,
        { compactVertical: true, onAirActive: true, seed: 'podcast-v5' },
        React.createElement(ClayCharacter3D, {
          position: [-0.9, 0, 0.14],
          rotationY: 0.55,
          accessory: 'headphones',
          pose: 'talking',
          seated: true,
          speakingWeight: 0.9,
          speechEnergy: 0.65,
          seed: 'host-left',
        }),
        React.createElement(ClayCharacter3D, {
          position: [0.9, 0, 0.14],
          rotationY: -0.55,
          accessory: 'glasses',
          pose: 'listening',
          seated: false,
          finish: 'frosted-glass',
          speakingWeight: 0.1,
          speechEnergy: 0,
          seed: 'host-right',
        }),
        React.createElement(ClayCharacter3D, {
          position: [0, 0, -0.6],
          accessory: 'beanie',
          pose: 'pointing',
          finish: 'retro-voxel',
          seed: 'guest-beanie',
        })
      )
    );

  let markupF24 = '';
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (
      first.includes('incorrect casing') ||
      first.includes('does not recognize') ||
      first.includes('useLayoutEffect does nothing on the server') ||
      first.includes('unrecognized in this browser')
    ) {
      return;
    }
    origConsoleError(...args);
  };
  try {
    markupF24 = renderToStaticMarkup(
      React.createElement(Thumbnail, {
        component: ActiveSceneProbe,
        compositionWidth: 1080,
        compositionHeight: 1920,
        durationInFrames: 120,
        fps: 60,
        frameToDisplay: 24,
      })
    );
  } finally {
    console.error = origConsoleError;
  }
  assert.match(markupF24, /podcast-studio-set-3d/);
  assert.match(markupF24, /clay-character-3d/);
});

test('computePodcastStudioLayout compactVertical frames both hosts and table cleanly inside 9:16 Golden Safe Box', () => {
  const layoutWide = computePodcastStudioLayout({ compactVertical: false });
  const layoutVert = computePodcastStudioLayout({ compactVertical: true });

  assert.ok(
    Math.abs(layoutVert.leftHostPosition[0]) <
      Math.abs(layoutWide.leftHostPosition[0]),
    'Expected compactVertical to tighten horizontal host spacing'
  );

  const pose = evaluateDirectorCamera3D({
    frame: 120,
    fps: 60,
    width: 1080,
    height: 1920,
    anchors: {
      leftHost: { position: layoutVert.leftHostPosition, height: 2.15 },
      rightHost: { position: layoutVert.rightHostPosition, height: 2.15 },
    },
    shots: [
      {
        fromFrame: 0,
        shot: 'medium-two-shot',
        target: 'leftHost',
        secondaryTarget: 'rightHost',
        transition: 'cut',
      },
    ],
    handheldIntensity: 0,
    safeBox9x16Compensation: true,
  });

  for (const hostPos of [
    layoutVert.leftHostPosition,
    layoutVert.rightHostPosition,
  ]) {
    for (const dx of [-0.45, 0.45]) {
      for (const dy of [0, 2.15]) {
        const { px, py } = projectPoint(
          pose.position,
          pose.lookAt,
          pose.fov,
          1080,
          1920,
          [hostPos[0] + dx, dy, hostPos[2]]
        );
        assert.ok(
          px >= 40 && px <= 910,
          `Expected vertical host px=${px.toFixed(1)} inside [40, 910]`
        );
        assert.ok(
          py >= 220 && py <= 1380,
          `Expected vertical host py=${py.toFixed(1)} inside [220, 1380]`
        );
      }
    }
  }
});
