# AGENTS.md — Core Studio Rulebook (make.pictures)

Uniwersalne niezmienniki studia **make.pictures** (`60 FPS` Video-as-Code). Szczegółowe reguły geometrii, audio, kamer i zestawów wizualnych ładuj progresywnie ze skilli w `.agents/plugins/make-pictures/skills/` (lub `plugins/make-pictures/skills/`).

## 1. Konfiguracja (`onboard` i `ELEVENLABS_API_KEY`)
1. Uruchom `npx -y @make-pictures/cli@latest onboard --lang=pl` (lub `npm run onboard`) i wykonuj kroki JSON (`next`, `run`, `say`) — komenda sama rozpoznaje pusty katalog, istniejącą aplikację SaaS lub gotowy projekt; w zwykłym terminalu użytkownika uruchamia czytelny kreator dla człowieka.
2. Narzędzie weryfikuje `node_modules` i `ffmpeg`, po czym wywołuje `@elevenlabs/cli@latest onboard connect --env-path .env.local` (jeden klucz `ELEVENLABS_API_KEY` zasila TTS, Music i SFX — podczas onboardingu nie generuj audio dla demo, żeby nie zużywać kredytów). **Nigdy** nie proś o klucz na czacie ani nie wypisuj `.env.local`.
3. Po `npx make-pictures onboard check` uruchom w tle `npm run studio` (`http://127.0.0.1:3000`, `IsDaemon: true` / proces w tle) i zapytaj użytkownika o temat pierwszego filmu.

## 2. Architektura Kapsuł (`productions/<slug>/`) i Tryby Projektu
- **Silnik:** `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`.
- **3 tryby pracy CLI (`npx make-pictures ...` lub skrypty `npm run ...`):**
  1. **Standalone Studio (`npx create-make-pictures my-films`):** `productions/<slug>/` to kod źródłowy użytkownika śledzony w Git; silnik działa z `node_modules/@make-pictures/*`.
  2. **Wewnątrz istniejącej aplikacji SaaS (`npx make-pictures init --dir=videos`):** przekazuj `--dir=videos` do komend (`npx make-pictures new <slug> --dir=videos`, `npx make-pictures studio --dir=videos`).
  3. **Monorepo silnika (`make-pictures-studio`):** pokazy żyją w `examples/*`, a filmy użytkownika w izolowanym `productions/<slug>/`. Zakaz zaszywania ID scen filmów w kodzie silnika.
- Tworzenie nowego filmu: `npx make-pictures new <slug> --kit=paper-diorama-3d --lang=pl` (`production.json`, `compositions/`, `assets/`, `generated/audio-manifest.ts`).

## 3. Determinizm `60 FPS` i Kontrakt `zod` ↔ `*.props.json`
- **Czysta klatka `0`:** Pierwsza klatka to puste tło; animacje wejścia startuj od `frame - 2`.
- **Sprężyny i determinizm:** Używaj `SPRING_PRESETS` (`damping: 200`) oraz `createSeededRandom(seed)` z `@make-pictures/core`. Całkowity **zakaz `Math.random()`** i akumulacji stanu w `useRef` między klatkami (`--concurrency=100%`).
- **Props Inspector:** Eksportuj `z.object` z opisami `.describe('Sekcja :: Etykieta')` i trzymaj wartości domyślne w `<CompositionId>.props.json`. **Zawsze odczytaj `*.props.json` z dysku przed edycją**, by zachować zmiany z `Studio Web`.
- **Higiena puli `<Audio />`:** Używaj `<VoiceoverTrack />` i `<SoundCue />` z `@make-pictures/core`; **zakaz** montowania `<Audio />` wewnątrz `<Sequence>` bez jawnego `durationInFrames`.
- **Typografia:** Domyślnie bez dolnych napisów; karty *Ikona + 2–3 słowa*; po polsku *Sentence case* (bez *Title Case*).

```tsx
import { z } from 'zod';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SPRING_PRESETS, createSeededRandom } from '@make-pictures/core';

export const FilmSchema = z.object({
  headline: z.string().describe('Teksty & Napisy :: Nagłówek'),
  accentColor: z.string().describe('Kolory & Styl :: Akcent'),
});

export const HeroCard: React.FC<z.infer<typeof FilmSchema>> = ({ headline, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 2, fps, config: SPRING_PRESETS.snappy }); // frame 0 => 0
  const jitter = createSeededRandom('hero-v1')();
  return <div style={{ opacity: enter, color: accentColor }} data-seed={jitter}>{headline}</div>;
};
```

## 4. Obowiązkowe Bramki Jakości przed Renderem
1. **Odsłuch Audio:** Po `npx make-pictures audio --production=<slug>` (lub `npm run audio -- --production=<slug>`) odsłuchaj wygenerowane `.mp3` przez `read_file`.
2. **Contact-Sheet QA:** Uruchom `npx make-pictures qa <CompositionId>` (lub `npm run qa -- <CompositionId>`) i obejrzyj 12-klatkowy `out/qa-<CompositionId>.png` przez `read_file` (`f=0` puste tło, brak kolizji/Z-fightingu, w `9:16` karty w **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**).
3. **Typy i Render (`-14 LUFS`):** `npm run typecheck`, a następnie `npx make-pictures render <CompositionId>` (lub `npm run render -- <CompositionId>`).

## 5. Tablica Routingu Skilli (Załaduj przed Pisaniem Scen!)
| Zadanie / Warstwa | Skill (`.agents/plugins/make-pictures/skills/<skill>/SKILL.md`) | Zakres |
| :--- | :--- | :--- |
| Nowy film, `production.json`, QA, render | `make-pictures-director` | 6 kroków produkcji, tryby CLI (`create-make-pictures`, `init --dir`), rytm ujęć 3–5 s |
| Teatrzyk 2.5D Pop-Up Book | `kit-paper-diorama-3d` | `PaperCutout3D`, `ImageCutout3D`, `PopUpHinge3D`, `Δz`, marginesy `whiteBorderPx`, `maxWidth` PL, `cacheDeps` |
| Diagramy 2D i nieskończone płótno | `kit-motion-diagrams-2d` | `NodeBox`, `portTop/Bottom/Left/Right`, `FlowCurve` (`curveX`), pakiety `92–120` kl. |
| Nagrania ekranu SaaS `.mp4` (screencasty) | `kit-motion-diagrams-2d` + `make-pictures-director` | `@make-pictures/kits/product-frames`: `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay` (`<OffthreadVideo />`, `productions/<slug>/assets/videos/`) |
| Izometryczne studio 3D i dialogi | `kit-isometric-3d` | `Stylized3DCharacter`, `speakingWeight` vs `speechEnergy`, `getSmoothPoseWindow`, `0.03..0.055` rad/kl. |
| Kinetyczna typografia i wykresy | `kit-kinetic-and-data` | `WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard` |
| Lektor, fonetyka, muzyka AI i SFX | `sound-and-music-design` | Głosy ElevenLabs, fonetyka PL/EN, `VoiceoverTrack`, `SmartMusicBed` auto-ducking, `useMusicBeatPulse`, `SoundCue`, `VoiceAcousticPreset`, `-14 LUFS` |
| Kamera Shot DSL (2D/3D) i VFX | `cinematography-and-vfx` | `DirectorCamera3D/2D`, `dolly-zoom`, `9:16` Safe Box, `CinematicLensOverlay`, `ParticleField`, `StagePostProcessing3D`, `SceneTransition` |
