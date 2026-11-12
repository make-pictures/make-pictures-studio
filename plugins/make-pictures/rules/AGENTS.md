# AGENTS.md — Core Studio Rulebook (make.pictures)

Uniwersalne niezmienniki studia **make.pictures** (`60 FPS` Video-as-Code). Szczegółowe reguły kierunku plastycznego, geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie z **9 skilli** w `.agents/plugins/make-pictures/skills/` (lub `plugins/make-pictures/skills/`).

## 1. Konfiguracja (`onboard` i `ELEVENLABS_API_KEY`)
1. Uruchom `npx -y @make-pictures/cli@latest onboard --lang=pl` (lub `npm run onboard`) i wykonuj kroki JSON (`next`, `run`, `say`) — komenda sama rozpoznaje pusty katalog, istniejącą aplikację SaaS lub gotowy projekt; w zwykłym terminalu użytkownika uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje `node_modules` i `ffmpeg`, po czym wywołuje `@elevenlabs/cli@latest onboard connect --env-path .env.local` (jeden klucz `ELEVENLABS_API_KEY` zasila TTS, Music i SFX — podczas onboardingu nie generuj audio dla demo, żeby nie zużywać kredytów). **Nigdy** nie proś o klucz na czacie ani nie wypisuj `.env.local`.
3. Po `npx make-pictures onboard check` uruchom w tle `npm run studio` (`http://127.0.0.1:3000`, z podglądem **🎨 Style Lab** pod `?view=styles`, `IsDaemon: true` / proces w tle) i zapytaj użytkownika o temat oraz klimat/styl pierwszego filmu.

## 2. Bramka Art Direction, Kapsuły (`productions/<slug>/`) i Style (`styles/*.style.json`)
- **Silnik:** `@make-pictures/core` (w tym `@make-pictures/core/style`), `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`.
- **Obowiązkowa Bramka Art Direction (Krok 1 — `style-and-art-direction`):** **Zakaz ślepego wybierania `paper-diorama-3d`.** Przed utworzeniem filmu dopasuj temat, epokę i markę do:
  - **7 kitów scenicznych:** `vector-scene-2d`, `editorial-collage`, `kinetic-typography`, `data-storytelling`, `motion-diagrams-2d`, `paper-diorama-3d`, `isometric-3d` (możesz łączyć kilka kitów między aktami w jednym `<StyleProvider>`), oraz
  - **7 stylów wbudowanych:** `minimal-product`, `editorial-press`, `archival-chronicle`, `cyber-telemetry`, `brutalist-poster`, `sketch-notebook`, `tactile-craft` — albo własnego presetu w `styles/<slug>.style.json` (`npx make-pictures styles`, `npx make-pictures style new <slug> --from=editorial-press`, edycja `60 FPS` w **🎨 Style Lab** w Studio Web).
- **3 tryby pracy CLI (`npx make-pictures ...` lub skrypty `npm run ...`):**
  1. **Standalone Studio (`npx create-make-pictures my-films`):** `productions/<slug>/` i `styles/*.style.json` to kod źródłowy użytkownika śledzony w Git; silnik działa z `node_modules/@make-pictures/*`.
  2. **Wewnątrz istniejącej aplikacji SaaS (`npx make-pictures init --dir=videos`):** przekazuj `--dir=videos` do komend (`npx make-pictures new <slug> --dir=videos`, `npx make-pictures studio --dir=videos`).
  3. **Monorepo silnika (`make-pictures-studio`):** pokazy żyją w `examples/*`, a filmy użytkownika w izolowanym `productions/<slug>/`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu (`production.json`, `compositions/`, `assets/`, `generated/audio-manifest.ts`):
  - `npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl`
  - `npx make-pictures new <slug> --kit=editorial-collage --style=editorial-press --lang=pl`

## 3. Determinizm `60 FPS`, `<StyleProvider>` i Kontrakt `zod` ↔ `*.props.json`
- **Czysta klatka `0`:** Pierwsza klatka to puste tło (`bgCanvas`); animacje wejścia startuj od `frame - 2`.
- **Sprężyny i determinizm:** Używaj `<StyleProvider style={styleId} renderBackdrop>`, `getStyleSpringConfig` / `SPRING_PRESETS` (`damping: 200`) oraz `createSeededRandom(seed)` z `@make-pictures/core`. Całkowity **zakaz `Math.random()`** i akumulacji stanu w `useRef` między klatkami (`--concurrency=100%`).
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
2. **Contact-Sheet QA:** Uruchom `npx make-pictures qa <CompositionId>` (lub `npm run qa -- <CompositionId>`) i obejrzyj 12-klatkowy `out/qa-<CompositionId>.png` przez `read_file` (`f=0` puste tło, polskie znaki `latin-ext`, brak kolizji/Z-fightingu, w `9:16` karty w **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).
3. **Typy i Render (`-14 LUFS`):** `npm run typecheck`, a następnie `npx make-pictures render <CompositionId>` (lub `npm run render -- <CompositionId>`).

## 5. Tablica Routingu 9 Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (`.agents/plugins/make-pictures/skills/<skill>/SKILL.md`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, `production.json`, QA, render | `make-pictures-director` | 6 kroków produkcji, tryby CLI (`create-make-pictures`, `init --dir`), rytm ujęć 3–5 s |
| Dobór stylu, 7 `BUILT_IN_STYLES`, `styles/*.style.json` | `style-and-art-direction` | Obowiązkowa bramka Art Direction, `<StyleProvider>`, `useStudioStyle`, `StylePresetSchema`, **🎨 Style Lab**, archetypy głosu |
| Dokument redakcyjny i uniwersalna scena 2D | `kit-editorial-and-vector` | `editorial-collage` (`ChapterTitleCard`, `EditorialMediaCard` Ken Burns, `HighlightQuoteStage`, `SplitStoryLayout`) + `vector-scene-2d` (`StoryCard2D`, `AnnotatedCallout2D`, `ComparisonSplit2D`) |
| Wycinanki 2.5D na neutralnej scenie 3D | `kit-paper-diorama-3d` | `DioramaStage3D`, `PaperCutout3D`, `ImageCutout3D`, `PopUpHinge3D` (`[0, h/2, 0]`), `Δz >= 0.45`, `whiteBorderPx`, `maxWidth` PL, `cacheDeps` |
| Diagramy 2D i nieskończone płótno | `kit-motion-diagrams-2d` | `NodeBox`, `portTop/Bottom/Left/Right`, `FlowCurve` (`curveX`), pakiety `92–120` kl. |
| Nagrania ekranu SaaS `.mp4` (screencasty) | `kit-motion-diagrams-2d` + `make-pictures-director` | `@make-pictures/kits/product-frames`: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay` (`<OffthreadVideo />`, `productions/<slug>/assets/videos/`) |
| Izometryczne studio 3D i dialogi | `kit-isometric-3d` | `IsometricStage3D`, `Stylized3DCharacter`, `speakingWeight` vs `speechEnergy`, `getSmoothPoseWindow`, `0.03..0.055` rad/kl. |
| Kinetyczna typografia i wykresy | `kit-kinetic-and-data` | `WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard` |
| Lektor, fonetyka, muzyka AI i SFX | `sound-and-music-design` | Głosy ElevenLabs, fonetyka PL/EN, `VoiceoverTrack`, `SmartMusicBed` auto-ducking, `useMusicBeatPulse`, `SoundCue`, `VoiceAcousticPreset`, `-14 LUFS` |
| Kamera Shot DSL (2D/3D) i VFX | `cinematography-and-vfx` | `DirectorCamera3D/2D`, `dolly-zoom`, `9:16` Safe Box, `CinematicLensOverlay`, `ParticleField`, `StagePostProcessing3D`, `SceneTransition` |
