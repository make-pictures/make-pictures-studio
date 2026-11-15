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
