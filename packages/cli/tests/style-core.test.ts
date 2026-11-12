import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  STYLE_FONT_FAMILIES,
  StyleBackdrop,
  StylePresetSchema,
  StyleProvider,
  buildGoogleFontsStylesheetUrl,
  clearCustomStyles,
  formatFontFamilyCss,
  formatHeadingText,
  getCardChromeStyle,
  getStyleSpringConfig,
  isBuiltInStyleId,
  listAllStudioStyles,
  registerCustomStyles,
  resolveStudioStyle,
  useStudioStyle,
} from '../../core/src/index';

test('all 7 BUILT_IN_STYLES validate against StylePresetSchema and cover contrasting aesthetics', () => {
  assert.equal(BUILT_IN_STYLE_IDS.length, 7);
  for (const id of BUILT_IN_STYLE_IDS) {
    assert.equal(isBuiltInStyleId(id), true);
    const parsed = StylePresetSchema.parse(BUILT_IN_STYLES[id]);
    assert.equal(parsed.id, id);
    assert.ok(parsed.recommendedFor.length >= 2);
  }
  assert.equal(isBuiltInStyleId('my-custom-brand'), false);
  assert.equal(BUILT_IN_STYLES['cyber-telemetry'].surface.isDark, true);
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
    assert.equal(all.filter((s) => s.origin === 'built-in').length, 7);
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
