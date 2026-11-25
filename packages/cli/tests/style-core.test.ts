import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  DIMENSIONAL_SPACES,
  DimensionalSpaceSchema,
  STYLE_FONT_FAMILIES,
  StyleBackdrop,
  StyleMaterial3DFinishSchema,
  StyleMaterial3DSchema,
  StyleOpticsSchema,
  StylePresetSchema,
  StyleProvider,
  StyleStudioHdrPresetSchema,
  TYPOGRAPHY_FLOOR_1080P,
  buildGoogleFontsStylesheetUrl,
  clearCustomStyles,
  deriveDefaultOpticsForSurface,
  filterStylesBySpace,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  interpolateStylePresets,
  isBuiltInStyleId,
  listAllStudioStyles,
  registerCustomStyles,
  resolveArtWorld,
  resolveStudioStyle,
  resolveStyleMaterial3D,
  resolveStyleOptics,
  resolveStyleSpaces,
  useStudioStyle,
} from '../../remotion/src/index';

test('all 10 BUILT_IN_STYLES validate against StylePresetSchema and cover 2d, 2.5d, and 3d spaces', () => {
  assert.deepEqual(DIMENSIONAL_SPACES, ['2d', '2.5d', '3d']);
  assert.equal(BUILT_IN_STYLE_IDS.length, 10);
  for (const id of BUILT_IN_STYLE_IDS) {
    assert.equal(isBuiltInStyleId(id), true);
    const parsed = StylePresetSchema.parse(BUILT_IN_STYLES[id]);
    assert.equal(parsed.id, id);
    assert.ok(parsed.recommendedFor.length >= 2);
    assert.ok(parsed.preferredSpace, `Expected ${id} to define preferredSpace`);
    assert.ok(parsed.spaces && parsed.spaces.length >= 1, `Expected ${id} to define spaces`);
    assert.ok(parsed.material3d, `Expected ${id} to define material3d`);
  }
  assert.equal(isBuiltInStyleId('my-custom-brand'), false);
  assert.equal(BUILT_IN_STYLES['cyber-telemetry'].surface.isDark, true);
  assert.equal(BUILT_IN_STYLES['retro-pc'].surface.isDark, true);
  assert.equal(BUILT_IN_STYLES['soft-clay'].surface.isDark, false);
  assert.equal(BUILT_IN_STYLES['glass-studio'].surface.isDark, false);
  assert.equal(BUILT_IN_STYLES['glass-studio'].surface.cardTreatment, 'glass-glow');
  assert.equal(BUILT_IN_STYLES['brutalist-poster'].surface.radiusScale, 0);
  assert.equal(
    BUILT_IN_STYLES['editorial-press'].surface.backdropType,
    'editorial-paper'
  );
});

test('custom style registry registers, lists, resolves, and falls back to minimal-product on unknown id', () => {
  clearCustomStyles();
  assert.equal(resolveStudioStyle(undefined).id, 'minimal-product');
  assert.equal(resolveStudioStyle('non-existent-style').id, 'minimal-product');
  assert.equal(resolveStudioStyle('archival-chronicle').id, 'archival-chronicle');

  const customNeapolitan = StylePresetSchema.parse({
    ...BUILT_IN_STYLES['archival-chronicle'],
    id: 'neapolitan-chronicle',
    name: 'Kronika neapolitańska',
    palette: {
      ...BUILT_IN_STYLES['archival-chronicle'].palette,
      accentPrimary: '#C83E2B',
    },
  });

  registerCustomStyles([customNeapolitan]);
  try {
    const resolved = resolveStudioStyle('neapolitan-chronicle');
    assert.equal(resolved.id, 'neapolitan-chronicle');
    assert.equal(resolved.palette.accentPrimary, '#C83E2B');

    // Built-in IDs cannot be overwritten by registerCustomStyles
    registerCustomStyles([
      {
        ...BUILT_IN_STYLES['minimal-product'],
        name: 'Tampered Built-In',
      },
    ]);
    assert.equal(resolveStudioStyle('minimal-product').name, 'Minimal Product');

    const all = listAllStudioStyles();
    assert.equal(all.filter((s) => s.origin === 'built-in').length, 10);
    assert.equal(
      all.some(
        (s) => s.origin === 'custom' && s.preset.id === 'neapolitan-chronicle'
      ),
      true
    );
  } finally {
    clearCustomStyles();
  }
});

test('getCardChromeStyle computes distinct CSS geometry across all 5 cardTreatments and honors overrides', () => {
  const minimal = getCardChromeStyle(BUILT_IN_STYLES['minimal-product']);
  assert.equal(minimal.borderRadius, 22);
  assert.match(String(minimal.border), /1px solid/);

  const brutal = getCardChromeStyle(BUILT_IN_STYLES['brutalist-poster']);
  assert.equal(brutal.borderRadius, 0);
  assert.match(String(brutal.boxShadow), /6px 6px 0/);

  const glass = getCardChromeStyle(BUILT_IN_STYLES['cyber-telemetry'], {
    padding: 32,
  });
  assert.equal(glass.padding, 32);
  assert.ok(Number(glass.borderRadius) > 0);
  assert.equal(glass.backdropFilter, 'blur(16px)');

  const editorial = getCardChromeStyle(BUILT_IN_STYLES['editorial-press']);
  assert.match(String(editorial.border), /solid/);

  const tactile = getCardChromeStyle(BUILT_IN_STYLES['tactile-craft']);
  assert.match(String(tactile.border), /5px solid #FFFFFF/);

  for (const id of BUILT_IN_STYLE_IDS) {
    assert.equal(
      getCardChromeStyle(BUILT_IN_STYLES[id]).boxSizing,
      'border-box',
      `Expected getCardChromeStyle(${id}) to enforce boxSizing: 'border-box'`
    );
  }

  for (const calmStyleId of [
    'minimal-product',
    'editorial-press',
    'archival-chronicle',
    'cyber-telemetry',
  ] as const) {
    assert.ok(
      BUILT_IN_STYLES[calmStyleId].motion.cameraHandheld <= 0.015,
      `Expected ${calmStyleId} cameraHandheld <= 0.015, got ${BUILT_IN_STYLES[calmStyleId].motion.cameraHandheld}`
    );
  }

  assert.deepEqual(TYPOGRAPHY_FLOOR_1080P, {
    minPx: 18,
    recommendedMinPx: 19,
    cardTitlePx: 28,
    cardSentencePx: 20,
    badgePx: 18,
  });
});

test('getStyleSpringConfig, formatFontFamilyCss, formatHeadingText, and buildGoogleFontsStylesheetUrl are deterministic', () => {
  const calmSpring = getStyleSpringConfig(
    BUILT_IN_STYLES['editorial-press'],
    'enter'
  );
  const popSpring = getStyleSpringConfig(
    BUILT_IN_STYLES['brutalist-poster'],
    'enter'
  );
  assert.ok(popSpring.stiffness > calmSpring.stiffness);

  const cameraFluid = getStyleSpringConfig(
    BUILT_IN_STYLES['archival-chronicle'],
    'camera'
  );
  assert.equal(cameraFluid.damping, 200);

  assert.equal(STYLE_FONT_FAMILIES.length, 13);
  for (const family of STYLE_FONT_FAMILIES) {
    const sampleStyle = {
      ...BUILT_IN_STYLES['minimal-product'],
      typography: {
        ...BUILT_IN_STYLES['minimal-product'].typography,
        displayFont: family,
      },
    };
    const fontUrl = buildGoogleFontsStylesheetUrl(sampleStyle);
    assert.match(fontUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/);
    assert.ok(formatFontFamilyCss(family, 'display').length > family.length);
  }

  const url = buildGoogleFontsStylesheetUrl(BUILT_IN_STYLES['editorial-press']);
  assert.match(url, /fonts\.googleapis\.com\/css2/);
  assert.match(url, /Fraunces/);
  assert.match(url, /DM\+Sans/);
  assert.match(url, /IBM\+Plex\+Mono/);

  assert.match(formatFontFamilyCss('Fraunces', 'display'), /Georgia.*serif/);
  assert.match(formatFontFamilyCss('Caveat', 'display'), /cursive/);
  assert.match(formatFontFamilyCss('IBM Plex Mono', 'mono'), /monospace/);
  assert.equal(
    formatHeadingText('Historia żółtej łodzi', BUILT_IN_STYLES['brutalist-poster']),
    'HISTORIA ŻÓŁTEJ ŁODZI'
  );
  assert.equal(
    formatHeadingText('Historia pizzy', BUILT_IN_STYLES['editorial-press']),
    'Historia pizzy'
  );
});

test('StyleProvider exposes resolved style via useStudioStyle and exports StyleBackdrop', () => {
  assert.equal(typeof StyleBackdrop, 'function');

  const Probe: React.FC = () => {
    const style = useStudioStyle();
    return React.createElement('span', { 'data-style': style.id }, style.name);
  };

  const defaultMarkup = renderToStaticMarkup(React.createElement(Probe));
  assert.match(defaultMarkup, /data-style="minimal-product"/);

  const providedMarkup = renderToStaticMarkup(
    React.createElement(StyleProvider, {
      style: 'editorial-press',
      children: React.createElement(Probe),
    })
  );
  assert.match(providedMarkup, /data-style="editorial-press"/);
  assert.match(providedMarkup, /Editorial Press/);
});

test('StyleOpticsSchema, BUILT_IN_STYLES optics, and surface-aware legacy migration work deterministically', () => {
  const expectedOptics: Record<
    string,
    {
      lightingRig: string;
      typographyGrammar: string;
      lightAngleDeg: number;
      aperture: number;
      halation: number;
    }
  > = {
    'minimal-product': {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -20,
      aperture: 0.36,
      halation: 0.08,
    },
    'editorial-press': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -28,
      aperture: 0.45,
      halation: 0.16,
    },
    'archival-chronicle': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -34,
      aperture: 0.54,
      halation: 0.26,
    },
    'cyber-telemetry': {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -24,
      aperture: 0.5,
      halation: 0.58,
    },
    'brutalist-poster': {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -38,
      aperture: 0.32,
      halation: 0.28,
    },
    'sketch-notebook': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -26,
      aperture: 0.38,
      halation: 0.12,
    },
    'tactile-craft': {
      lightingRig: 'window-gobo',
      typographyGrammar: 'risograph-poster',
      lightAngleDeg: -30,
      aperture: 0.48,
      halation: 0.2,
    },
    'retro-pc': {
      lightingRig: 'darkroom-halation',
      typographyGrammar: 'optical-gate',
      lightAngleDeg: -22,
      aperture: 0.42,
      halation: 0.48,
    },
    'soft-clay': {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -26,
      aperture: 0.44,
      halation: 0.14,
    },
    'glass-studio': {
      lightingRig: 'studio-macro',
      typographyGrammar: 'swiss-spatial',
      lightAngleDeg: -22,
      aperture: 0.4,
      halation: 0.12,
    },
  };

  for (const id of BUILT_IN_STYLE_IDS) {
    const preset = BUILT_IN_STYLES[id];
    assert.ok(preset.optics, `Expected ${id} to define optics`);
    assert.deepEqual(preset.optics, StyleOpticsSchema.parse(expectedOptics[id]));
  }

  // Legacy JSON without `optics` still parses and receives surface-matched defaults via registry
  const { optics: _omitted, ...legacyArchivalWithoutOptics } =
    BUILT_IN_STYLES['archival-chronicle'];
  const parsedLegacy = StylePresetSchema.parse({
    ...legacyArchivalWithoutOptics,
    id: 'legacy-editorial',
  });
  assert.equal(parsedLegacy.optics, undefined);

  const derivedEditorial = deriveDefaultOpticsForSurface(parsedLegacy.surface);
  assert.equal(derivedEditorial.lightingRig, 'window-gobo');
  assert.equal(derivedEditorial.typographyGrammar, 'swiss-spatial');

  const derivedDark = deriveDefaultOpticsForSurface(
    BUILT_IN_STYLES['cyber-telemetry'].surface
  );
  assert.equal(derivedDark.lightingRig, 'darkroom-halation');
  assert.equal(derivedDark.typographyGrammar, 'optical-gate');

  const derivedBrutalist = deriveDefaultOpticsForSurface(
    BUILT_IN_STYLES['brutalist-poster'].surface
  );
  assert.equal(derivedBrutalist.typographyGrammar, 'risograph-poster');

  const derivedMinimal = deriveDefaultOpticsForSurface(
    BUILT_IN_STYLES['minimal-product'].surface
  );
  assert.equal(derivedMinimal.lightingRig, 'studio-macro');
  assert.equal(derivedMinimal.typographyGrammar, 'swiss-spatial');

  clearCustomStyles();
  registerCustomStyles([parsedLegacy]);
  try {
    const resolvedLegacy = resolveStudioStyle('legacy-editorial');
    assert.deepEqual(resolvedLegacy.optics, derivedEditorial);
    assert.deepEqual(resolveStyleOptics(parsedLegacy), derivedEditorial);
  } finally {
    clearCustomStyles();
  }
});

test('DimensionalSpace matrix, Spec 1.2 built-in spaces/material3d mapping, legacy heuristics, and cross-space custom presets', () => {
  assert.deepEqual(DimensionalSpaceSchema.options, ['2d', '2.5d', '3d']);
  assert.deepEqual(StyleMaterial3DFinishSchema.options, [
    'soft-clay',
    'frosted-glass',
    'retro-voxel',
    'matte-ceramic',
  ]);
  assert.deepEqual(StyleStudioHdrPresetSchema.options, [
    'warm-softbox',
    'clean-atelier',
    'neon-grid',
  ]);

  const expectedMatrix: Record<
    (typeof BUILT_IN_STYLE_IDS)[number],
    {
      preferredSpace: '2d' | '2.5d' | '3d';
      spaces: Array<'2d' | '2.5d' | '3d'>;
      finish: 'soft-clay' | 'frosted-glass' | 'retro-voxel' | 'matte-ceramic';
      artWorld: 'atelier' | 'illustrative' | 'editorial-gallery';
    }
  > = {
    'minimal-product': {
      preferredSpace: '2d',
      spaces: ['2d', '2.5d'],
      finish: 'frosted-glass',
      artWorld: 'atelier',
    },
    'sketch-notebook': {
      preferredSpace: '2d',
      spaces: ['2d', '2.5d'],
      finish: 'soft-clay',
      artWorld: 'illustrative',
    },
    'retro-pc': {
      preferredSpace: '2d',
      spaces: ['2d', '3d'],
      finish: 'retro-voxel',
      artWorld: 'atelier',
    },
    'brutalist-poster': {
      preferredSpace: '2d',
      spaces: ['2d'],
      finish: 'matte-ceramic',
      artWorld: 'editorial-gallery',
    },
    'cyber-telemetry': {
      preferredSpace: '2d',
      spaces: ['2d', '3d'],
      finish: 'frosted-glass',
      artWorld: 'atelier',
    },
    'tactile-craft': {
      preferredSpace: '2.5d',
      spaces: ['2.5d'],
      finish: 'soft-clay',
      artWorld: 'illustrative',
    },
    'editorial-press': {
      preferredSpace: '2.5d',
      spaces: ['2.5d', '2d'],
      finish: 'matte-ceramic',
      artWorld: 'editorial-gallery',
    },
    'archival-chronicle': {
      preferredSpace: '2.5d',
      spaces: ['2.5d', '2d'],
      finish: 'matte-ceramic',
      artWorld: 'editorial-gallery',
    },
    'soft-clay': {
      preferredSpace: '3d',
      spaces: ['3d'],
      finish: 'soft-clay',
      artWorld: 'illustrative',
    },
    'glass-studio': {
      preferredSpace: '3d',
      spaces: ['3d', '2d'],
      finish: 'frosted-glass',
      artWorld: 'atelier',
    },
  };

  for (const id of BUILT_IN_STYLE_IDS) {
    const preset = BUILT_IN_STYLES[id];
    const exp = expectedMatrix[id];
    assert.deepEqual(resolveStyleSpaces(preset), {
      preferredSpace: exp.preferredSpace,
      spaces: exp.spaces,
    });
    const mat3d = StyleMaterial3DSchema.parse(resolveStyleMaterial3D(preset));
    assert.equal(mat3d.finish, exp.finish, `Unexpected finish on ${id}`);
    assert.equal(resolveArtWorld(preset), exp.artWorld);
    assert.equal(
      resolveArtWorld({ ...preset, artWorld: undefined }),
      exp.artWorld
    );
  }

  // Space filtering across all 10 built-in presets
  const stylesAll = BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]);
  const ids2d = filterStylesBySpace(stylesAll, '2d').map((s) => s.id);
  const ids25d = filterStylesBySpace(stylesAll, '2.5d').map((s) => s.id);
  const ids3d = filterStylesBySpace(stylesAll, '3d').map((s) => s.id);

  assert.deepEqual(
    new Set(ids2d),
    new Set([
      'minimal-product',
      'sketch-notebook',
      'retro-pc',
      'brutalist-poster',
      'cyber-telemetry',
      'editorial-press',
      'archival-chronicle',
      'glass-studio',
    ])
  );
  assert.deepEqual(
    new Set(ids25d),
    new Set([
      'minimal-product',
      'sketch-notebook',
      'tactile-craft',
      'editorial-press',
      'archival-chronicle',
    ])
  );
  assert.deepEqual(
    new Set(ids3d),
    new Set(['retro-pc', 'cyber-telemetry', 'soft-clay', 'glass-studio'])
  );

  // Legacy custom styles omitting preferredSpace, spaces, and material3d
  const {
    preferredSpace: _ps1,
    spaces: _sp1,
    material3d: _m1,
    ...legacyCutoutBase
  } = BUILT_IN_STYLES['tactile-craft'];
  const legacyCutout = StylePresetSchema.parse({
    ...legacyCutoutBase,
    id: 'legacy-cutout',
  });
  assert.deepEqual(resolveStyleSpaces(legacyCutout), {
    preferredSpace: '2.5d',
    spaces: ['2.5d'],
  });
  assert.deepEqual(resolveStyleMaterial3D(legacyCutout), {
    finish: 'soft-clay',
    bevelRadius: 0.14,
    studioHdr: 'warm-softbox',
  });

  const {
    preferredSpace: _ps2,
    spaces: _sp2,
    material3d: _m2,
    ...legacyGlassBase
  } = BUILT_IN_STYLES['cyber-telemetry'];
  const legacyGlass = StylePresetSchema.parse({
    ...legacyGlassBase,
    id: 'legacy-glass',
  });
  assert.deepEqual(resolveStyleSpaces(legacyGlass), {
    preferredSpace: '2d',
    spaces: ['2d', '2.5d'],
  });
  assert.deepEqual(resolveStyleMaterial3D(legacyGlass), {
    finish: 'frosted-glass',
    bevelRadius: 0.1,
    studioHdr: 'clean-atelier',
  });

  const {
    preferredSpace: _ps3,
    spaces: _sp3,
    material3d: _m3,
    ...legacyEditorialBase
  } = BUILT_IN_STYLES['editorial-press'];
  const legacyEditorial = StylePresetSchema.parse({
    ...legacyEditorialBase,
    id: 'legacy-editorial-space',
  });
  assert.deepEqual(resolveStyleSpaces(legacyEditorial), {
    preferredSpace: '2d',
    spaces: ['2d', '2.5d'],
  });
  assert.deepEqual(resolveStyleMaterial3D(legacyEditorial), {
    finish: 'matte-ceramic',
    bevelRadius: 0.08,
    studioHdr: 'warm-softbox',
  });

  // Custom cross-space preset (2D + 2.5D + 3D) & deduplication / preferredSpace inclusion
  const customBrandOmni = StylePresetSchema.parse({
    ...BUILT_IN_STYLES['soft-clay'],
    id: 'brand-omni',
    preferredSpace: '3d',
    spaces: ['2d', '2.5d', '2d'],
    material3d: {
      finish: 'matte-ceramic',
      bevelRadius: 0.18,
      studioHdr: 'clean-atelier',
    },
  });
  const resolvedOmni = resolveStyleSpaces(customBrandOmni);
  assert.equal(resolvedOmni.preferredSpace, '3d');
  assert.deepEqual(resolvedOmni.spaces, ['3d', '2d', '2.5d']);
  for (const sp of DIMENSIONAL_SPACES) {
    assert.equal(
      filterStylesBySpace([customBrandOmni], sp).length,
      1,
      `Expected brand-omni in ${sp}`
    );
  }
});

test('interpolateStylePresets preserves preferredSpace/spaces and smoothly interpolates material3d', () => {
  const fromStyle = BUILT_IN_STYLES['retro-pc']; // bevelRadius: 0.04, retro-voxel, neon-grid, 2d
  const toStyle = BUILT_IN_STYLES['soft-clay']; // bevelRadius: 0.14, soft-clay, warm-softbox, 3d

  const beforeHalf = StylePresetSchema.parse(
    interpolateStylePresets(fromStyle, toStyle, 0.49)
  );
  const atHalf = StylePresetSchema.parse(
    interpolateStylePresets(fromStyle, toStyle, 0.5)
  );

  assert.equal(beforeHalf.preferredSpace, '2d');
  assert.deepEqual(beforeHalf.spaces, ['2d', '3d']);
  assert.equal(beforeHalf.material3d?.finish, 'retro-voxel');
  assert.equal(beforeHalf.material3d?.studioHdr, 'neon-grid');

  assert.equal(atHalf.preferredSpace, '3d');
  assert.deepEqual(atHalf.spaces, ['3d']);
  assert.equal(atHalf.material3d?.finish, 'soft-clay');
  assert.equal(atHalf.material3d?.studioHdr, 'warm-softbox');
  assert.ok(
    Math.abs((atHalf.material3d?.bevelRadius ?? 0) - (0.04 + 0.14) / 2) < 1e-4
  );
});
