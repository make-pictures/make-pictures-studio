# AGENTS.md — Core Studio Rulebook (make.pictures)

Uniwersalne niezmienniki studia **make.pictures** (`60 FPS` Video-as-Code). Szczegółowe reguły kierunku plastycznego, geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie z **9 skilli** w `.agents/plugins/make-pictures/skills/` (lub `plugins/make-pictures/skills/`).

## 1. Konfiguracja (`onboard` i `ELEVENLABS_API_KEY`)
1. Uruchom `npx -y @make-pictures/cli@latest onboard --lang=pl` (lub `npm run onboard`) i wykonuj kroki JSON (`next`, `run`, `say`) — komenda sama rozpoznaje pusty katalog, istniejącą aplikację SaaS lub gotowy projekt; w zwykłym terminalu użytkownika uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje `node_modules` i `ffmpeg`, po czym wywołuje `@elevenlabs/cli@latest onboard connect --env-path .env.local` (jeden klucz `ELEVENLABS_API_KEY` zasila TTS, Music i SFX — podczas onboardingu nie generuj audio dla demo, żeby nie zużywać kredytów). **Nigdy** nie proś o klucz na czacie ani nie wypisuj `.env.local`.
3. Po `npx make-pictures onboard check` uruchom w tle `npm run studio` (`http://127.0.0.1:3000`, z podglądem **🎨 Style Lab** `[ 2D ] [ 2.5D ] [ 3D ]` pod `?view=styles`, `IsDaemon: true` / proces w tle) i zapytaj użytkownika o temat oraz przestrzeń/styl pierwszego filmu.

## 2. Bramka Art Direction (`DimensionalSpace × StylePreset`), Kapsuły (`productions/<slug>/`) i Style (`styles/*.style.json`)
- **Silnik:** `@make-pictures/core` (w tym `@make-pictures/core/style`), `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`.
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

## 3. Determinizm `60 FPS`, Płynny Montaż (`>= 4.5 s`), `<StyleProvider>` i Kontrakt `zod` ↔ `*.props.json`
- **Czysta klatka `0`:** Pierwsza klatka to puste tło (`bgCanvas`); animacje wejścia startuj od `frame - 2`.
- **Płynny przepływ scen (`>= 4.5 s` / `>= 270` klatek):** Łącz sceny przez `<ContinuousSceneFlow />` i `<OpticalCrossDissolve />` (z `<ClippedSurfaceChrome />` dla zaokrąglonych kart `overflow: 'visible'`); unikaj szarpanych wycięć `<SceneTransition />`. Każda scena wizualna w produkcji trwa **`>= 4.5 s` (`>= 270` klatek)** — weryfikuje to twarda bramka reżyserska `npx make-pictures qa`.
- **Sprężyny i determinizm:** Używaj `<StyleProvider style={styleId} renderBackdrop>`, `CINEMATIC_SPRINGS` / `getStyleSpringConfig` / `SPRING_PRESETS` (`damping: 200`) oraz `createSeededRandom(seed)` z `@make-pictures/core`. Całkowity **zakaz `Math.random()`** i akumulacji stanu w `useRef` między klatkami (`--concurrency=100%`).
- **Props Inspector i Style Lab:** Eksportuj `z.object` z opisami `.describe('Sekcja :: Etykieta')` (w tym `styleId`) i trzymaj wartości domyślne w `<CompositionId>.props.json`. **Zawsze odczytaj `*.props.json` oraz `styles/*.style.json` z dysku przed edycją**, by zachować zmiany z `Studio Web`.
- **Higiena puli `<Audio />`:** Używaj `<VoiceoverTrack />` i `<SoundCue />` z `@make-pictures/core`; **zakaz** montowania `<Audio />` wewnątrz `<Sequence>` bez jawnego `durationInFrames`.
- **Typografia (`latin-ext`):** Domyślnie bez dolnych napisów; karty *Ikona + 2–3 słowa*; po polsku *Sentence case* (bez *Title Case*).

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
1. **Odsłuch Audio:** Po `npx make-pictures audio --production=<slug>` (lub `npm run audio -- --production=<slug>`) odsłuchaj wygenerowane `.mp3` przez `read_file`.
2. **Twarda Bramka Reżyserska i Contact-Sheet QA:** Uruchom `npx make-pictures qa <CompositionId>` (lub `npm run qa -- <CompositionId>`) — komenda weryfikuje niezmienniki reżyserskie (`sceny >= 4.5 s` / `>= 270` klatek, brak szarpanych przejść, `ClippedSurfaceChrome`, czyste `f=0`) i generuje 12-klatkowy `out/qa-<CompositionId>.png`. Obejrzyj arkusz przez `read_file` (`f=0` puste tło, polskie znaki `latin-ext`, brak kolizji/Z-fightingu, w `9:16` karty w **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).
3. **Typy i Render (`-14 LUFS`):** `npm run typecheck`, a następnie `npx make-pictures render <CompositionId>` (lub `npm run render -- <CompositionId>`).

## 5. Tablica Routingu 9 Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (`.agents/plugins/make-pictures/skills/<skill>/SKILL.md`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, `production.json`, QA, render | `make-pictures-director` | 6 kroków produkcji, tryby CLI (`create-make-pictures`, `init --dir`, `new --space=2d\|2.5d\|3d`), `ContinuousSceneFlow` + `OpticalCrossDissolve`, sceny `>= 4.5 s` (`>= 270` klatek) weryfikowane przez twardą bramkę reżyserską `npx make-pictures qa` |
| Dobór przestrzeni i stylu, 10 `BUILT_IN_STYLES`, `styles/*.style.json` | `style-and-art-direction` | Dwuosiowa matryca `DimensionalSpace ('2d' \| '2.5d' \| '3d') × StylePreset` (10 stylów wbudowanych + `styles/*.style.json`), `<StyleProvider>`, `material3d`, **🎨 Style Lab**, archetypy głosu |
| Dokument redakcyjny i uniwersalna scena 2D | `kit-editorial-and-vector` | `editorial-collage` (`ChapterTitleCard`, `EditorialMediaCard` Ken Burns, `HighlightQuoteStage`, `SplitStoryLayout`) + `vector-scene-2d` (`StoryCard2D`, `AnnotatedCallout2D`, `ComparisonSplit2D`) |
| Wycinanki 2.5D na neutralnej scenie 3D | `kit-paper-diorama-3d` | `DioramaStage3D`, `PaperCutout3D`, `ImageCutout3D`, `PopUpHinge3D` (`[0, h/2, 0]`), 9 `ScenicCutoutMotifs` (w tym Apollo 11: `StarryCosmosBackdropCutout3D`, `EarthriseCutout3D`, `LunarCraterRidgeCutout3D`, `LunarLanderCutout3D`), `Δz >= 0.45`, `SCENIC_CUTOUT_INNER_MARGIN_PX = 38` |
| Diagramy 2D, Retro-PC i nieskończone płótno | `kit-motion-diagrams-2d` | `RetroPcWindowStage2D`, `MotionDiagramStage2D`, `SystemNode`, `DataFlowEdge`, `NodeBox` (`portTop/Bottom/Left/Right`), `FlowCurve`, pakiety `92–120` kl. |
| Nagrania ekranu SaaS `.mp4` (screencasty) | `kit-motion-diagrams-2d` + `make-pictures-director` | `@make-pictures/kits/product-frames`: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay` (`<OffthreadVideo />`, `productions/<slug>/assets/videos/`) |
| Studio 3D Soft-Clay, IBL i architektura dialogu | `kit-isometric-3d` | `StudioHdrRig3D`, `ClayCharacter3D`, `PodcastStudioSet3D`, `IsometricStage3D`, `Stylized3DCharacter`, `speakingWeight` vs `speechEnergy`, `getSmoothPoseWindow`, `0.03..0.055` rad/kl. |
| Kinetyczna typografia i wykresy | `kit-kinetic-and-data` | `WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard` |
| Lektor, fonetyka, muzyka AI i SFX | `sound-and-music-design` | Głosy ElevenLabs, fonetyka PL/EN, `VoiceoverTrack`, `SmartMusicBed` auto-ducking (7 `moodPreset`), `useMusicBeatPulse`, `SoundCue`, `VoiceAcousticPreset`, `-14 LUFS` |
| Kamera Shot DSL (2D/3D), przepływ scen i VFX | `cinematography-and-vfx` | `ContinuousSceneFlow`, `OpticalCrossDissolve`, `ClippedSurfaceChrome`, `ScenicBackdropLayers`, `DirectorCamera3D/2D`, `dolly-zoom`, `9:16` Safe Box, `CinematicLensOverlay`, `ParticleField`, `StagePostProcessing3D` |
