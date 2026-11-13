import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import {
  BUILT_IN_STYLE_IDS,
  BUILT_IN_STYLES,
  StylePresetSchema,
  type StudioCompositionEntry,
} from '../../core/src/index';
import * as StudioClient from '../../studio/src/client/index';
import {
  ProjectPickerPopover,
  PropsInspector,
  SceneScriptEditor,
  StudioApp,
  Topbar,
  type StudioScenesResponse,
  type StudioStatusResponse,
} from '../../studio/src/client/index';

const DummyStageComponent: React.FC<Record<string, unknown>> = ({ headline }) =>
  React.createElement(
    'div',
    { 'data-testid': 'dummy-stage' },
    String(headline ?? 'Scena testowa')
  );

const SampleFilmSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().max(80).describe('Teksty & Napisy :: Nagłówek'),
  glowColor: z.string().describe('Kolory & Styl :: Poświata RGBA'),
  tags: z.array(z.string()).describe('Metadane :: Tagi filmu'),
  cameraOffset: z
    .tuple([z.number(), z.number(), z.number()])
    .describe('Kamera :: Offset XYZ'),
  showGrid: z.boolean().describe('Kamera :: Siatka pomocnicza'),
});

function createSampleComposition(
  overrides: Partial<StudioCompositionEntry> = {}
): StudioCompositionEntry {
  return {
    id: 'kronika-neapolu-main',
    title: 'Kronika Neapolu — Akt I',
    subtitle: 'Opowieść redakcyjna 60 FPS',
    group: 'Kronika Neapolu',
    origin: 'production',
    productionId: 'kronika-neapolu',
    kit: 'editorial-collage',
    component: DummyStageComponent,
    schema: SampleFilmSchema,
    defaultProps: {
      styleId: 'editorial-press',
      headline: 'Sztuka rzemiosła i światła',
      glowColor: 'rgba(0, 122, 255, 0.45)',
      tags: ['archiwum', 'historia', '60fps'],
      cameraOffset: [0, 1.2, 6.5],
      showGrid: true,
    },
    propsFile: 'productions/kronika-neapolu/compositions/Main.props.json',
    width: 1920,
    height: 1080,
    fps: 60,
    durationInFrames: 300,
    usesThree: false,
    sceneTimeline: [
      {
        sceneId: 'kn-scena-1',
        label: 'Otwarcie',
        fromFrame: 0,
        durationInFrames: 180,
      },
      {
        sceneId: 'kn-scena-2',
        label: 'Rozwinięcie',
        fromFrame: 180,
        durationInFrames: 120,
      },
    ],
    ...overrides,
  };
}

test('client barrel index.ts exports all legacy and new Liquid Glass modules & hooks', () => {
  // Existing exports preserved
  assert.equal(typeof StudioClient.StudioApp, 'function');
  assert.equal(typeof StudioClient.Topbar, 'function');
  assert.equal(typeof StudioClient.StageViewport, 'function');
  assert.equal(typeof StudioClient.PropsInspector, 'function');
  assert.equal(typeof StudioClient.LeftSidebar, 'function');
  assert.equal(typeof StudioClient.StyleCatalogSidebar, 'function');
  assert.equal(typeof StudioClient.StyleLabShowcase, 'function');
  assert.equal(typeof StudioClient.DirectorOverlays, 'function');
  assert.equal(typeof StudioClient.DirectorTimelinePanel, 'function');
  assert.equal(typeof StudioClient.LiveTranscriptBar, 'function');
  assert.equal(typeof StudioClient.BrandLogo, 'function');
  assert.equal(typeof StudioClient.BrandMarkSvg, 'function');
  assert.equal(typeof StudioClient.extractStudioCompositionsFromModule, 'function');
  assert.equal(typeof StudioClient.mergeStudioCompositionModules, 'function');
  assert.equal(typeof StudioClient.consumePostSseStream, 'function');
  assert.equal(StudioClient.STUDIO_SHARED_AUDIO_TAGS, 32);

  // New Liquid Glass exports
  assert.equal(typeof StudioClient.ProjectPickerPopover, 'function');
  assert.equal(typeof StudioClient.SceneScriptEditor, 'function');
  assert.equal(typeof StudioClient.useRemotionPlayer, 'function');
  assert.equal(typeof StudioClient.attachPlayerLifecycle, 'function');
  assert.equal(typeof StudioClient.useStudioTheme, 'function');
  assert.equal(typeof StudioClient.introspectPropsFallback, 'function');
  assert.equal(typeof StudioClient.mergeSchemaWithExtraProps, 'function');
  assert.equal(typeof StudioClient.parseRgbaOrHex, 'function');
  assert.equal(typeof StudioClient.formatColorWithAlpha, 'function');
});

test('StudioApp SSR renders minimalist Stage-First Liquid Glass workspace without permanent LeftSidebar', () => {
  const sampleComp = createSampleComposition();
  const html = renderToStaticMarkup(
    React.createElement(StudioApp, { compositions: [sampleComp] })
  );

  // 1. Adaptive theme attribute on root .mp-shell & zero permanent LeftSidebar in .mp-workspace
  assert.match(html, /class="mp-shell"[^>]*data-theme="light"/);
  assert.doesNotMatch(
    html,
    /mp-sidebar-left/,
    'Permanent LeftSidebar must NOT be rendered inside minimalist Stage-First workspace'
  );
  assert.match(html, /class="mp-workspace"/);
  assert.match(html, /class="mp-inspector-backdrop"/);

  // 2. Topbar: ⌘K trigger with active composition title, Filmy/Style Lab switcher, FPS badge, theme toggle, inspector toggle
  assert.match(html, /class="mp-project-trigger[^"]*"/);
  assert.match(html, /Kronika Neapolu — Akt I/);
  assert.match(html, /⌘K/);
  assert.match(html, /Filmy/);
  assert.match(html, /Style Lab/);
  assert.match(html, /60 FPS/);
  assert.match(html, /data-theme-mode="system"/);
  assert.match(html, /Motyw: Systemowy \(macOS\/iOS\)/);
  assert.match(html, /aria-label="Inspektor parametrów \(⌘I\)"/);

  // 3. StageViewport: floating Liquid Glass transport capsule, Play FAB, Eksportuj MP4, collapsed Oś czasu drawer
  assert.match(html, /class="mp-floating-transport"/);
  assert.match(html, /class="mp-play-fab"/);
  assert.match(html, /Eksportuj MP4/);
  assert.match(html, /Kadr &amp; QA/);
  assert.match(html, /Oś czasu/);
  assert.match(
    html,
    /class="mp-bottom-drawer\s*"\s+aria-hidden="true"/,
    'Bottom timeline & transcript drawer must be collapsed by default'
  );
  assert.doesNotMatch(html, /mp-bottom-drawer\s+is-open/);

  // 4. PropsInspector: 3 segmented tabs, search input, styleId visual swatches, RGBA alpha slider, string-array chips, tuple XYZ
  assert.match(html, /Parametry/);
  assert.match(html, /Skrypt &amp; Audio/);
  assert.match(html, />JSON</);
  assert.match(html, /class="mp-inspector-search"/);
  assert.match(html, /Szukaj parametru…/);
  assert.match(html, /class="mp-style-picker-grid"/);
  assert.match(html, /Edytuj styl →/);
  assert.match(html, /class="mp-alpha-row"/);
  assert.match(html, /aria-label="Poświata RGBA krycie alpha"/);
  assert.match(html, /45%/);
  assert.match(html, /class="mp-tag-list"/);
  assert.match(html, /class="mp-tag-chip"/);
  assert.match(html, /archiwum/);
  assert.match(html, /class="mp-tuple-grid"/);
});

test('StudioApp empty state and StudioApp.tsx source use adaptive Liquid Glass tokens without hardcoded pink/light hex colors', () => {
  const emptyHtml = renderToStaticMarkup(
    React.createElement(StudioApp, { compositions: [] })
  );
  assert.match(emptyHtml, /class="mp-shell"[^>]*data-theme="light"/);
  assert.match(emptyHtml, /data-theme-mode="system"/);
  assert.match(emptyHtml, /npx make-pictures new moj-pierwszy-film/);
  assert.match(emptyHtml, /Otwórz Style Lab \(podgląd stylów 60 FPS\)/);
  assert.doesNotMatch(emptyHtml, /--kit=paper-diorama-3d/);

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const studioAppSource = fs.readFileSync(
    path.resolve(thisDir, '../../studio/src/client/StudioApp.tsx'),
    'utf8'
  );
  assert.doesNotMatch(studioAppSource, /#FF2A85/i);
  assert.doesNotMatch(studioAppSource, /#FFF5F9/i);
  assert.doesNotMatch(studioAppSource, /LeftSidebar/);
  assert.doesNotMatch(studioAppSource, /StyleCatalogSidebar/);
  assert.doesNotMatch(studioAppSource, /mp-style-right-col/);
});

test('PropsInspector SSR supports schema-less fallback when schema is omitted and Style Lab mode with styleSaveAsBanner', () => {
  const schemaLessComp = createSampleComposition({
    id: 'schemaless-demo',
    title: 'Kompozycja bez Zod',
    schema: undefined,
    defaultProps: {
      styleId: 'cyber-telemetry',
      bannerTitle: 'Dynamiczny podgląd bez schematu',
      tintColor: 'rgba(10, 132, 255, 0.7)',
      keywords: ['liquid-glass', 'remotion'],
      cameraOffset: [1, 2, 3],
      enableGlow: true,
    },
  });

  const fallbackHtml = renderToStaticMarkup(
    React.createElement(PropsInspector, {
      mode: 'films',
      composition: schemaLessComp,
      liveProps: schemaLessComp.defaultProps,
      isDirty: false,
      isSaving: false,
      autoSave: false,
      saveError: null,
      lastSavedAt: null,
      onChangeProps: () => {},
      onSave: () => {},
      onToggleAutoSave: () => {},
      onResetToDisk: () => {},
    })
  );

  // Schema-less fallback renders full controls cleanly
  assert.match(fallbackHtml, /class="mp-style-picker-grid"/);
  assert.match(fallbackHtml, /cyber-telemetry/);
  assert.match(fallbackHtml, /class="mp-alpha-row"/);
  assert.match(fallbackHtml, /70%/);
  assert.match(fallbackHtml, /liquid-glass/);
  assert.match(fallbackHtml, /class="mp-tuple-grid"/);
  assert.match(fallbackHtml, /class="mp-switch is-on"/);

  // Style Lab mode renders 2 tabs (Parametry | JSON) + built-in Save-As banner inside .mp-sidebar-right
  const styleComp = createSampleComposition({
    id: 'style-minimal-product',
    title: BUILT_IN_STYLES['minimal-product'].name,
    schema: StylePresetSchema,
    defaultProps: BUILT_IN_STYLES['minimal-product'] as unknown as Record<
      string,
      unknown
    >,
    propsFile: 'built-in:minimal-product (tylko odczyt)',
  });

  const stylesInspectorHtml = renderToStaticMarkup(
    React.createElement(PropsInspector, {
      mode: 'styles',
      composition: styleComp,
      liveProps: styleComp.defaultProps,
      isDirty: true,
      isSaving: false,
      autoSave: false,
      saveError: null,
      lastSavedAt: null,
      onChangeProps: () => {},
      onSave: () => {},
      onToggleAutoSave: () => {},
      onResetToDisk: () => {},
      isMobileOpen: true,
      onCloseMobile: () => {},
      styleSaveAsBanner: React.createElement(
        'div',
        { className: 'mp-style-saveas-banner' },
        'Zapisz jako nowy własny styl…'
      ),
    })
  );

  assert.match(stylesInspectorHtml, /Inspektor stylu/);
  assert.match(stylesInspectorHtml, /Zapisz jako nowy własny styl…/);
  assert.match(stylesInspectorHtml, /Parametry/);
  assert.match(stylesInspectorHtml, />JSON</);
  assert.doesNotMatch(stylesInspectorHtml, /Skrypt &amp; Audio/);
  assert.match(stylesInspectorHtml, /Niezapisane/);
});

test('Topbar and ProjectPickerPopover SSR in both films and styles modes', () => {
  const prodComp = createSampleComposition();
  const verticalExampleComp = createSampleComposition({
    id: 'shorts-example',
    title: 'Demo Pionowe 9:16',
    group: 'Pokazy Silnika',
    origin: 'example',
    productionId: undefined,
    width: 1080,
    height: 1920,
    usesThree: true,
  });

  const builtIns = BUILT_IN_STYLE_IDS.map((id) => BUILT_IN_STYLES[id]);
  const customPreset = {
    ...BUILT_IN_STYLES['editorial-press'],
    id: 'gazeta-neapolu',
    name: 'Gazeta Neapolu',
  };

  // Closed popover renders nothing
  const closedHtml = renderToStaticMarkup(
    React.createElement(ProjectPickerPopover, {
      isOpen: false,
      onClose: () => {},
      viewMode: 'films',
      compositions: [prodComp, verticalExampleComp],
      activeComposition: prodComp,
    })
  );
  assert.equal(closedHtml, '');

  // Open popover in `films` mode
  const filmsPopoverHtml = renderToStaticMarkup(
    React.createElement(ProjectPickerPopover, {
      isOpen: true,
      onClose: () => {},
      viewMode: 'films',
      compositions: [prodComp, verticalExampleComp],
      activeComposition: prodComp,
      onSelectComposition: () => {},
    })
  );
  assert.match(filmsPopoverHtml, /class="mp-project-popover"/);
  assert.match(filmsPopoverHtml, /Wszystkie/);
  assert.match(filmsPopoverHtml, /Produkcje/);
  assert.match(filmsPopoverHtml, /Przykłady/);
  assert.match(filmsPopoverHtml, /Kronika Neapolu — Akt I/);
  assert.match(filmsPopoverHtml, /Demo Pionowe 9:16/);
  assert.match(filmsPopoverHtml, />PROD</);
  assert.match(filmsPopoverHtml, />3D</);
  assert.match(filmsPopoverHtml, />9:16</);
  assert.match(filmsPopoverHtml, /2 \/ 2 kompozycji/);

  // Open popover in `styles` mode
  const stylesPopoverHtml = renderToStaticMarkup(
    React.createElement(ProjectPickerPopover, {
      isOpen: true,
      onClose: () => {},
      viewMode: 'styles',
      builtInStyles: builtIns,
      customStyles: [customPreset],
      activeStyleId: 'gazeta-neapolu',
      activeStyle: customPreset,
      styleWarnings: ['Pominięto uszkodzony plik broken.style.json'],
      onSelectStyle: () => {},
      onDuplicateStyle: () => {},
      onRefreshStyles: () => {},
    })
  );
  assert.match(stylesPopoverHtml, /Katalog stylów \(Style Lab\)/);
  assert.match(stylesPopoverHtml, /Twoje style \(styles\/\*\.style\.json\)/);
  assert.match(stylesPopoverHtml, /Style wbudowane \(7\)/);
  assert.match(stylesPopoverHtml, /Gazeta Neapolu/);
  assert.match(stylesPopoverHtml, />WŁASNY</);
  assert.match(stylesPopoverHtml, /Pominięto uszkodzony plik broken\.style\.json/);
  assert.match(stylesPopoverHtml, /\+ Duplikuj jako własny styl/);

  // Topbar in `styles` mode with dirty indicator and closed inspector dot
  const stylesTopbarHtml = renderToStaticMarkup(
    React.createElement(Topbar, {
      viewMode: 'styles',
      measuredFps: 60,
      isPlaying: true,
      activeStyleId: 'gazeta-neapolu',
      activeStyle: customPreset,
      isDirty: true,
      themeMode: 'dark',
      resolvedTheme: 'dark',
      onCycleTheme: () => {},
      inspectorOpen: false,
      onToggleInspector: () => {},
    })
  );
  assert.match(stylesTopbarHtml, /Gazeta Neapolu/);
  assert.match(stylesTopbarHtml, /Niezapisane zmiany stylu/);
  assert.match(stylesTopbarHtml, /Motyw: Ciemny/);
  assert.match(stylesTopbarHtml, /aria-pressed="false"/);
});

test('SceneScriptEditor SSR renders capsule scenes, audio hash status pills, ElevenLabs key state, and voice controls', () => {
  const prodComp = createSampleComposition();

  const mockScenesResponse: StudioScenesResponse = {
    ok: true,
    hasApiKey: true,
    groups: [
      {
        id: 'kronika-neapolu',
        title: 'Kronika Neapolu',
        origin: 'production',
        manifestFile: 'productions/kronika-neapolu/production.json',
        fps: 60,
        scenes: [
          {
            id: 'kn-scena-1',
            title: 'Otwarcie w porcie',
            component: 'OpeningScene',
            speaker: 'Narrator PL',
            voiceId: 'TX3LPaxmHKxFdv7VOQHJ',
            durationInSeconds: 3,
            durationInFrames: 180,
            voiceEffect: 'clean',
            text: 'W porcie w Neapolu zaczyna się nasza historia.',
          },
          {
            id: 'kn-scena-2',
            title: 'Piekarz Raffaele',
            component: 'BakerScene',
            speaker: 'Raffaele',
            durationInSeconds: 2,
            durationInFrames: 120,
            voiceEffect: 'radio-walkie',
            text: 'Zmieniona kwestia oczekująca na nowe nagranie MP3.',
          },
          {
            id: 'kn-epilog-bonus',
            title: 'Epilog poza osią',
            component: 'EpilogueScene',
            durationInSeconds: 4,
            durationInFrames: 240,
            text: 'Dodatkowa scena zapisana w manifeście kapsuły.',
          },
        ],
      },
    ],
    audioStatus: {
      'kn-scena-1': {
        sceneId: 'kn-scena-1',
        title: 'Otwarcie w porcie',
        speaker: 'Narrator PL',
        mp3Exists: true,
        jsonExists: true,
        provider: 'elevenlabs',
        isHashCurrent: true,
        wordCount: 8,
        durationInSeconds: 3.12,
      },
      'kn-scena-2': {
        sceneId: 'kn-scena-2',
        title: 'Piekarz Raffaele',
        speaker: 'Raffaele',
        mp3Exists: true,
        jsonExists: true,
        provider: 'elevenlabs',
        isHashCurrent: false,
        wordCount: 7,
        durationInSeconds: 2.0,
      },
    },
  };

  const mockStudioStatus: StudioStatusResponse = {
    hasApiKey: true,
    scenes: mockScenesResponse.audioStatus,
  };

  const editorHtml = renderToStaticMarkup(
    React.createElement(SceneScriptEditor, {
      composition: prodComp,
      scenesResponse: mockScenesResponse,
      studioStatus: mockStudioStatus,
      onSaveScene: async () => ({ ok: true }),
      onRefreshScenesAndStatus: () => {},
    })
  );

  assert.match(editorHtml, /Klucz ElevenLabs aktywny/);
  assert.match(editorHtml, /productions\/kronika-neapolu\/production\.json/);
  assert.match(editorHtml, /3 kwestii/);
  assert.match(editorHtml, /Otwarcie w porcie/);
  assert.match(editorHtml, /W porcie w Neapolu zaczyna się nasza historia\./);
  assert.match(editorHtml, />ElevenLabs</);
  assert.match(editorHtml, />Zmieniony tekst</);
  assert.match(editorHtml, />Brak pliku</);
  assert.match(editorHtml, />kapsuła</);
  assert.match(editorHtml, /Krótkofalówka \(radio-walkie\)/);
  assert.match(editorHtml, /Ustawienia głosu ElevenLabs/);
  assert.match(editorHtml, /Zapisz kwestię/);
  assert.match(editorHtml, /Przelicz audio dla kompozycji/);

  // Verify fallback banner when ELEVENLABS_API_KEY is absent
  const trialHtml = renderToStaticMarkup(
    React.createElement(SceneScriptEditor, {
      composition: prodComp,
      scenesResponse: { ...mockScenesResponse, hasApiKey: false },
      studioStatus: { ...mockStudioStatus, hasApiKey: false },
      onSaveScene: async () => ({ ok: true }),
      onRefreshScenesAndStatus: () => {},
    })
  );
  assert.match(trialHtml, /Tryb próbny — deterministyczny fallback/);
});
