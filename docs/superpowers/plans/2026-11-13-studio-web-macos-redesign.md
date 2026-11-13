# Studio Web macOS „Liquid Glass Stage” Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Przebudować `@make-pictures/studio` (`Studio Web` oraz `🎨 Style Lab`) do architektury **macOS Tahoe / iOS 18+ „Liquid Glass Stage”** z adaptacyjnym motywem `Light/Dark/System`, selektorem projektów i stylów `⌘K` w pasku górnym `48px`, niezawodnym cyklem życia odtwarzacza `useRemotionPlayer`, pływającą kapsułą transportu, zwijaną szufladą osi reżyserskiej oraz pełnym 3-zakładkowym inspektorem (`Parametry | Skrypt & Audio | JSON`) z edycją scenariusza na dysku i responsywnością Desktop / iPad / iOS.

**Architecture:** Serwer lokalny Vite (`packages/studio/src/server/index.ts`) zostaje rozszerzony o atomowy odczyt i zapis scen (`GET/POST /api/studio/scenes` dla `scenes.json` oraz kapsuł `productions/<slug>/production.json`). Warstwa kliencka wydziela deterministyczną maszynę stanów odtwarzacza (`useRemotionPlayer` z callback-ref i przechwytującą obsługą klawisza `Space`), zarządcę motywu (`useStudioTheme`) i pełną introspekcję `zod` (`zodIntrospect.ts`), a następnie zastępuje stały trójkolumnowy układ dwukolumnową sceną „Liquid Glass” ze zwijanym prawym inspektorem i dolnymi arkuszami mobilnymi `100dvh`.

**Tech Stack:** TypeScript 5 (`strict`), React 18/19, `@remotion/player` (`60 FPS`), `zod` 3, `lucide-react`, Vite Server Middleware, Node.js `node:test` + `tsx`.

## Global Constraints

- Zachować 100% istniejących punktów końcowych serwera (`/api/studio/status`, `/api/studio/styles`, `/api/studio/qa-sheet`, `/api/studio/props`, `/api/studio/voiceover`, `/api/studio/render`, `/api/studio/qa`, `/api/studio/open-output`) oraz dotychczasowych eksportów pakietu `@make-pictures/studio/client` (`StudioApp`, `Topbar`, `LeftSidebar`, `StyleCatalogSidebar`, `StyleLabShowcase`, `PropsInspector`, `StageViewport`, `introspectZodObject`).
- Nigdy nie zwracać wartości `ELEVENLABS_API_KEY` przez HTTP — udostępniać wyłącznie flagę `hasApiKey: boolean`.
- Wszystkie zapisy plików JSON na dysku wykonywać wyłącznie wewnątrz zweryfikowanych katalogów (`path.resolve` + sprawdzenie prefiksu ścieżki, odrzucanie `..`) w sposób atomowy poprzez plik tymczasowy `<target>.tmp-${process.pid}` i `fs.renameSync`.
- Zachować pełną kompatybilność sekcji `introspectZodObject(StylePresetSchema, ...)` (`['Informacje', 'Paleta kolorów', 'Typografia', 'Powierzchnia & Tło', 'Fizyka ruchu', 'Domyślne Audio']` oraz 8 pól `'color'` w `'Paleta kolorów'`).
- Wszystkie liczniki klatek, kody czasowe, odznaki FPS i pola numeryczne muszą stosować `font-variant-numeric: tabular-nums`.
- Interfejs użytkownika utrzymywać w języku polskim z zachowaniem zasad *Sentence case* zgodnie z `AGENTS.md`.

## File Map

- **Modify:** `packages/studio/src/server/index.ts` — dodanie czystych funkcji `readStudioScenesFromDisk`, `saveStudioSceneToDisk` oraz tras `GET/POST /api/studio/scenes`.
- **Create:** `packages/cli/tests/studio-scenes-api.test.ts` — testy jednostkowe i HTTP odczytu/zapisu scen, synchronizacji `durationInFrames`, ochrony ścieżek i detekcji zmiany skrótu SHA-256 audio.
- **Modify:** `packages/core/src/style/schema.ts` — dodanie `.describe('Informacje :: Polecane zastosowania')` na polu `recommendedFor`.
- **Modify:** `packages/studio/src/client/types.ts` — definicje `StudioCapsuleScenesGroup`, `StudioScenesResponse`, `SaveStudioScenePayload` oraz `InspectorTabId`.
- **Create:** `packages/studio/src/client/hooks/useRemotionPlayer.ts` — czysta funkcja `attachPlayerLifecycle` oraz hook `useRemotionPlayer` eliminujący wszystkie błędy Play/Pause.
- **Create:** `packages/studio/src/client/hooks/useStudioTheme.ts` — hook `useStudioTheme` (`'system' | 'light' | 'dark'`) synchronizujący `data-theme` i `localStorage`.
- **Modify:** `packages/studio/src/client/schema-form/zodIntrospect.ts` — obsługa `style-id`, `textarea`, `RGBA` (`parseRgbaOrHex` / `formatColorWithAlpha`), `string-array`, `tuple-number`, `ZodUnion`/`ZodLiteral`, `introspectPropsFallback` i `mergeSchemaWithExtraProps`.
- **Create:** `packages/cli/tests/studio-player-and-schema.test.ts` — testy jednostkowe `attachPlayerLifecycle` i rozszerzonej introspekcji `zodIntrospect.ts`.
- **Modify:** `packages/studio/src/client/styles.css` — kompletny system stylów macOS Tahoe / iOS 18+ „Liquid Glass” (`Light` + `Dark` + responsywne progi `>=1100px`, `768–1099px`, `<768px`).
- **Create:** `packages/studio/src/client/components/ProjectPickerPopover.tsx` — paleta projektów i katalogu stylów otwierana z paska górnego lub skrótem `⌘K`.
- **Modify:** `packages/studio/src/client/components/Topbar.tsx` — pasek `48px` z wyzwalaczem projektu `⌘K`, przełącznikiem widoku, wskaźnikiem FPS, eksportem MP4, przełącznikiem motywu i przyciskiem inspektora `⌘I`.
- **Modify:** `packages/studio/src/client/components/StageViewport.tsx` — integracja `useRemotionPlayer`, pływającej kapsuły `.mp-floating-transport`, popovera siatek reżyserskich oraz zwijanej szuflady `.mp-bottom-drawer`.
- **Modify:** `packages/studio/src/client/components/StyleLabShowcase.tsx` — integracja `useRemotionPlayer`, górnej listwy 7 kitów i pływającej kapsuły transportu.
- **Create:** `packages/studio/src/client/components/SceneScriptEditor.tsx` — zakładka `Skrypt & Audio` edytująca sceny z `GET/POST /api/studio/scenes` i wyzwalająca strumień SSE `/api/studio/voiceover`.
- **Modify:** `packages/studio/src/client/components/PropsInspector.tsx` — 3-zakładkowy inspektor (`Parametry | Skrypt & Audio | JSON`), wyszukiwarka pól, zwijane sekcje, reset pojedynczego pola `↺` i pełen zestaw formantów.
- **Modify:** `packages/studio/src/client/StudioApp.tsx` i `packages/studio/src/client/index.ts` — spięcie dwukolumnowego obszaru roboczego, skrótów `⌘K` / `⌘I` / `⌘S`, responsywnych przesłon mobilnych oraz eksportów publicznych.

---

### Task 1: Local Server Scene & Script API (`GET/POST /api/studio/scenes`)

**Files:**
- Modify: `packages/studio/src/server/index.ts`
- Test: `packages/cli/tests/studio-scenes-api.test.ts`

**Interfaces:**
- Consumes: `SceneDefinition`, `VoiceAcousticPreset`, `VoiceSettingsConfig`, `ProductionManifest`, `ScenesManifest` z `packages/core/src/types/scene.ts`.
- Produces:
  - `readStudioScenesFromDisk(rootDir: string, studioDir: string): { ok: true; hasApiKey: boolean; groups: Array<{ id: string; title: string; origin: 'root' | 'production'; manifestFile: string; fps: number; scenes: SceneDefinition[] }>; audioStatus: Record<string, SceneAudioStatusItem> }`
  - `saveStudioSceneToDisk(rootDir: string, studioDir: string, payload: { targetId?: unknown; sceneId?: unknown; patch?: unknown }): { statusCode: number; body: Record<string, unknown> }`
  - Endpointy HTTP `GET /api/studio/scenes` oraz `POST /api/studio/scenes` w `makePicturesStudioServerPlugin`.

- [ ] **Step 1: Utwórz test `packages/cli/tests/studio-scenes-api.test.ts` weryfikujący odczyt, atomowy zapis i walidację bezpieczeństwa**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  makePicturesStudioServerPlugin,
  readStudioScenesFromDisk,
  saveStudioSceneToDisk,
} from '../../studio/src/server/index';

test('readStudioScenesFromDisk and saveStudioSceneToDisk manage root scenes.json and capsule production.json safely', () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-studio-scenes-'));
  try {
    fs.writeFileSync(
      path.join(studioDir, 'scenes.json'),
      JSON.stringify(
        {
          project: {
            title: 'Główny projekt',
            fps: 60,
            defaultResolution: { width: 1920, height: 1080 },
            uhdResolution: { width: 3840, height: 2160 },
          },
          scenes: [
            {
              id: 'intro-root',
              title: 'Wstęp',
              durationInSeconds: 4,
              durationInFrames: 240,
              text: 'Witaj w studiu filmowym.',
              cues: { hero: 18 },
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );

    const capsuleDir = path.join(studioDir, 'productions', 'kronika-kawy');
    const voDir = path.join(capsuleDir, 'assets', 'voiceovers');
    fs.mkdirSync(voDir, { recursive: true });
    const initialText = 'Pierwsze ziarna kawowca odkryto w Etiopii.';
    const initialHash = crypto.createHash('sha256').update(initialText, 'utf8').digest('hex');

    fs.writeFileSync(
      path.join(capsuleDir, 'production.json'),
      JSON.stringify(
        {
          id: 'kronika-kawy',
          title: 'Kronika Kawy',
          fps: 60,
          score: { id: 'main-score', mode: 'procedural-fallback', moodPreset: 'warm-story' },
          scenes: [
            {
              id: 'akt-1',
              title: 'Akt I',
              durationInSeconds: 5,
              durationInFrames: 300,
              text: initialText,
              speaker: 'Narrator',
              triggerWords: { Etiopii: 'map-zoom' },
            },
          ],
        },
        null,
        2
      ),
      'utf8'
    );
    fs.writeFileSync(path.join(voDir, 'akt-1.mp3'), 'fake-mp3', 'utf8');
    fs.writeFileSync(
      path.join(voDir, 'akt-1.json'),
      JSON.stringify({
        sceneId: 'akt-1',
        text: initialText,
        textHash: initialHash,
        voiceId: 'v1',
        modelId: 'eleven_v3',
        provider: 'elevenlabs',
        fps: 60,
        durationInSeconds: 5,
        audioFile: 'akt-1.mp3',
        generatedAt: '2026-11-13T00:00:00.000Z',
        words: [{ word: 'Pierwsze', normalizedWord: 'pierwsze', start: 0, end: 0.4, startFrame: 0, endFrame: 24 }],
      }),
      'utf8'
    );

    const initialRead = readStudioScenesFromDisk(studioDir, studioDir);
    assert.equal(initialRead.ok, true);
    assert.deepEqual(initialRead.groups.map((g) => g.id), ['root', 'kronika-kawy']);
    assert.equal(initialRead.audioStatus['akt-1']?.isHashCurrent, true);

    const updated = saveStudioSceneToDisk(studioDir, studioDir, {
      targetId: 'kronika-kawy',
      sceneId: 'akt-1',
      patch: {
        text: 'Nowa wersja narracji o palarniach w Wenecji.',
        durationInSeconds: 6.5,
        voiceEffect: 'cathedral',
        voiceSettings: { stability: 0.55, speed: 1.05, useSpeakerBoost: true },
      },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.ok, true);

    const persistedCapsule = JSON.parse(
      fs.readFileSync(path.join(capsuleDir, 'production.json'), 'utf8')
    );
    assert.equal(persistedCapsule.score.id, 'main-score');
    assert.equal(persistedCapsule.scenes[0].durationInFrames, 390);
    assert.equal(persistedCapsule.scenes[0].voiceEffect, 'cathedral');
    assert.deepEqual(persistedCapsule.scenes[0].triggerWords, { Etiopii: 'map-zoom' });

    const afterRead = readStudioScenesFromDisk(studioDir, studioDir);
    assert.equal(afterRead.audioStatus['akt-1']?.isHashCurrent, false);

    assert.equal(
      saveStudioSceneToDisk(studioDir, studioDir, {
        targetId: '../escape',
        sceneId: 'akt-1',
        patch: { text: 'x' },
      }).statusCode,
      400
    );
    assert.equal(
      saveStudioSceneToDisk(studioDir, studioDir, {
        targetId: 'kronika-kawy',
        sceneId: 'nie-istnieje',
        patch: { text: 'x' },
      }).statusCode,
      404
    );
    assert.equal(
      saveStudioSceneToDisk(studioDir, studioDir, {
        targetId: 'kronika-kawy',
        sceneId: 'akt-1',
        patch: { durationInSeconds: -3 },
      }).statusCode,
      400
    );
    assert.equal(
      saveStudioSceneToDisk(studioDir, studioDir, {
        targetId: 'kronika-kawy',
        sceneId: 'akt-1',
        patch: { voiceEffect: 'alien-flanger' },
      }).statusCode,
      400
    );
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});

test('makePicturesStudioServerPlugin serves GET and POST /api/studio/scenes', async () => {
  const studioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-studio-scenes-http-'));
  try {
    const prodDir = path.join(studioDir, 'productions', 'film-startowy');
    fs.mkdirSync(prodDir, { recursive: true });
    fs.writeFileSync(
      path.join(prodDir, 'production.json'),
      JSON.stringify({
        id: 'film-startowy',
        title: 'Film Startowy',
        fps: 60,
        scenes: [{ id: 'scena-1', title: 'Scena 1', durationInSeconds: 3, text: 'Start.' }],
      }),
      'utf8'
    );

    const plugin = makePicturesStudioServerPlugin({ rootDir: studioDir, studioDir });
    type MiddlewareFn = (
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: unknown) => void
    ) => void;
    let middleware: MiddlewareFn | null = null;
    const fakeServer = {
      middlewares: {
        use(fn: MiddlewareFn) {
          middleware = fn;
        },
      },
    };
    const hook = plugin.configureServer;
    if (typeof hook === 'function') {
      (hook as (server: unknown) => void)(fakeServer);
    }
    assert.ok(middleware);

    const invoke = (method: string, url: string, body?: Record<string, unknown>) =>
      new Promise<{ statusCode: number; json: Record<string, unknown> }>((resolve, reject) => {
        const req = new EventEmitter() as IncomingMessage;
        req.method = method;
        req.url = url;
        let out = '';
        const res = {
          statusCode: 200,
          writableEnded: false,
          setHeader() {},
          end(chunk?: string) {
            if (chunk) out += chunk;
            resolve({ statusCode: res.statusCode, json: JSON.parse(out) });
          },
        } as unknown as ServerResponse;
        middleware!(req, res, (err) => reject(err ?? new Error('next called')));
        if (body) req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'));
        req.emit('end');
      });

    const postRes = await invoke('POST', '/api/studio/scenes', {
      targetId: 'film-startowy',
      sceneId: 'scena-1',
      patch: { text: 'Zaktualizowany tekst lektora.' },
    });
    assert.equal(postRes.statusCode, 200);
    assert.equal(postRes.json.ok, true);

    const getRes = await invoke('GET', '/api/studio/scenes');
    assert.equal(getRes.statusCode, 200);
    const groups = getRes.json.groups as Array<{ id: string; scenes: Array<{ text: string }> }>;
    assert.equal(groups[0]?.scenes[0]?.text, 'Zaktualizowany tekst lektora.');
  } finally {
    fs.rmSync(studioDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Uruchom test, aby potwierdzić początkowe niepowodzenie (brak eksportów)**

Run: `npx tsx --test packages/cli/tests/studio-scenes-api.test.ts`  
Expected: FAIL (`readStudioScenesFromDisk` / `saveStudioSceneToDisk` nie są jeszcze wyeksportowane z `packages/studio/src/server/index.ts`).

- [ ] **Step 3: Zaimplementuj `readStudioScenesFromDisk`, `saveStudioSceneToDisk` i trasy `/api/studio/scenes` w `packages/studio/src/server/index.ts`**

Dodaj stałą `VALID_VOICE_EFFECTS` oraz obie funkcje w `packages/studio/src/server/index.ts` i podepnij `GET /api/studio/scenes` oraz `POST /api/studio/scenes` w `makePicturesStudioServerPlugin`:

```ts
const VALID_VOICE_EFFECTS = new Set([
  'clean',
  'telephone',
  'radio-walkie',
  'cathedral',
  'megaphone',
  'excitement-boost',
]);

export interface StudioScenesGroup {
  id: string;
  title: string;
  origin: 'root' | 'production';
  manifestFile: string;
  fps: number;
  scenes: SceneDefinition[];
}

export function readStudioScenesFromDisk(
  rootDir: string,
  studioDir: string
): {
  ok: true;
  hasApiKey: boolean;
  groups: StudioScenesGroup[];
  audioStatus: Record<string, SceneAudioStatusItem>;
} {
  const status = collectAudioStatus(rootDir, studioDir);
  const groups: StudioScenesGroup[] = [];

  const rootScenesPath = path.resolve(studioDir, 'scenes.json');
  if (fs.existsSync(rootScenesPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(rootScenesPath, 'utf8')) as ScenesManifest;
      if (Array.isArray(parsed.scenes)) {
        groups.push({
          id: 'root',
          title: parsed.project?.title ?? 'Główny manifest (scenes.json)',
          origin: 'root',
          manifestFile: 'scenes.json',
          fps: typeof parsed.project?.fps === 'number' ? parsed.project.fps : 60,
          scenes: parsed.scenes,
        });
      }
    } catch {
      // Pomijamy uszkodzony JSON podczas ręcznej edycji pliku
    }
  }

  const productionsDir = path.resolve(studioDir, 'productions');
  if (fs.existsSync(productionsDir)) {
    try {
      const slugs = fs
        .readdirSync(productionsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.') && PROD_SLUG_PATTERN.test(d.name))
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));

      for (const slug of slugs) {
        const manifestPath = path.join(productionsDir, slug, 'production.json');
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ProductionManifest;
          if (Array.isArray(parsed.scenes)) {
            groups.push({
              id: slug,
              title: parsed.title ?? slug,
              origin: 'production',
              manifestFile: `productions/${slug}/production.json`,
              fps: typeof parsed.fps === 'number' ? parsed.fps : 60,
              scenes: parsed.scenes,
            });
          }
        } catch {
          // Pomijamy uszkodzony manifest kapsuły
        }
      }
    } catch {
      // Ignorujemy błąd odczytu katalogu productions/
    }
  }

  return {
    ok: true,
    hasApiKey: status.hasApiKey,
    groups,
    audioStatus: status.scenes,
  };
}
```

W `saveStudioSceneToDisk` rozstrzygaj `targetId === '__root__'` (oraz `targetId === 'root'`, gdy nie istnieje `productions/root`) do `<studioDir>/scenes.json`, a pozostałe poprawne identyfikatory `PROD_SLUG_PATTERN` do `<studioDir>/productions/<slug>/production.json` (z weryfikacją `resolved.startsWith(productionsDir + path.sep)`), waliduj `sceneId` i pola `patch` (`text`, `title`, `speaker`, `voiceId`, `durationInSeconds` z aktualizacją `durationInFrames = Math.round(durationInSeconds * fps)`, `voiceEffect`, `voiceSettings`), zachowuj wszystkie pozostałe właściwości obiektu i zapisuj atomowo przez `.tmp-${process.pid}` + `fs.renameSync`.

- [ ] **Step 4: Uruchom testy jednostkowe i kontrolę typów**

Run: `npx tsx --test packages/cli/tests/studio-scenes-api.test.ts packages/cli/tests/studio-styles-api.test.ts && npm run typecheck`  
Expected: PASS (wszystkie testy zielone, `typecheck` zwraca kod `0`).

- [ ] **Step 5: Zatwierdź zmiany w Git**

```bash
git add packages/studio/src/server/index.ts packages/cli/tests/studio-scenes-api.test.ts
git commit -m "feat(studio): add GET/POST /api/studio/scenes server API with atomic manifest updates"
```

---

### Task 2: `useRemotionPlayer`, `useStudioTheme` & Full Zod Introspection (`zodIntrospect.ts`)

**Files:**
- Modify: `packages/core/src/style/schema.ts:90`
- Modify: `packages/studio/src/client/types.ts`
- Create: `packages/studio/src/client/hooks/useRemotionPlayer.ts`
- Create: `packages/studio/src/client/hooks/useStudioTheme.ts`
- Modify: `packages/studio/src/client/schema-form/zodIntrospect.ts`
- Test: `packages/cli/tests/studio-player-and-schema.test.ts`

**Interfaces:**
- Consumes: `PlayerRef` z `@remotion/player`, `AnyZodObject` / `ZodTypeAny` z `zod`, `SceneDefinition` z `@make-pictures/core`.
- Produces:
  - `attachPlayerLifecycle(player, callbacks): () => void` oraz `useRemotionPlayer(options): UseRemotionPlayerResult`
  - `useStudioTheme(): { themeMode: StudioThemeMode; resolvedTheme: 'light' | 'dark'; setThemeMode: (m: StudioThemeMode) => void; cycleThemeMode: () => void }`
  - Rozszerzony `InspectorFieldKind` (`'text' | 'textarea' | 'color' | 'style-id' | 'range' | 'number' | 'boolean' | 'enum' | 'string-array' | 'tuple-number' | 'json-value'`), `introspectPropsFallback`, `mergeSchemaWithExtraProps`, `parseRgbaOrHex`, `formatColorWithAlpha`.
  - Typy `StudioCapsuleScenesGroup`, `StudioScenesResponse`, `SaveStudioScenePayload`, `InspectorTabId = 'params' | 'script' | 'json'` w `packages/studio/src/client/types.ts`.

- [ ] **Step 1: Napisz test `packages/cli/tests/studio-player-and-schema.test.ts` pokrywający cykl życia odtwarzacza i nowe reguły `zodIntrospect`**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import { BUILT_IN_STYLES, StylePresetSchema } from '../../core/src/index';
import { attachPlayerLifecycle } from '../../studio/src/client/hooks/useRemotionPlayer';
import {
  formatColorWithAlpha,
  introspectPropsFallback,
  introspectZodObject,
  mergeSchemaWithExtraProps,
  parseRgbaOrHex,
} from '../../studio/src/client/schema-form/zodIntrospect';

class MockPlayerRef extends EventEmitter {
  public playing = false;
  isPlaying() {
    return this.playing;
  }
  addEventListener(evt: string, fn: (...args: unknown[]) => void) {
    this.on(evt, fn);
  }
  removeEventListener(evt: string, fn: (...args: unknown[]) => void) {
    this.off(evt, fn);
  }
}

test('attachPlayerLifecycle handles play, pause, ended (loop=false), frameupdate reconciliation, and unmount cleanup', () => {
  const mock = new MockPlayerRef();
  const states: boolean[] = [];
  const frames: number[] = [];

  const detach = attachPlayerLifecycle(mock as never, {
    fps: 60,
    onPlayingState: (p) => states.push(p),
    onFrame: (f) => frames.push(f),
    onFps: () => {},
  });

  assert.deepEqual(states, [false]);
  mock.playing = true;
  mock.emit('play');
  assert.equal(states.at(-1), true);

  mock.emit('frameupdate', { detail: { frame: 42 } });
  assert.deepEqual(frames, [42]);

  // Koniec odtwarzania przy loop=false emituje 'ended'
  mock.playing = false;
  mock.emit('ended');
  assert.equal(states.at(-1), false);

  detach();
  mock.playing = true;
  mock.emit('play');
  assert.equal(states.at(-1), false);
});

test('introspectZodObject supports style-id, textarea, rgba colors, string-array, tuple-number, and unions while preserving StylePresetSchema sections', () => {
  const ComplexSchema = z.object({
    styleId: z.string().describe('Styl :: Styl bazowy'),
    quoteBody: z.string().max(240).describe('Treść :: Cytat przewodni'),
    glowTint: z.string().describe('Kolory :: Poświata RGBA'),
    tags: z.array(z.string()).describe('Treść :: Tagi odcinka'),
    cameraPos: z.tuple([z.number(), z.number(), z.number()]).describe('Kamera :: Pozycja XYZ'),
    align: z.union([z.literal('left'), z.literal('center'), z.literal('right')]).describe('Układ :: Wyrównanie'),
  });

  const sections = introspectZodObject(ComplexSchema, {
    styleId: 'editorial-press',
    quoteBody: 'Krótki tekst',
    glowTint: 'rgba(0, 122, 255, 0.45)',
    tags: ['kawa', 'historia'],
    cameraPos: [0, 1.5, 6],
    align: 'center',
  });

  const flat = new Map(sections.flatMap((s) => s.fields).map((f) => [f.key, f]));
  assert.equal(flat.get('styleId')?.kind, 'style-id');
  assert.equal(flat.get('quoteBody')?.kind, 'textarea');
  assert.equal(flat.get('glowTint')?.kind, 'color');
  assert.equal(flat.get('tags')?.kind, 'string-array');
  assert.equal(flat.get('cameraPos')?.kind, 'tuple-number');
  assert.equal(flat.get('cameraPos')?.tupleLength, 3);
  assert.equal(flat.get('align')?.kind, 'enum');
  assert.deepEqual(flat.get('align')?.options, ['left', 'center', 'right']);

  const parsedRgba = parseRgbaOrHex('rgba(255, 45, 85, 0.5)');
  assert.equal(parsedRgba.hex6, '#ff2d55');
  assert.equal(parsedRgba.alpha, 0.5);
  assert.equal(formatColorWithAlpha('#ff2d55', 0.5, true), 'rgba(255, 45, 85, 0.5)');

  const fallback = introspectPropsFallback({ title: 'Demo', count: 3, active: true });
  assert.equal(fallback.flatMap((s) => s.fields).length, 3);

  const merged = mergeSchemaWithExtraProps(sections, {
    styleId: 'editorial-press',
    customExtraFlag: true,
  });
  assert.ok(merged.some((s) => s.title === 'Dodatkowe parametry'));

  // Niezmiennik kompatybilności wstecznej dla StylePresetSchema:
  const styleSections = introspectZodObject(
    StylePresetSchema,
    BUILT_IN_STYLES['editorial-press'] as unknown as Record<string, unknown>
  );
  assert.deepEqual(
    styleSections.map((s) => s.title),
    [
      'Informacje',
      'Paleta kolorów',
      'Typografia',
      'Powierzchnia & Tło',
      'Fizyka ruchu',
      'Domyślne Audio',
    ]
  );
  const infoFields = styleSections.find((s) => s.title === 'Informacje')?.fields ?? [];
  assert.equal(infoFields.find((f) => f.key === 'recommendedFor')?.kind, 'string-array');
});
```

- [ ] **Step 2: Uruchom test, aby potwierdzić niepowodzenie przed implementacją**

Run: `npx tsx --test packages/cli/tests/studio-player-and-schema.test.ts`  
Expected: FAIL (`Cannot find module '../../studio/src/client/hooks/useRemotionPlayer'`).

- [ ] **Step 3: Zaktualizuj `packages/core/src/style/schema.ts`, `packages/studio/src/client/types.ts`, `useStudioTheme.ts`, `useRemotionPlayer.ts` oraz `zodIntrospect.ts`**

1. W `packages/core/src/style/schema.ts` linia 90 zmień:
   ```ts
   recommendedFor: z.array(z.string()).default([]).describe('Informacje :: Polecane zastosowania'),
   ```
2. W `packages/studio/src/client/types.ts` dodaj interfejsy `StudioCapsuleScenesGroup`, `StudioScenesResponse`, `SaveStudioScenePayload` oraz `export type InspectorTabId = 'params' | 'script' | 'json';`.
3. W `packages/studio/src/client/hooks/useStudioTheme.ts` zaimplementuj SSR-safe hook z odczytem/zapisem `localStorage.getItem('mp-studio-theme')`, nasłuchiwaniem `matchMedia('(prefers-color-scheme: dark)')` i synchronizacją `document.documentElement.dataset.theme`.
4. W `packages/studio/src/client/hooks/useRemotionPlayer.ts` zaimplementuj `attachPlayerLifecycle` (obsługujący `'play'`, `'pause'`, `'ended'`, `'seeked'`, `'frameupdate'`) oraz hook `useRemotionPlayer` używający `playerRefCallback` (`setPlayerInstance`) i przechwytującego listenera `window.addEventListener('keydown', onKeyDown, true)` blokującego podwójną aktywację `Space` na sfokusowanym `<button>`.
5. W `packages/studio/src/client/schema-form/zodIntrospect.ts` dodaj pełną obsługę `'style-id'`, `'textarea'`, `'color'` (HEX + RGBA), `'string-array'`, `'tuple-number'`, `'enum'` dla `ZodLiteral`/`ZodNativeEnum`/`ZodUnion`, `'json-value'`, `introspectPropsFallback`, `mergeSchemaWithExtraProps`, `parseRgbaOrHex` i `formatColorWithAlpha`.

- [ ] **Step 4: Uruchom testy jednostkowe i kontrolę typów**

Run: `npx tsx --test packages/cli/tests/studio-player-and-schema.test.ts packages/cli/tests/studio-styles-api.test.ts && npm run typecheck`  
Expected: PASS (100% asercji przechodzi, w tym test sekcji `StylePresetSchema`).

- [ ] **Step 5: Zatwierdź zmiany w Git**

```bash
git add packages/core/src/style/schema.ts packages/studio/src/client/types.ts packages/studio/src/client/hooks/useRemotionPlayer.ts packages/studio/src/client/hooks/useStudioTheme.ts packages/studio/src/client/schema-form/zodIntrospect.ts packages/cli/tests/studio-player-and-schema.test.ts
git commit -m "feat(studio): add useRemotionPlayer lifecycle fix, useStudioTheme, and full Zod introspection"
```

---

### Task 3: Adaptive macOS Tahoe / iOS 18+ Liquid Glass Stylesheet (`styles.css`)

**Files:**
- Modify: `packages/studio/src/client/styles.css`

**Interfaces:**
- Consumes: atrybut `[data-theme="light" | "dark"]` ustawiany na `<html>` przez `useStudioTheme`.
- Produces: kompletny kontrakt klas CSS dla nowego układu `.mp-shell`, `.mp-topbar`, `.mp-project-trigger`, `.mp-project-popover`, `.mp-workspace` / `.is-inspector-closed`, `.mp-floating-dock-wrap`, `.mp-floating-transport`, `.mp-play-fab`, `.mp-overlays-popover`, `.mp-bottom-drawer`, `.mp-sidebar-right`, `.mp-inspector-tabs`, `.mp-style-picker-grid`, `.mp-tag-chip`, `.mp-tuple-grid`, `.mp-script-card`, `.mp-json-textarea` wraz z zachowaniem stylizacji dla klas wstecznie kompatybilnych (`.mp-sidebar-left`, `.mp-style-card`, `.mp-empty-studio-screen`, `.mp-qa-modal-backdrop`, `.mp-error-card`).

- [ ] **Step 1: Zdefiniuj adaptacyjne tokeny Liquid Glass (`:root`, `[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`) w `packages/studio/src/client/styles.css`**

Skonfiguruj zmienne jasnego i ciemnego szkła:
```css
:root {
  --mp-stage-canvas: #f2f2f7;
  --mp-glass-bg: rgba(255, 255, 255, 0.74);
  --mp-glass-elevated: rgba(255, 255, 255, 0.88);
  --mp-glass-blur: blur(28px) saturate(190%);
  --mp-border-subtle: rgba(15, 23, 42, 0.08);
  --mp-specular-inset: inset 0 0.5px 0 rgba(255, 255, 255, 0.85);
  --mp-accent: #007aff;
  --mp-coral: #ff2d55;
  --mp-success: #34c759;
  --mp-text-primary: #1c1c1e;
  --mp-text-secondary: #636366;
  --mp-text-muted: #8e8e93;
  --mp-font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif;
  --mp-font-mono: 'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace;
  --mp-ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
}

[data-theme='dark'] {
  --mp-stage-canvas: #0b0c0f;
  --mp-glass-bg: rgba(28, 28, 33, 0.74);
  --mp-glass-elevated: rgba(40, 40, 48, 0.84);
  --mp-border-subtle: rgba(255, 255, 255, 0.09);
  --mp-specular-inset: inset 0 0.5px 0 rgba(255, 255, 255, 0.12);
  --mp-accent: #0a84ff;
  --mp-coral: #ff375f;
  --mp-success: #30d158;
  --mp-text-primary: #f5f5f7;
  --mp-text-secondary: #a1a1a6;
  --mp-text-muted: #6e6e73;
}
```
Zduplikuj blok ciemnych zmiennych wewnątrz `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ... } }`.

- [ ] **Step 2: Zaimplementuj style komponentów sceny, kapsuły transportu, popovera `⌘K`, 3-zakładkowego inspektora oraz 3 progów responsywnych (`@media (max-width: 1099px)`, `@media (max-width: 767px)`, `prefers-reduced-motion`)**

Upewnij się, że:
- `.mp-shell` używa `height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden;`
- `.mp-workspace` na desktopie używa `grid-template-columns: minmax(0, 1fr) 368px` oraz `.mp-workspace.is-inspector-closed { grid-template-columns: minmax(0, 1fr) 0px; }`
- na `max-width: 1099px` `.mp-sidebar-right` przechodzi w pływającą szklaną szufladę (`position: fixed; top: 56px; right: 10px; bottom: 10px; border-radius: 20px`) z przesłoną `.mp-inspector-backdrop`
- na `max-width: 767px` `.mp-project-popover` (`max-height: 82dvh`) oraz `.mp-sidebar-right` (`max-height: 68dvh`) stają się dolnymi arkuszami iOS (`border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom)`) z widocznym uchwytem `.mp-sheet-grabber`.

- [ ] **Step 3: Zweryfikuj poprawność bundlowania i testów pakietu**

Run: `npm run typecheck && npx tsx --test packages/cli/tests/studio-styles-api.test.ts`  
Expected: PASS.

- [ ] **Step 4: Zatwierdź zmiany w Git**

```bash
git add packages/studio/src/client/styles.css
git commit -m "feat(studio): implement macOS Tahoe / iOS 18 Liquid Glass adaptive stylesheet"
```

---

### Task 4: Minimalist `Topbar`, `ProjectPickerPopover` (`⌘K`), Floating Transport Capsule & Drawer

**Files:**
- Create: `packages/studio/src/client/components/ProjectPickerPopover.tsx`
- Modify: `packages/studio/src/client/components/Topbar.tsx`
- Modify: `packages/studio/src/client/components/StageViewport.tsx`
- Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`

**Interfaces:**
- Consumes: `useRemotionPlayer` z Task 2, `StudioThemeMode` z `useStudioTheme`, `DirectorTimelinePanel`, `LiveTranscriptBar`, `DirectorOverlays`, klasy CSS z Task 3.
- Produces:
  - `ProjectPickerPopover` z wyszukiwarką, filtrami `Wszystkie | Produkcje | Przykłady`, obsługą strzałek/Enter/Escape oraz katalogiem i duplikowaniem stylów dla `Style Lab`.
  - Przebudowany `Topbar` z wyzwalaczem projektu/stylu `⌘K`, przełącznikiem widoku, pigułką `60 FPS`, przyciskiem motywu i przełącznikiem prawego inspektora `⌘I`.
  - `StageViewport` oraz `StyleLabShowcase` korzystające z `ref={player.playerRefCallback}`, pływającej kapsuły `.mp-floating-transport` oraz zwijanej dolnej szuflady `.mp-bottom-drawer`.

- [ ] **Step 1: Utwórz `packages/studio/src/client/components/ProjectPickerPopover.tsx`**

Zaimplementuj komponent obsługujący oba widoki (`viewMode: 'films' | 'styles'`):
- automatyczny fokus pola wyszukiwania po otwarciu,
- zamykanie klawiszem `Escape` oraz kliknięciem w `.mp-popover-backdrop`,
- w trybie `'films'`: filtrowanie kompozycji, zakładki źródła (`all` / `production` / `example`), nawigację `ArrowUp`/`ArrowDown`/`Enter` i grupowanie po `comp.group` ze statusem audio z `studioStatus`,
- w trybie `'styles'`: wyszukiwanie po `name`, `id`, fontach i `recommendedFor`, prezentację 3 próbek kolorów (`bgCanvas`, `accentPrimary`, `accentSecondary`), odświeżanie z dysku oraz formularz `+ Duplikuj jako własny styl` walidujący `SLUG_RE` i wywołujący `onDuplicateStyle(slug, sourcePreset)`.

- [ ] **Step 2: Zaktualizuj `packages/studio/src/client/components/Topbar.tsx`**

Zachowaj wszystkie dotychczasowe opcjonalne propsy (`TopbarProps`) tak, aby istniejące testy SSR wywołujące `<Topbar measuredFps={60} isPlaying={false} />` działały bez zmian, oraz dodaj opcjonalne propsy dla nowego układu:
- `isDirty?: boolean`, `isPickerOpen?: boolean`, `onTogglePicker?: () => void`,
- `themeMode?: StudioThemeMode`, `onCycleTheme?: () => void`,
- `isInspectorOpen?: boolean`, `onToggleInspector?: () => void`,
- `onTriggerExportMp4?: () => void`, `isRenderingMp4?: boolean`, `renderPercent?: number`.

- [ ] **Step 3: Przebuduj `StageViewport.tsx` oraz `StyleLabShowcase.tsx` na `useRemotionPlayer` i pływającą kapsułę transportu**

1. W `StageViewport.tsx`:
   - zastąp ręczny `playerRef` + `useEffect` wywołaniem `useRemotionPlayer({ fps: composition.fps, durationInFrames: composition.durationInFrames, resetKey: composition.id, onFrameChange, onPlayingChange, onFpsMeasure })` i przekaż `ref={player.playerRefCallback}` do `<Player>`,
   - zastąp górny `.mp-stage-toolbar` i dolny `.mp-transport-bar` pływającą kapsułą `.mp-floating-transport` (okrągły `.mp-play-fab`, kroki `-10/-1/+1/+10`, suwak `.mp-timeline-slider`, `.mp-timecode-pill`, `Pętla`, `Wycisz`, popover nakładek `.mp-overlays-popover` z `Golden Safe Box`, `Siatka 3×3`, `Marginesy 16:9`, `Klatka 0`, oraz przycisk `.mp-drawer-toggle-btn`),
   - umieść `LiveTranscriptBar` i `DirectorTimelinePanel` wewnątrz domyślnie zwiniętej szuflady `.mp-bottom-drawer` (`isTimelineOpen`),
   - udostępnij opcjonalne wyzwalanie eksportu MP4 z poziomu `Topbar` (lub przycisku w kapsule).
2. W `StyleLabShowcase.tsx`:
   - zastąp ręczną obsługę `<Player>` tym samym hookiem `useRemotionPlayer({ fps: STYLE_LAB_FPS, durationInFrames: STYLE_LAB_DURATION_IN_FRAMES, resetKey: 'stylelab', onPlayingChange, onFpsMeasure })` z `ref={player.playerRefCallback}` (co naprawia Play/Pause przy przełączaniu `16:9 ↔ 9:16`),
   - umieść pasek 7 kitów i przełącznik `16:9 | 9:16` w lekkim `.mp-stage-top-bar`, a sterowanie odtwarzaniem w spójnej kapsule `.mp-floating-transport`.

- [ ] **Step 4: Zweryfikuj kompilację typów i testy SSR**

Run: `npm run typecheck && npx tsx --test packages/cli/tests/studio-styles-api.test.ts`  
Expected: PASS.

- [ ] **Step 5: Zatwierdź zmiany w Git**

```bash
git add packages/studio/src/client/components/ProjectPickerPopover.tsx packages/studio/src/client/components/Topbar.tsx packages/studio/src/client/components/StageViewport.tsx packages/studio/src/client/components/StyleLabShowcase.tsx
git commit -m "feat(studio): add Topbar Cmd+K project picker, floating glass transport capsule, and timeline drawer"
```

---

### Task 5: 3-Tab `PropsInspector` (`Parametry | Skrypt & Audio | JSON`), `SceneScriptEditor` & `StudioApp` Integration

**Files:**
- Create: `packages/studio/src/client/components/SceneScriptEditor.tsx`
- Modify: `packages/studio/src/client/components/PropsInspector.tsx`
- Modify: `packages/studio/src/client/StudioApp.tsx`
- Modify: `packages/studio/src/client/index.ts`

**Interfaces:**
- Consumes: `GET/POST /api/studio/scenes` z Task 1, `POST /api/studio/voiceover` (SSE), rozszerzony `zodIntrospect.ts` z Task 2, `useStudioTheme` z Task 2, `ProjectPickerPopover` i `Topbar` z Task 4.
- Produces:
  - `SceneScriptEditor` do edycji kwestii lektorskich, czasów trwania, efektów akustycznych i ustawień głosu ElevenLabs wraz z generowaniem `.mp3`.
  - 3-zakładkowy `PropsInspector` (`Parametry | Skrypt & Audio | JSON`) ze wszystkimi formantami (`style-id`, `textarea`, `RGBA`, `string-array`, `tuple-number`, `json-value`), wyszukiwarką parametrów, zwijanymi sekcjami i resetem pojedynczego pola `↺`.
  - Zintegrowany `StudioApp` z układem dwukolumnowym, skrótami `⌘K` / `⌘I` / `⌘S`, obsługą szuflady/arkusza mobilnego i kompletem eksportów w `packages/studio/src/client/index.ts`.

- [ ] **Step 1: Utwórz `packages/studio/src/client/components/SceneScriptEditor.tsx`**

Zaimplementuj komponent pobierający grupy scen z `GET /api/studio/scenes`:
- automatycznie wybiera grupę odpowiadającą `composition.productionId` (lub `'root'`, jeśli kompozycja korzysta z głównego `scenes.json`), z możliwością przełączenia grupy w nagłówku,
- wyświetla status klucza `ELEVENLABS_API_KEY` (`hasApiKey`) oraz przycisk `Przelicz audio` (z opcją `Wymuś --force`) wywołujący `consumePostSseStream('/api/studio/voiceover', { force, productionId })`, po którego zakończeniu odświeża listę scen i `onRefreshStudioStatus?.()`,
- dla każdej sceny renderuje kartę `.mp-script-card` z odznaką statusu audio (`ElevenLabs` gdy `isHashCurrent === true`, `Zmieniony tekst` gdy `isHashCurrent === false`, `Tryb próbny`, `Brak pliku`), edytowalnym polem `text` (`.mp-textarea`), polami `title`, `speaker`, `durationInSeconds`, listą `voiceEffect` oraz zwijanymi suwakami `voiceSettings` (`stability`, `similarityBoost`, `style`, `speed`, `useSpeakerBoost`) i przyciskiem zapisu do `POST /api/studio/scenes`.

- [ ] **Step 2: Rozbuduj `packages/studio/src/client/components/PropsInspector.tsx` do 3 zakładek i pełnego zestawu formantów**

1. Dodaj na górze uchwyt mobilny `.mp-sheet-grabber`, nagłówek ze statusem zapisu i przyciskiem zamknięcia na ekranach mobilnych oraz przełącznik zakładek `.mp-inspector-tabs`:
   - `Parametry` (`params`),
   - `Skrypt & Audio` (`script`, widoczna w trybie `Filmy`, a ukryta w syntetycznym podglądzie `Style Lab`),
   - `JSON` (`json`).
2. W zakładce `Parametry`:
   - użyj `introspectZodObject(composition.schema, composition.defaultProps)` połączonego przez `mergeSchemaWithExtraProps(..., liveProps)` lub `introspectPropsFallback(composition.defaultProps)`, gdy `composition.schema === undefined`,
   - dodaj pole wyszukiwania `.mp-inspector-search` filtrujące pola po `label`, `key` i `section`,
   - dodaj zwijanie sekcji `.mp-section-header-btn` oraz przycisk `.mp-field-reset-btn` (`↺`), gdy `JSON.stringify(currentVal) !== JSON.stringify(getNestedValue(composition.defaultProps, field.path))`,
   - dodaj renderowanie wszystkich nowych rodzajów pól:
     - `'style-id'`: siatka `.mp-style-picker-grid` ze wszystkimi stylami z `listAllStudioStyles()` (3 próbki barw + nazwa),
     - `'textarea'`: wielowierszowy `.mp-textarea`,
     - `'color'`: próbnik HEX + pole tekstowe + suwak krycia alfa `.mp-alpha-row` (gdy wartość używa `rgba(...)` lub użytkownik zmieni krycie `< 1`, formatowane przez `parseRgbaOrHex` i `formatColorWithAlpha`),
     - `'string-array'`: lista czipów `.mp-tag-chip` z przyciskiem usunięcia `×` oraz wierszem dodawania nowego elementu (`Enter` / `+`),
     - `'tuple-number'`: siatka `.mp-tuple-grid` (`2..4` kolumny X/Y/Z/W),
     - `'json-value'`: kompaktowy edytor JSON pojedynczego pola z walidacją `JSON.parse`.
3. W zakładce `Skrypt & Audio`: wyrenderuj `<SceneScriptEditor composition={composition} onRefreshStudioStatus={onRefreshStudioStatus} />`.
4. W zakładce `JSON`: wyrenderuj pełny edytor `.mp-json-textarea` zsynchronizowany z `liveProps`, sprawdzający poprawność składni JSON oraz `composition.schema?.safeParse(...)`, z przyciskami `Formatuj` i `Kopiuj JSON`.

- [ ] **Step 3: Zintegruj nowy układ w `StudioApp.tsx` i zaktualizuj eksporty w `packages/studio/src/client/index.ts`**

1. W `StudioApp.tsx`:
   - podepnij `const { themeMode, setThemeMode, cycleThemeMode } = useStudioTheme();`,
   - dodaj stany `isPickerOpen`, `isInspectorOpen` (domyślnie `true` na desktopie `>= 1100px`, `false` poniżej `1100px`) oraz skróty globalne:
     - `⌘K` / `Ctrl+K` → przełącza `isPickerOpen`,
     - `⌘I` / `Ctrl+I` → przełącza `isInspectorOpen`,
     - `⌘S` / `Ctrl+S` → zapisuje aktywny plik `*.props.json` lub `styles/*.style.json`,
   - usuń stałe renderowanie `<LeftSidebar>` i `<StyleCatalogSidebar>` z `.mp-workspace`, zastępując je `<ProjectPickerPopover>` osadzonym przy `<Topbar>` oraz dwukolumnowym `.mp-workspace` (`StageViewport` / `StyleLabShowcase` + `PropsInspector` wraz z przesłoną `.mp-inspector-backdrop` dla tabletów i telefonów),
   - w widoku `Style Lab` zachowaj baner zapisu presetu wbudowanego jako nowy własny styl wewnątrz nagłówka prawej kolumny inspektora.
2. W `packages/studio/src/client/index.ts`:
   - wyeksportuj nowe moduły (`ProjectPickerPopover`, `SceneScriptEditor`, `useRemotionPlayer`, `attachPlayerLifecycle`, `useStudioTheme`, `introspectPropsFallback`, `mergeSchemaWithExtraProps`, `parseRgbaOrHex`, `formatColorWithAlpha`), pozostawiając nienaruszone dotychczasowe eksporty (`LeftSidebar`, `StyleCatalogSidebar`, itd.).

- [ ] **Step 4: Uruchom pełny zestaw testów jednostkowych, integracyjnych i kontrolę typów całego monorepo**

Run:
```bash
npm run typecheck
npx tsx --test packages/cli/tests/studio-scenes-api.test.ts packages/cli/tests/studio-player-and-schema.test.ts packages/cli/tests/studio-styles-api.test.ts
npm test
```
Expected: PASS (`0` błędów kompilacji TypeScript, wszystkie zestawy testów w `packages/cli/tests/` przechodzą w 100%).

- [ ] **Step 5: Zatwierdź zmiany w Git**

```bash
git add packages/studio/src/client/components/SceneScriptEditor.tsx packages/studio/src/client/components/PropsInspector.tsx packages/studio/src/client/StudioApp.tsx packages/studio/src/client/index.ts
git commit -m "feat(studio): ship 3-tab PropsInspector, live SceneScriptEditor, and 2-column Liquid Glass workspace"
```
