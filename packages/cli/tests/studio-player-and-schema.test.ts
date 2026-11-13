import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { BUILT_IN_STYLES, StylePresetSchema } from '../../core/src/index';
import {
  attachPlayerLifecycle,
  useRemotionPlayer,
  type PlayerLifecycleEventName,
  type PlayerLifecycleTarget,
} from '../../studio/src/client/hooks/useRemotionPlayer';
import {
  STUDIO_THEME_STORAGE_KEY,
  useStudioTheme,
} from '../../studio/src/client/hooks/useStudioTheme';
import {
  formatColorWithAlpha,
  introspectPropsFallback,
  introspectZodObject,
  mergeSchemaWithExtraProps,
  parseRgbaOrHex,
} from '../../studio/src/client/schema-form/zodIntrospect';

function createMockPlayer(initialPlaying = false) {
  let playing = initialPlaying;
  let currentFrame = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners = new Map<string, Set<(data: any) => void>>();

  const target: PlayerLifecycleTarget & {
    setInternalPlaying: (next: boolean) => void;
    emitPlay: () => void;
    emitPause: () => void;
    emitEnded: () => void;
    emitSeeked: (frame: number) => void;
    emitFrameUpdate: (frame: number) => void;
    listenerCount: (name: PlayerLifecycleEventName) => number;
  } = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEventListener(name: PlayerLifecycleEventName, callback: (data: any) => void) {
      const set = listeners.get(name) ?? new Set();
      set.add(callback);
      listeners.set(name, set);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeEventListener(name: PlayerLifecycleEventName, callback: (data: any) => void) {
      listeners.get(name)?.delete(callback);
    },
    isPlaying: () => playing,
    getCurrentFrame: () => currentFrame,
    setInternalPlaying(next: boolean) {
      playing = next;
    },
    emitPlay() {
      playing = true;
      for (const cb of listeners.get('play') ?? []) {
        cb({ detail: undefined });
      }
    },
    emitPause() {
      playing = false;
      for (const cb of listeners.get('pause') ?? []) {
        cb({ detail: undefined });
      }
    },
    emitEnded() {
      playing = false;
      for (const cb of listeners.get('ended') ?? []) {
        cb({ detail: undefined });
      }
    },
    emitSeeked(frame: number) {
      currentFrame = frame;
      for (const cb of listeners.get('seeked') ?? []) {
        cb({ detail: { frame } });
      }
    },
    emitFrameUpdate(frame: number) {
      currentFrame = frame;
      for (const cb of listeners.get('frameupdate') ?? []) {
        cb({ detail: { frame } });
      }
    },
    listenerCount(name: PlayerLifecycleEventName) {
      return listeners.get(name)?.size ?? 0;
    },
  };

  return target;
}

test('attachPlayerLifecycle handles mount/unmount/remount, ended when loop=false, seeked, and frameupdate reconciliation', () => {
  let isPlaying = false;
  let displayFrame = 0;
  let measuredFps = 0;
  let fakeClockMs = 1000;

  const player1 = createMockPlayer(false);
  const detach1 = attachPlayerLifecycle(player1, {
    fps: 60,
    now: () => fakeClockMs,
    onFrameChange: (f) => {
      displayFrame = f;
    },
    onPlayingChange: (p) => {
      isPlaying = p;
    },
    onFpsMeasure: (fps) => {
      measuredFps = fps;
    },
  });

  assert.equal(isPlaying, false);
  for (const evt of ['play', 'pause', 'ended', 'seeked', 'frameupdate'] as const) {
    assert.equal(player1.listenerCount(evt), 1, `Expected 1 listener on ${evt}`);
  }

  // 1. play -> frameupdate -> ended (loop === false reaching final frame)
  player1.emitPlay();
  assert.equal(isPlaying, true);

  for (let i = 1; i <= 30; i++) {
    fakeClockMs += 20; // 30 * 20ms = 600ms >= 500ms window -> ~50 FPS
    player1.emitFrameUpdate(i);
  }
  assert.equal(displayFrame, 30);
  assert.equal(measuredFps, 50);

  player1.emitEnded();
  assert.equal(
    isPlaying,
    false,
    'ended event must reset isPlaying=false when loop=false finishes'
  );
  assert.equal(measuredFps, 60);

  // 2. frameupdate reconciles isPlaying if underlying player state drifted without event
  player1.setInternalPlaying(true);
  player1.emitFrameUpdate(31);
  assert.equal(isPlaying, true, 'frameupdate should reconcile false -> true');

  player1.setInternalPlaying(false);
  player1.emitFrameUpdate(32);
  assert.equal(isPlaying, false, 'frameupdate should reconcile true -> false');

  // 3. seeked updates frame cleanly
  player1.emitSeeked(120);
  assert.equal(displayFrame, 120);

  // 4. Unmount while playing resets isPlaying=false and detaches all listeners
  player1.emitPlay();
  assert.equal(isPlaying, true);
  detach1();
  assert.equal(isPlaying, false, 'Unmount detach must reset isPlaying=false');
  for (const evt of ['play', 'pause', 'ended', 'seeked', 'frameupdate'] as const) {
    assert.equal(player1.listenerCount(evt), 0, `Expected 0 listeners on ${evt} after detach`);
  }

  // Stale events on detached player1 do nothing
  player1.emitPlay();
  assert.equal(isPlaying, false);

  // 5. Remount with a fresh player2 that is already playing (e.g. autoplay / HMR)
  const player2 = createMockPlayer(true);
  const detach2 = attachPlayerLifecycle(player2, {
    fps: 60,
    onPlayingChange: (p) => {
      isPlaying = p;
    },
  });
  assert.equal(
    isPlaying,
    true,
    'Remounting an active player synchronously reads player.isPlaying()'
  );

  // Passing null resets isPlaying=false safely
  attachPlayerLifecycle(null, {
    fps: 60,
    onPlayingChange: (p) => {
      isPlaying = p;
    },
  });
  assert.equal(isPlaying, false);
  detach2();
});

test('useRemotionPlayer and useStudioTheme are SSR-safe under renderToStaticMarkup', () => {
  const Probe: React.FC = () => {
    const player = useRemotionPlayer({
      fps: 60,
      durationInFrames: 180,
      resetKey: 'probe-comp',
      initialFrame: 12,
    });
    const theme = useStudioTheme();
    return React.createElement(
      'div',
      {
        'data-frame': player.displayFrame,
        'data-playing': String(player.isPlaying),
        'data-theme-mode': theme.themeMode,
        'data-resolved-theme': theme.resolvedTheme,
      },
      STUDIO_THEME_STORAGE_KEY
    );
  };

  const html = renderToStaticMarkup(React.createElement(Probe));
  assert.match(html, /data-frame="12"/);
  assert.match(html, /data-playing="false"/);
  assert.match(html, /data-theme-mode="system"/);
  assert.match(html, /data-resolved-theme="light"/);
});

test('introspectZodObject supports style-id, textarea, rgba color, string-array, tuple-number, literals, and unions', () => {
  enum RenderQuality {
    Draft = 'draft',
    Final = 'final',
  }

  const AdvancedFilmSchema = z.object({
    styleId: z.string().describe('Kolory & Styl :: Styl bazowy'),
    secondaryStyleId: z.string().default('editorial-press'),
    headline: z.string().max(60).describe('Teksty :: Nagłówek'),
    subtitle: z.string().describe('Teksty :: Podtytuł'),
    longNotes: z.string().max(300).describe('Teksty :: Notatki reżyserskie'),
    glowColor: z.string().describe('Kolory & Styl :: Poświata RGBA'),
    shortHex: z.string().describe('Kolory & Styl :: Akcent krótki'),
    tags: z.array(z.string()).describe('Metadane :: Tagi'),
    channels: z
      .array(z.enum(['shorts', 'reels', 'tiktok']))
      .describe('Metadane :: Kanały publikacji'),
    cameraPosition: z
      .tuple([z.number(), z.number(), z.number()])
      .describe('Kamera :: Pozycja XYZ'),
    aspectPreset: z
      .union([z.literal('16:9'), z.literal('9:16'), z.literal('1:1')])
      .describe('Kamera :: Proporcje'),
    fixedVersion: z.literal('v2').describe('Metadane :: Wersja'),
    quality: z.nativeEnum(RenderQuality).describe('Metadane :: Jakość'),
    cuesMap: z.record(z.number()).describe('Zaawansowane :: Mapa punktów'),
  });

  const sampleProps = {
    styleId: 'minimal-product',
    secondaryStyleId: 'editorial-press',
    headline: 'Krótki tytuł',
    subtitle: 'Dłuższy podtytuł narracyjny',
    longNotes: 'Notatka',
    glowColor: 'rgba(255, 45, 85, 0.45)',
    shortHex: '#0af',
    tags: ['ai', 'wideo'],
    channels: ['shorts', 'reels'],
    cameraPosition: [0, 2.4, 8.5],
    aspectPreset: '16:9',
    fixedVersion: 'v2',
    quality: RenderQuality.Final,
    cuesMap: { intro: 12 },
  };

  const sections = introspectZodObject(AdvancedFilmSchema, sampleProps);
  const byKey = new Map(
    sections.flatMap((s) => s.fields.map((f) => [f.key, f] as const))
  );

  assert.equal(byKey.get('styleId')?.kind, 'style-id');
  assert.equal(byKey.get('secondaryStyleId')?.kind, 'style-id');
  assert.equal(byKey.get('headline')?.kind, 'text');
  assert.equal(byKey.get('subtitle')?.kind, 'textarea');
  assert.equal(byKey.get('longNotes')?.kind, 'textarea');
  assert.equal(byKey.get('glowColor')?.kind, 'color');
  assert.equal(byKey.get('shortHex')?.kind, 'color');

  assert.equal(byKey.get('tags')?.kind, 'string-array');
  assert.equal(byKey.get('channels')?.kind, 'string-array');
  assert.deepEqual(byKey.get('channels')?.options, ['shorts', 'reels', 'tiktok']);

  assert.equal(byKey.get('cameraPosition')?.kind, 'tuple-number');
  assert.equal(byKey.get('cameraPosition')?.tupleLength, 3);

  assert.equal(byKey.get('aspectPreset')?.kind, 'enum');
  assert.deepEqual(byKey.get('aspectPreset')?.options, ['16:9', '9:16', '1:1']);

  assert.equal(byKey.get('fixedVersion')?.kind, 'enum');
  assert.deepEqual(byKey.get('fixedVersion')?.options, ['v2']);

  assert.equal(byKey.get('quality')?.kind, 'enum');
  assert.deepEqual(byKey.get('quality')?.options, ['draft', 'final']);

  assert.equal(byKey.get('cuesMap')?.kind, 'json-value');
});

test('StylePresetSchema introspection preserves exact 6 Polish sections, 8 palette colors, and recommendedFor tags', () => {
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
      'Domyślne Audio',
    ]
  );

  const infoFields = sections.find((s) => s.title === 'Informacje')?.fields ?? [];
  const descField = infoFields.find((f) => f.key === 'description');
  const recField = infoFields.find((f) => f.key === 'recommendedFor');
  assert.equal(descField?.kind, 'textarea');
  assert.equal(recField?.kind, 'string-array');
  assert.equal(recField?.label, 'Polecane zastosowania');

  const colorFields =
    sections
      .find((s) => s.title === 'Paleta kolorów')
      ?.fields.filter((f) => f.kind === 'color') ?? [];
  assert.equal(colorFields.length, 8);
});

test('introspectPropsFallback and mergeSchemaWithExtraProps handle schema-less compositions and extra props', () => {
  const fallbackSections = introspectPropsFallback({
    styleId: 'cyber-telemetry',
    bannerTitle: 'Scena bez Zod',
    quote: 'Każda klatka jest deterministyczna.',
    tintColor: 'rgba(10, 132, 255, 0.8)',
    showGrid: true,
    cameraOffset: [0, 1.5, -4],
    keywords: ['remotion', '60fps'],
    nestedMeta: {
      fov: 45,
    },
  });

  const fallbackByKey = new Map(
    fallbackSections.flatMap((s) => s.fields.map((f) => [f.key, f] as const))
  );
  assert.equal(fallbackByKey.get('styleId')?.kind, 'style-id');
  assert.equal(fallbackByKey.get('bannerTitle')?.kind, 'text');
  assert.equal(fallbackByKey.get('quote')?.kind, 'textarea');
  assert.equal(fallbackByKey.get('tintColor')?.kind, 'color');
  assert.equal(fallbackByKey.get('showGrid')?.kind, 'boolean');
  assert.equal(fallbackByKey.get('cameraOffset')?.kind, 'tuple-number');
  assert.equal(fallbackByKey.get('cameraOffset')?.tupleLength, 3);
  assert.equal(fallbackByKey.get('keywords')?.kind, 'string-array');
  assert.equal(fallbackByKey.get('nestedMeta.fov')?.kind, 'number');

  const BaseSchema = z.object({
    headline: z.string().describe('Teksty :: Nagłówek'),
  });
  const baseSections = introspectZodObject(BaseSchema, { headline: 'Start' });
  const unchanged = mergeSchemaWithExtraProps(baseSections, {
    headline: 'Start',
  });
  assert.equal(unchanged.length, 1);

  const merged = mergeSchemaWithExtraProps(baseSections, {
    headline: 'Start',
    extraSpeed: 1.25,
    extraBadgeColor: '#FF2D55',
  });
  assert.equal(merged.length, 2);
  const extraSec = merged.find((s) => s.title === 'Dodatkowe parametry');
  assert.ok(extraSec);
  assert.deepEqual(
    extraSec.fields.map((f) => ({ key: f.key, kind: f.kind })),
    [
      { key: 'extraSpeed', kind: 'number' },
      { key: 'extraBadgeColor', kind: 'color' },
    ]
  );
});

test('parseRgbaOrHex and formatColorWithAlpha round-trip HEX, short HEX, 8-digit HEX, and RGBA', () => {
  assert.deepEqual(parseRgbaOrHex('#FF2D55'), {
    hex6: '#ff2d55',
    alpha: 1,
    isRgba: false,
  });

  assert.deepEqual(parseRgbaOrHex('#0af'), {
    hex6: '#00aaff',
    alpha: 1,
    isRgba: false,
  });

  const hex8 = parseRgbaOrHex('#FF2D5580');
  assert.equal(hex8.hex6, '#ff2d55');
  assert.equal(hex8.alpha, 0.5);
  assert.equal(hex8.isRgba, false);

  assert.deepEqual(parseRgbaOrHex('rgba(255, 45, 85, 0.35)'), {
    hex6: '#ff2d55',
    alpha: 0.35,
    isRgba: true,
  });

  assert.equal(formatColorWithAlpha('#ff2d55', 1), '#FF2D55');
  assert.equal(formatColorWithAlpha('#ff2d55', 1, true), 'rgba(255, 45, 85, 1)');
  assert.equal(
    formatColorWithAlpha('#ff2d55', 0.35),
    'rgba(255, 45, 85, 0.35)'
  );
});
