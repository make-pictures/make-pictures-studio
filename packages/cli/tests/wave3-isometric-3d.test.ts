import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Thumbnail } from '@remotion/player';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StyleProvider,
  evaluateDirectorCamera3D,
} from '../../core/src/index';
import * as kitsRoot from '../../kits/src/index';
import {
  IsometricStage3D,
  IsometricStudioEnvironment,
  Stylized3DCharacter,
  computeIsometricLightRig,
  resolveIsometricCharacterMaterial,
  resolveIsometricLightRig,
  resolveIsometricMaterialPreset,
  resolveIsometricMaterialTokens,
  type IsometricMaterialMode,
  type IsometricMaterialPreset,
} from '../../kits/src/isometric-3d';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('resolveIsometricMaterialPreset, resolveIsometricMaterialTokens, and computeIsometricLightRig map all 7 styles deterministically without WebGL', () => {
  assert.equal(typeof IsometricStage3D, 'function');
  assert.equal(typeof Stylized3DCharacter, 'function');
  assert.equal(typeof IsometricStudioEnvironment, 'function');
  assert.equal(
    kitsRoot.resolveIsometricMaterialPreset,
    resolveIsometricMaterialPreset
  );
  assert.equal(
    kitsRoot.resolveIsometricMaterialTokens,
    resolveIsometricMaterialTokens
  );
  assert.equal(kitsRoot.computeIsometricLightRig, computeIsometricLightRig);
  assert.equal(
    kitsRoot.resolveIsometricCharacterMaterial,
    resolveIsometricCharacterMaterial
  );
  assert.equal(kitsRoot.resolveIsometricLightRig, resolveIsometricLightRig);
  assert.equal(
    resolveIsometricCharacterMaterial,
    resolveIsometricMaterialTokens
  );
  assert.equal(resolveIsometricLightRig, computeIsometricLightRig);

  const modeCheck: IsometricMaterialMode =
    'ceramic-maquette' satisfies IsometricMaterialPreset;
  assert.equal(modeCheck, 'ceramic-maquette');

  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['editorial-press']),
    'ceramic-maquette'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['minimal-product']),
    'ceramic-maquette'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['archival-chronicle']),
    'ceramic-maquette'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['cyber-telemetry']),
    'anodized-telemetry'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['brutalist-poster']),
    'ink-figurine'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['sketch-notebook']),
    'ink-figurine'
  );
  assert.equal(
    resolveIsometricMaterialPreset(BUILT_IN_STYLES['tactile-craft']),
    'ink-figurine'
  );

  // Dark custom presets resolve to anodized-telemetry even without darkroom-halation
  assert.equal(
    resolveIsometricMaterialPreset({
      ...BUILT_IN_STYLES['minimal-product'],
      surface: { ...BUILT_IN_STYLES['minimal-product'].surface, isDark: true },
    }),
    'anodized-telemetry'
  );

  // Explicit override takes precedence
  assert.equal(
    resolveIsometricMaterialPreset(
      BUILT_IN_STYLES['editorial-press'],
      'anodized-telemetry'
    ),
    'anodized-telemetry'
  );

  const ceramic = resolveIsometricMaterialTokens(
    BUILT_IN_STYLES['editorial-press']
  );
  assert.equal(ceramic.visorStyle, 'sculpted-band');
  assert.ok(ceramic.roughness >= 0.7 && ceramic.metalness <= 0.08);

  const telemetry = resolveIsometricMaterialTokens(
    BUILT_IN_STYLES['cyber-telemetry']
  );
  assert.equal(telemetry.visorStyle, 'slit-visor');
  assert.ok(telemetry.metalness >= 0.25);

  const ink = resolveIsometricMaterialTokens(
    BUILT_IN_STYLES['brutalist-poster']
  );
  assert.equal(ink.visorStyle, 'ink-mask');
  assert.ok(ink.roughness >= 0.88);

  for (const styleId of BUILT_IN_STYLE_IDS) {
    const style = BUILT_IN_STYLES[styleId];
    const tokens = resolveIsometricMaterialTokens(style);
    assert.notEqual(
      tokens.headColor.toUpperCase(),
      '#FFFFFF',
      `Expected non-#FFFFFF maquette head color for ${styleId}`
    );

    const rig = computeIsometricLightRig(style);
    assert.equal(rig.keyPosition.length, 3);
    assert.equal(rig.rimPosition.length, 3);
    assert.equal(rig.fillPosition.length, 3);
    // Key and rim light azimuths oppose each other across X
    if (Math.abs(style.optics!.lightAngleDeg) > 1) {
      assert.ok(
        Math.sign(rig.keyPosition[0]) === -Math.sign(rig.rimPosition[0]),
        `Expected opposing key/rim X signs for ${styleId}`
      );
    }
  }

  // Flipping lightAngleDeg from -32 to +32 flips keyPosition X sign
  const leftRig = computeIsometricLightRig({
    ...BUILT_IN_STYLES['editorial-press'],
    optics: {
      ...BUILT_IN_STYLES['editorial-press'].optics!,
      lightAngleDeg: -32,
    },
  });
  const rightRig = computeIsometricLightRig({
    ...BUILT_IN_STYLES['editorial-press'],
    optics: {
      ...BUILT_IN_STYLES['editorial-press'].optics!,
      lightAngleDeg: 32,
    },
  });
  assert.ok(leftRig.keyPosition[0] < 0);
  assert.ok(rightRig.keyPosition[0] > 0);
  assert.equal(leftRig.enableBeamsByDefault, true);

  const studioMacroRig = computeIsometricLightRig(
    BUILT_IN_STYLES['minimal-product']
  );
  assert.equal(studioMacroRig.enableBeamsByDefault, false);

  const darkroomRig = computeIsometricLightRig(
    BUILT_IN_STYLES['cyber-telemetry']
  );
  assert.equal(darkroomRig.enableBeamsByDefault, true);
});

test('IsometricStage3D and Stylized3DCharacter enforce Clean Frame 0 at runtime and obey maquette craft & frequency invariants', () => {
  const matSrc = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../kits/src/isometric-3d/isometricMaterials.ts'
    ),
    'utf8'
  );
  const stageSrc = fs.readFileSync(
    path.resolve(__dirname, '../../kits/src/isometric-3d/IsometricStage3D.tsx'),
    'utf8'
  );
  const charSrc = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../kits/src/isometric-3d/Stylized3DCharacter.tsx'
    ),
    'utf8'
  );

  // Pure resolver module must not import three or R3F
  assert.doesNotMatch(matSrc, /from\s+['"]three['"]|@react-three\/fiber/);

  for (const [name, src] of [
    ['isometricMaterials.ts', matSrc],
    ['IsometricStage3D.tsx', stageSrc],
    ['Stylized3DCharacter.tsx', charSrc],
  ] as const) {
    assert.doesNotMatch(
      src,
      /Math\.random\s*\(/,
      `${name} must not use Math.random`
    );
    assert.doesNotMatch(
      src,
      /useRef\b/,
      `${name} must not use mutable useRef`
    );
  }

  // Clean Frame 0 guards in source
  assert.match(stageSrc, /frame\s*<=\s*0/);
  assert.match(charSrc, /frame\s*<=\s*0/);
  assert.match(charSrc, /Math\.max\(2,\s*enterFrame\)/);
  assert.match(charSrc, /talkBounce\s*=\s*0/);

  // Runtime Clean Frame 0 check (even if enterFrame=0 is passed, frame 0 and frame 1 render zero 3D nodes)
  const FrameZeroProbe: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press', renderBackdrop: false },
      React.createElement(
        IsometricStage3D,
        { radius: 5.4 },
        React.createElement(Stylized3DCharacter, {
          position: [0, 0, 0],
          rotationY: 0,
          primaryColor: '#C83E2B',
          accentColor: '#1D4ED8',
          speechEnergy: 0.5,
          speakingWeight: 1,
          gestureWeights: {},
          enterFrame: 0,
        })
      )
    );

  const stageF0 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: FrameZeroProbe,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 60,
      fps: 60,
      frameToDisplay: 0,
    })
  );
  assert.doesNotMatch(stageF0, /isometric-stage-3d|<group|<mesh/);

  const CharEarlyProbe: React.FC = () =>
    React.createElement(
      StyleProvider,
      { style: 'editorial-press', renderBackdrop: false },
      React.createElement(Stylized3DCharacter, {
        position: [0, 0, 0],
        rotationY: 0,
        primaryColor: '#C83E2B',
        accentColor: '#1D4ED8',
        speechEnergy: 0.5,
        speakingWeight: 1,
        gestureWeights: {},
        enterFrame: 0,
      })
    );
  const charF1 = renderToStaticMarkup(
    React.createElement(Thumbnail, {
      component: CharEarlyProbe,
      compositionWidth: 1920,
      compositionHeight: 1080,
      durationInFrames: 60,
      fps: 60,
      frameToDisplay: 1,
    })
  );
  assert.doesNotMatch(charF1, /<group|<mesh/);
  assert.doesNotMatch(charSrc, /sphereGeometry/);

  // Stage uses computeIsometricLightRig, 24 degree ticks, ContactShadowDisc3D, and StagePostProcessing3D exponential fog
  assert.match(stageSrc, /computeIsometricLightRig/);
  assert.match(stageSrc, /ContactShadowDisc3D/);
  assert.match(stageSrc, /StagePostProcessing3D/);
  assert.match(stageSrc, /length:\s*24/);
  assert.match(stageSrc, /fogDensity/);

  // Character uses useStudioStyle, resolveIsometricMaterialTokens, and ContactShadowDisc3D; zero hardcoded toy-robot plastic hexes, globes, or ear muffs
  assert.match(charSrc, /useStudioStyle/);
  assert.match(charSrc, /resolveIsometricMaterialTokens/);
  assert.match(charSrc, /ContactShadowDisc3D/);
  assert.doesNotMatch(charSrc, /#1E293B|#334155|#090D16|#F8FAFC|#E2E8F0/i);
  assert.doesNotMatch(charSrc, /color="#FFFFFF"/i);

  // Verify all sin/cos frame frequencies in Stylized3DCharacter stay strictly within [0.03, 0.055]
  const freqMatches = [...charSrc.matchAll(/frame\s*\*\s*(\d*\.?\d+)/g)].map(
    (m) => Number(m[1])
  );
  assert.ok(freqMatches.length >= 4);
  for (const freq of freqMatches) {
    assert.ok(
      freq >= 0.03 && freq <= 0.055,
      `Expected character frequency ${freq} to stay in [0.03, 0.055]`
    );
  }
});

test('evaluateDirectorCamera3D frames 2.45m Stylized3DCharacter dialogue strictly inside 9:16 Golden Safe Box', () => {
  const projectPoint = (
    camPos: [number, number, number],
    lookAt: [number, number, number],
    fovDeg: number,
    width: number,
    height: number,
    pt: [number, number, number]
  ) => {
    const fx = lookAt[0] - camPos[0];
    const fy = lookAt[1] - camPos[1];
    const fz = lookAt[2] - camPos[2];
    const fLen = Math.hypot(fx, fy, fz);
    const fwd = [fx / fLen, fy / fLen, fz / fLen];
    // right = normalize(cross(fwd, [0, 1, 0])) = normalize([-fwd[2], 0, fwd[0]])
    // Wait: cross((fx,fy,fz), (0,1,0)) = (-fz, 0, fx)
    const rxRaw = -fwd[2];
    const rzRaw = fwd[0];
    const rLen = Math.hypot(rxRaw, rzRaw);
    const right = [rxRaw / rLen, 0, rzRaw / rLen];
    // up = cross(right, fwd)
    const up = [
      right[1]! * fwd[2]! - right[2]! * fwd[1]!,
      right[2]! * fwd[0]! - right[0]! * fwd[2]!,
      right[0]! * fwd[1]! - right[1]! * fwd[0]!,
    ];
    const dx = pt[0] - camPos[0];
    const dy = pt[1] - camPos[1];
    const dz = pt[2] - camPos[2];
    const cx = dx * right[0]! + dy * right[1]! + dz * right[2]!;
    const cy = dx * up[0]! + dy * up[1]! + dz * up[2]!;
    const cz = dx * fwd[0]! + dy * fwd[1]! + dz * fwd[2]!;
    const tanHalfY = Math.tan((fovDeg * Math.PI) / 360);
    const tanHalfX = (width / height) * tanHalfY;
    const ndcX = cx / (cz * tanHalfX);
    const ndcY = cy / (cz * tanHalfY);
    return {
      px: (ndcX + 1) * 0.5 * width,
      py: (1 - ndcY) * 0.5 * height,
    };
  };

  const anchors = {
    speakerA: { position: [-1.5, 0, 0.2] as [number, number, number], height: 2.45 },
    speakerB: { position: [1.5, 0, 0.2] as [number, number, number], height: 2.45 },
  };
  const shots = [
    {
      fromFrame: 0,
      shot: 'medium-two-shot' as const,
      target: 'speakerA',
      secondaryTarget: 'speakerB',
      transition: 'cut' as const,
    },
    {
      fromFrame: 320,
      shot: 'medium' as const,
      target: 'speakerB',
      secondaryTarget: 'speakerA',
      transition: 'glide' as const,
    },
  ];

  const poseTwoShot = evaluateDirectorCamera3D({
    frame: 120,
    fps: 60,
    width: 1080,
    height: 1920,
    anchors,
    shots,
    handheldIntensity: 0,
    safeBox9x16Compensation: true,
  });

  for (const cx of [-1.5, 1.5]) {
    for (const dx of [-0.6, 0.6]) {
      for (const dy of [0, 2.48]) {
        const { px, py } = projectPoint(
          poseTwoShot.position,
          poseTwoShot.lookAt,
          poseTwoShot.fov,
          1080,
          1920,
          [cx + dx, dy, 0.2]
        );
        assert.ok(px >= 40 && px <= 910, `Two-shot px=${px} outside [40, 910]`);
        assert.ok(py >= 360 && py <= 1380, `Two-shot py=${py} outside [360, 1380]`);
      }
    }
  }

  const poseMedium = evaluateDirectorCamera3D({
    frame: 420,
    fps: 60,
    width: 1080,
    height: 1920,
    anchors,
    shots,
    handheldIntensity: 0,
    safeBox9x16Compensation: true,
  });

  for (const dx of [-0.6, 0.6]) {
    for (const dy of [0, 2.48]) {
      const { px, py } = projectPoint(
        poseMedium.position,
        poseMedium.lookAt,
        poseMedium.fov,
        1080,
        1920,
        [1.5 + dx, dy, 0.2]
      );
      assert.ok(px >= 40 && px <= 910, `Medium px=${px} outside [40, 910]`);
      assert.ok(py >= 360 && py <= 1380, `Medium py=${py} outside [360, 1380]`);
    }
  }
});
