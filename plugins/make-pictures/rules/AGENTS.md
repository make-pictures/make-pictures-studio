# AGENTS.md — Core Studio Rulebook (make.pictures)

Uniwersalne niezmienniki studia **make.pictures** (`60 FPS` Video-as-Code). Szczegółowe reguły kierunku plastycznego, geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie z **9 skilli** w `.agents/plugins/make-pictures/skills/` (lub `plugins/make-pictures/skills/`).

## 1. Konfiguracja (`onboard` i `ELEVENLABS_API_KEY`)
1. Uruchom `npx -y @make-pictures/cli@latest onboard --lang=pl` (lub `npm run onboard`) i wykonuj kroki JSON (`next`, `run`, `say`) — komenda sama rozpoznaje pusty katalog, istniejącą aplikację SaaS lub gotowy projekt; w zwykłym terminalu użytkownika uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje `node_modules` i `ffmpeg`, po czym wywołuje `@elevenlabs/cli@latest onboard connect --env-path .env.local` (jeden klucz `ELEVENLABS_API_KEY` zasila TTS, Music i SFX — podczas onboardingu nie generuj audio dla demo, żeby nie zużywać kredytów). **Nigdy** nie proś o klucz na czacie ani nie wypisuj `.env.local`.
3. Po `npx make-pictures onboard check` uruchom w tle `npm run studio` (`http://127.0.0.1:3000`, z podglądem **🎨 Style Lab** `[ 2D ] [ 2.5D ] [ 3D ]` pod `?view=styles`, `IsDaemon: true` / proces w tle) i zapytaj użytkownika o temat oraz przestrzeń/styl pierwszego filmu.

## 2. Bramka Art Direction (`DimensionalSpace × StylePreset`), Kapsuły (`productions/<slug>/`) i Style (`styles/*.style.json`)
- **Silnik:** `@make-pictures/core` (w tym `@make-pictures/core/style` i `@make-pictures/core/kinematics`), `@make-pictures/kits` (w tym `@make-pictures/kits/tactile-3d`), `@make-pictures/studio`, `@make-pictures/cli`.
- **Obowiązkowa Bramka Art Direction (Krok 1 — `style-and-art-direction`):** **Zakaz ślepego wybierania `paper-diorama-3d`.** Przed utworzeniem filmu dopasuj temat, epokę i markę na dwuosiowej matrycy **`DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset`**:
  - **Przestrzeń wymiarowa (`--space=2d|2.5d|3d`) i 7 kitów scenicznych:** `vector-scene-2d`, `editorial-collage`, `kinetic-typography`, `data-storytelling`, `motion-diagrams-2d`, `paper-diorama-3d`, `isometric-3d` (możesz łączyć kilka kitów między aktami przez `<ContinuousSceneFlow />` w jednym `<StyleProvider>`), oraz
  - **10 stylów wbudowanych (`BUILT_IN_STYLES`):** `minimal-product`, `sketch-notebook`, `retro-pc`, `brutalist-poster`, `cyber-telemetry`, `tactile-craft`, `editorial-press`, `archival-chronicle`, `soft-clay`, `glass-studio` — albo dowolną liczbę własnych presetów w `styles/*.style.json` (`npx make-pictures styles`, `npx make-pictures styles --space=3d`, `npx make-pictures style new <slug> --from=soft-clay`, edycja `60 FPS` w **🎨 Style Lab** w Studio Web).
- **3 tryby pracy CLI (`npx make-pictures ...` lub skrypty `npm run ...`):**
  1. **Standalone Studio (`npx create-make-pictures my-films`):** `productions/<slug>/` i `styles/*.style.json` to kod źródłowy użytkownika śledzony w Git; silnik działa z `node_modules/@make-pictures/*`.
  2. **Wewnątrz istniejącej aplikacji SaaS (`npx make-pictures init --dir=videos`):** przekazuj `--dir=videos` do komend (`npx make-pictures new <slug> --space=3d --dir=videos`, `npx make-pictures studio --dir=videos`).
  3. **Monorepo silnika (`make-pictures-studio`):** pokazy żyją w `examples/*`, a filmy użytkownika w izolowanym `productions/<slug>/`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu (`production.json`, `compositions/`, `assets/`, `generated/audio-manifest.ts`):
  - `npx make-pictures new <slug> --space=3d --lang=pl` *(domyślnie `isometric-3d` + `soft-clay`)*
  - `npx make-pictures new <slug> --space=2.5d --lang=pl` *(domyślnie `paper-diorama-3d` + `tactile-craft`)*
  - `npx make-pictures new <slug> --space=2d --style=retro-pc --lang=pl`
  - `npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl`
  - `npx make-pictures new <slug> --kit=editorial-collage --style=editorial-press --lang=pl`
- **Zakaz siatek kafelków `3×2` i higiena zasobów rastrowych:** Wyliczanki kategorii wizualizuj przez płynną panoramę redakcyjną (`<EditorialPanoramaTrack />` + `DirectorCamera2D` + Ken Burns), asymetryczny kolaż warstwowy lub przekrój przestrzenny — nigdy jako migającą macierz kafelków `3×2` (`1 → 2 → 3 → 4`). Generując ilustracje AI (`npx make-pictures image "..." --style=<styleId>`), stosuj wspólny kotwiczący styl plastyczny i bezwzględny zakaz tekstu w rastrze. Jasne obiekty na białym tle (PDF / zdjęcia) wycinaj wyłącznie przez `npx make-pictures cutout <plik> --out=...` (natywna maska `/SMask` lub *Exterior Border Flood-Fill* + test na ciemnej szachownicy `#0F172A`/`#1E293B`; całkowity zakaz globalnego progowania bieli `rgb > 245 => alpha = 0`). Ciemne narożniki skanów archiwalnych i rycin oczyszczaj przez `npx make-pictures assets clean-scan <plik> --out=...`, a katalogi zasobów weryfikuj kontakt-arkuszem `npx make-pictures assets sheet <katalog>` (utrzymuj `SOURCES.md` dla źródeł zewnętrznych).

## 3. Determinizm `60 FPS`, Płynny Montaż (`>= 4.5 s`), Oddech Lektora, Typografia `>= 18 px` i Kontrakt `zod` ↔ `*.props.json`
- **Czysta klatka `0` i obrazy `<Img>`:** Pierwsza klatka to jednolite tło (`bgCanvas`, wariancja RGB `0.00`); animacje wejścia startuj od `frame - 2`. Zawsze używaj `<Img>` z `'remotion'` (zakaz surowego `<img>` — wymusza `delayRender` przy `--concurrency=100%`).
- **Płynny przepływ scen (`>= 4.5 s` / `>= 270` klatek) i budżet oddechu lektora:** Łącz sceny przez `<ContinuousSceneFlow crossDissolveFrames={54} />` na wspólnym, najwyżej położonym `<StyleProvider style={styleId} renderBackdrop>` (z `<ClippedSurfaceChrome />` dla zaokrąglonych kart `overflow: 'visible'`); unikaj szarpanych wycięć `<SceneTransition />` i `whip` (dozwolonych wyłącznie w krótkich rolkach `9:16` `brutalist-poster`). Wyliczaj czas trwania scen funkcją `computeSceneTimingFromVoiceover`: **`~0.7 s` (`42` kl.)** osadzenia przed głosem (*Pre-Speech Settle*), **`~1.5–1.7 s` (`90–102` kl.)** oddechu po kwestii (*Post-Speech Hold*) oraz **`+2.2–2.5 s` (`132–150` kl.)** w scenie finałowej (`<SmartMusicBed fadeOutFrames={90} />`). Wewnątrz jednej sceny stosuj **maksymalnie `1` ewoluujący układ lub `2` pod-widoki** łączone przez `<SceneSubViewDissolve />` (`48–60` kl.; zakaz `3+` pod-widoków).
- **Sprężyny, czystość wizualna i geometria Béziera:** Dla prezentacji i explainerów stosuj `cinematic-fluid` / `editorial-calm` (`damping: 200`, `cameraHandheld <= 0.015`) oraz `createSeededRandom(seed)`. Całkowity **zakaz `Math.random()`**, akumulacji stanu w `useRef` między klatkami oraz sztucznego szumu wizualnego (chmur latających kropek, radarowych pierścieni, plątaniny linii). Ścieżki SVG i ew. pojedynczy impuls wyliczaj z jednego źródła prawdy `buildCubicBezierPath` + `evaluateCubicBezier` (domyślnie `packetCount={0}`). Adnotacje na zrzutach i ilustracjach kotwicz subpikselowo przez `<PinnedMediaStage />` (`Δx = 0.00 px`, `aspectRatio` `1:1` i kotwica `0×0`).
- **Props Inspector i Style Lab:** Eksportuj `z.object` z opisami `.describe('Sekcja :: Etykieta')` (w tym `styleId`) i trzymaj wartości domyślne w `<CompositionId>.props.json`. **Zawsze odczytaj `*.props.json` oraz `styles/*.style.json` z dysku przed edycją**, by zachować zmiany z `Studio Web`.
- **Kinematyka Disneya, Tactile 3D, Kolizje OBB SAT i Bezramkowe Nakładki:** W scenach 3D/2.5D korzystaj z `@make-pictures/core/kinematics` (`disneyEase`, `evaluateArc3D`, `evaluateSurfaceImpact`, 15-osiowy SAT `obbClearanceSat3D` / `auditSceneCollisions3D`) oraz `@make-pictures/kits/tactile-3d` (`<DeformableSheet3D />`, `<ScreenGlassLayer3D />`, synchroniczne `<SyncStudioIbl3D />`, `getProceduralPbrMaps`, `<DaylightArcRig3D />`). Nad scenami 3D/2.5D stosuj bezramkowe `<FloatingEditorialDisplay />` i `<PaperRibbonTimeline />` (`>= 19–22 px`, zero czarnych pudełek webowych).
- **Higiena puli `<Audio />`, natywne głosy (`voices --lang`), domyślne `eleven_v4`, dialogi `dialogueInputs` i copy dla widza:** Dla filmów `lang: 'pl'` używaj wyłącznie **natywnych polskich głosów** (np. `Luiza` `C8ZVSJxcymeT86xT429O`, `Asia` `Bz1e1clEKwgN71Vx7cxj`, `Arleta` `F9eb9uZYeJuHuO7Uvs1R`, `Rafał` `CLuTGacrAhcIhaJslbXt` lub wyszukanych przez `npx make-pictures voices --lang=pl --json` — **zakaz anglojęzycznych głosów premade** jak Liam/Sarah/Brian/George dla narracji PL). Domyślnym modelem jest **`eleven_v4`** z ekspresyjnymi tagami intonacji (`[thoughtful]`, `[warmly]`, `[playful]`, `[amazed]`, `[excited]`) i dzieleniem dłuższych scen na mikro-segmenty (`a/b/c`); przy jawnym użyciu `eleven_v3` pilnuj dyskretnego `stability ∈ {0.0, 0.5, 1.0}` i nie zostawiaj `[tagów]` w starszym `eleven_multilingual_v2`. Wieloosobowe rozmowy definiuj przez **`dialogueInputs`** (ElevenLabs Text-to-Dialogue `convertWithTimestamps` → jeden plik `.mp3` + `voiceSegments` do lip-syncu i cięć kamer). Pisz **copy dla twórcy/widza — zakaz technicznego flexing-u** (`"60 FPS"`, `"-14 LUFS"`, `"0 kolizji"`, `"GPU"`, `"PBR"`) i kodów SKU w tytułach lub narracji. Używaj `<VoiceoverTrack />`, oszczędnego `<SoundCue />` (`3–5` akcentów `volume: 0.14–0.26`; zakaz `<Audio />` w `<Sequence>` bez `durationInFrames`), tempa `voiceSettings.speed: 0.98–1.00` oraz poprawnej polskiej fonetyki: **głoskowce** (`API` → `"api"`, `RAM` → `"ram"`, `LAN` → `"lan"`, `LED` → `"led"`) vs **literowce z dywizami** (`USB` → `"u-es-be"`, `SQL` → `"es-ku-el"`, `CRM` → `"ce-er-em"`, `ERP` → `"e-er-pe"`) i grupowanie cyfr norm (`ISO 8601` → `"izo osiemdziesiąt sześć zero jeden"`, `USB 3.2` → `"u-es-be trzy dwa"`).
- **Typografia `>= 18–19 px` (`TYPOGRAPHY_FLOOR_1080P`), proporcje kart i `boxSizing: 'border-box'`:** Zakaz mikro-typografii `10–14 px`. Złoty standard karty (`latin-ext`, po polsku *Sentence case*, domyślnie bez dolnych napisów): **wyrazisty nagłówek (`26–32 px`, `2–5` słów) + 1 czytelne zdanie uzupełniające (`19–22 px`, `6–11` słów)**. Karty centruj w pionie (`height: 'auto'`, `justifyContent: 'center'`; zakaz pustych dziur z `space-between` — dla podsumowań `2×2` używaj `<HorizontalFeatureGrid2x2 />`), główny obiekt wizualny wypełnia `>= 60%` pola, a każdy kontener i `WorldBox` posiada `boxSizing: 'border-box'`.

```tsx
import { z } from 'zod';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  StyleProvider,
  createSeededRandom,
  getCardChromeStyle,
  getStyleSpringConfig,
  useStudioStyle,
} from '@make-pictures/core';

export const FilmSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)'),
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
});

const HeroCardInner: React.FC<{ headline: string }> = ({ headline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = useStudioStyle();
  const enter = spring({ frame: frame - 2, fps, config: getStyleSpringConfig(style, 'enter') }); // frame 0 => 0
  const jitter = createSeededRandom('hero-v1')();
  return <div style={getCardChromeStyle(style, { opacity: enter })} data-seed={jitter}>{headline}</div>;
};

export const HeroCard: React.FC<z.infer<typeof FilmSchema>> = ({ styleId, headline }) => (
  <StyleProvider style={styleId} renderBackdrop>
    <HeroCardInner headline={headline} />
  </StyleProvider>
);
```

## 4. Obowiązkowe Bramki Jakości przed Renderem
1. **Pilotażowe Demo (2–3 ujęcia) i Fact-Check przed Audio:** Przy większych filmach (szczególnie 3D/dokumentalnych) najpierw wyrenderuj krótkie **Pilotażowe Demo** (`2–3` kluczowe ujęcia) dla zatwierdzenia stylu/kamery oraz wykonaj obowiązkowy **fact-check** dat, cytatów i nazw własnych w scenariuszu **przed** płatną generacją audio i finalnym renderem.
2. **Linter Fonetyki / `eleven_v4` / `eleven_v3` i Odsłuch Audio:** Po `npx make-pictures audio --production=<slug>` sprawdź ostrzeżenia lintera (`głoskowce` vs `literowce`, SKU, `[v3-audio-tags]`, `[v3-stability]`, wszystkie kwestie `dialogueInputs`) i odsłuchaj wygenerowane `.mp3` przez `read_file`. Dla wycinanych i oczyszczanych zasobów PNG zweryfikuj ciemną szachownicę z `npx make-pictures cutout` oraz kontakt-arkusz `npx make-pictures assets sheet`.
3. **Test 0 Kolizji 3D, Twarda Bramka Reżyserska i Auto-Grid Contact-Sheet QA:** W scenach 3D uruchom test jednostkowy `auditSceneCollisions3D`, a przed renderem `npx make-pictures qa <CompositionId>` (`--grid=auto` domyślnie pokrywa **100% scen i pod-widoków** etykietami `sceneId/subViewId`) — komenda weryfikuje niezmienniki reżyserskie (`sceny >= 4.5 s`, marginesy oddechowe `pre >= 36f` / `post >= 90f` / `outro >= 132f`, `<= 2` pod-widoki, `<Img>`, brak `fontSize < 18px` i pustych dziur w kartach, czyste `f=0` o wariancji `0.00`) i generuje `out/qa-<CompositionId>.png`. Obejrzyj arkusz przez `read_file` (`f=0` puste tło, polskie znaki `latin-ext`, `Δx = 0.00 px` na adnotacjach, w `9:16` karty w **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).
4. **Typy, Render (`-14 LUFS`) i Odsłuch Finalnego `.mp4`:** Uruchom `npm run typecheck`, a następnie `npx make-pictures render <CompositionId>`. Po renderze obowiązkowo skontroluj zmasterowany miks `.mp4` (`-14 LUFS`: balans `<SmartMusicBed />`, `<SoundCue />`, dykcja `"api"` vs `"u-es-be"` oraz pełne wybrzmienie wygłosów).

## 5. Tablica Routingu 9 Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (`.agents/plugins/make-pictures/skills/<skill>/SKILL.md`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, `production.json`, QA, render | `make-pictures-director` | 6 kroków produkcji, Pilotażowe Demo, fact-check, `computeSceneTimingFromVoiceover`, `ContinuousSceneFlow`, `cutout`, `assets clean-scan`/`sheet`, `auditSceneCollisions3D`, `npx make-pictures qa` |
| Dobór przestrzeni i stylu, 10 `BUILT_IN_STYLES`, `styles/*.style.json` | `style-and-art-direction` | Matryca `DimensionalSpace ('2d' \| '2.5d' \| '3d') × StylePreset`, `TYPOGRAPHY_FLOOR_1080P` (`>= 18 px`, Tytuł + 1 zdanie), `<StyleProvider>`, `material3d`, **🎨 Style Lab**, `image --style` |
| Dokument redakcyjny i uniwersalna scena 2D | `kit-editorial-and-vector` | `editorial-collage` (`EditorialPanoramaTrack`, `ChapterTitleCard`, `EditorialMediaCard`, `SplitStoryLayout`, `PaperRibbonTimeline`, `FloatingEditorialDisplay`) + `vector-scene-2d` (`StoryCard2D`, `HorizontalFeatureGrid2x2`, `PinnedMediaStage`) |
| Wycinanki 2.5D i fizyczne arkusze `tactile-3d` | `kit-paper-diorama-3d` | `DioramaStage3D`, `PaperCutout3D`, `ImageCutout3D` + `cutout`, `PopUpHinge3D`, 9 `ScenicCutoutMotifs`, `@make-pictures/kits/tactile-3d` (`DeformableSheet3D`, `usePreloadedTextures3D`) + SAT `obbClearanceSat3D` |
| Diagramy 2D, Retro-PC i nieskończone płótno | `kit-motion-diagrams-2d` | `RetroPcWindowStage2D`, `MotionDiagramStage2D`, `SystemNode`, `DataFlowEdge` (`packetCount={0}` domyślnie), `buildCubicBezierPath` / `evaluateCubicBezier`, `NodeBox` (`border-box`) |
| Nagrania ekranu SaaS `.mp4` (screencasty) | `kit-motion-diagrams-2d` + `make-pictures-director` | `@make-pictures/kits/product-frames`: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay`, `PinnedMediaStage` (`<OffthreadVideo />`, `productions/<slug>/assets/videos/`) |
| Studio 3D Soft-Clay, Sync IBL, PBR i światło dnia | `kit-isometric-3d` | `StudioHdrRig3D`, `SyncStudioIbl3D` (Frame-1 PMREM), `getProceduralPbrMaps`, `DaylightArcRig3D`, `ClayCharacter3D`, `PodcastStudioSet3D`, `IsometricStage3D`, `Stylized3DCharacter` |
| Kinetyczna typografia i wykresy | `kit-kinetic-and-data` | `WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard` (`>= 18 px`, `tabular-nums`, `>= 60%` pola) |
| Lektor `eleven_v4`, dialogi `dialogueInputs`, fonetyka, muzyka AI i SFX | `sound-and-music-design` | Głosy ElevenLabs (`eleven_v4` domyślnie, `speed: 0.98–1.00`), Text-to-Dialogue (`dialogueInputs` + `voiceSegments`), tagi ekspresji (`eleven_v4`/`eleven_v3`), `"api"` vs `"u-es-be"`, `VoiceoverTrack`, `SmartMusicBed`, `SoundCue`, `-14 LUFS` |
| Kinematyka Disneya, kamera Shot DSL, szyba 3D i VFX | `cinematography-and-vfx` | `@make-pictures/core/kinematics`, `ShotType3D` (`'macro'`), `computeCameraBasis3D`, `evaluateCameraKeyframes3D`, `ScreenGlassLayer3D`, `ContinuousSceneFlow`, `SceneSubViewDissolve`, `DirectorCamera3D/2D`, `9:16` Safe Box |
