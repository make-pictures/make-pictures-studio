---
name: make-pictures-director
description: >-
  End-to-end 6-step production workflow for creating 60 FPS animated videos in
  make.pictures Studio (standalone create-make-pictures repos, embedded SaaS
  repos via make-pictures init --dir=videos, or the engine monorepo). Use this
  skill whenever starting a new film, selecting visual kits & styles,
  scaffolding productions/<slug>/, authoring production.json storyboards,
  running audio generation, inspecting 12-frame Contact-Sheet QA PNGs, or
  rendering mastered -14 LUFS MP4 videos.
---

# make.pictures Director — 6-Step Production Workflow (`60 FPS`)

Use this runbook to guide every new film from initial user idea and Art Direction matching to broadcast-mastered `60 FPS` MP4 across any `make.pictures` workspace.

---

## Project Modes & Universal CLI (`npx make-pictures`)

`make.pictures` runs identically across **3 workspace layouts** via the `@make-pictures/cli` binary (`npx make-pictures <command>`, also wired to `npm run <command>` in standalone and monorepo `package.json` files):

1. **Standalone Video Studio (`npx create-make-pictures@latest my-films`):**
   - Engine packages (`@make-pictures/{core,kits,studio,cli}`) live in `node_modules/`.
   - `productions/<slug>/` and reusable `styles/*.style.json` presets are the user's Git-tracked source code!
   - Commands: `npx make-pictures styles`, `npx make-pictures style new <slug>`, `npx make-pictures new <slug>`, `npx make-pictures audio`, `npx make-pictures studio`, `npx make-pictures qa <Id>`, `npx make-pictures render <Id>`.
2. **Embedded Inside an Existing SaaS / Web Repo (`npx make-pictures init --dir=videos`):**
   - Keeps video capsules and custom brand styles neatly scoped under `<dir>/productions/<slug>/` and `<dir>/styles/` while `.agents/plugins/make-pictures` sits at repo root so agents can import real app UI components into `60 FPS` product videos.
   - Pass `--dir=videos` to CLI commands (`npx make-pictures styles --dir=videos`, `npx make-pictures new <slug> --dir=videos`, `npx make-pictures audio --production=<slug> --dir=videos`, `npx make-pictures studio --dir=videos`, `npx make-pictures qa <Id> --dir=videos`, `npx make-pictures render <Id> --dir=videos`).
3. **Engine Monorepo (`make-pictures-studio`):**
   - `packages/*` holds engine source; `examples/*` holds showcase demos; `styles/*.style.json` holds custom style presets; `productions/<slug>/` holds isolated user films (`npm run new -- <slug>` or `npx make-pictures new <slug>`). Never hardcode user scene IDs inside `packages/` or `scripts/`.

*(Bonus Mode — **Live Web Embeds**: applications can also `npm i @make-pictures/core @make-pictures/kits` and mount kits wrapped in `<StyleProvider style="minimal-product" renderBackdrop>` directly inside `<Player numberOfSharedAudioTags={32} />` from `@remotion/player` on React/Next.js pages with zero MP4 rendering!)*

### Capsule & Workspace Styles Layout

```text
styles/
└── <brand-or-era>.style.json        # Reusable custom StylePreset auto-discovered in Studio Web, QA & Render
productions/<slug>/
├── production.json                  # Unified manifest: scenes (TTS), score (Music), sfx (Foley)
├── index.ts                         # defineProduction(...) auto-discovered by Studio Web & Remotion
├── compositions/
│   ├── <PascalSlug>.tsx             # 60 FPS Remotion composition wrapped in <StyleProvider style={props.styleId}>
│   └── <PascalSlug>.props.json      # Disk-backed Props Inspector state (includes styleId)
├── assets/                          # Cached .mp3/.json voiceovers, AI score, SFX, videos/, and images
└── generated/
    └── audio-manifest.ts            # Auto-generated typed voiceover timestamps & asset paths
```

Static assets inside `productions/<slug>/assets/` are mirrored/symlinked to `public/_productions/<slug>`. Always resolve URLs with `staticFile(productionAssetPath(slug, relPath))` from `@make-pictures/core`.

---

## The 6-Step Interactive Production Process

### Step 1: Creative Brief & Mandatory Art Direction Gate (`style-and-art-direction`)

> **MANDATORY GATE:** Load `style-and-art-direction` FIRST! **Never** default blindly to `paper-diorama-3d`. Match the film's topic, era, emotion, and brand to both a **Visual Kit** (or multi-kit combination across acts) and a **`StylePreset`** (`BUILT_IN_STYLES` or a custom `styles/<slug>.style.json`).

Confirm with the user (or propose 2–3 tailored art direction options if given creative freedom):
1. **Topic, goal, and audience** (documentary essay, SaaS launch promo, architecture explainer, social reel, studio dialogue).
2. **Language & aspect ratio:** `pl` or `en`; horizontal `16:9` (`1920×1080`), vertical `9:16` (`1080×1920` Shorts/Reels/TikTok), or both.
3. **Visual Kit(s) — choose from all 7 scene kits** (load the matching `kit-*` skill before coding!):
   - `editorial-collage` — Magazine chapters, deterministic Ken Burns media frames, word-synced quote highlights & split layouts (`kit-editorial-and-vector`)
   - `vector-scene-2d` — Clean 2D story cards, pointer callouts & side-by-side comparisons (`kit-editorial-and-vector`)
   - `kinetic-typography` — High-retention word-by-word spotlights, impact badges & KPI tickers (`kit-kinetic-and-data`)
   - `data-storytelling` — Animated bar races, chronological timelines & before/after metric cards (`kit-kinetic-and-data`)
   - `motion-diagrams-2d` — Infinite-canvas 2D system architecture, API flows & SaaS product frames (`kit-motion-diagrams-2d`)
   - `paper-diorama-3d` — Tactile 2.5D layered cutouts on neutral `DioramaStage3D` (`kit-paper-diorama-3d`)
   - `isometric-3d` — Multi-character 3D dialogue on neutral `IsometricStage3D` (`kit-isometric-3d`)
4. **Art Direction Style (`--style=<styleId>`):**
   - **7 Built-in Styles:** `minimal-product`, `editorial-press`, `archival-chronicle`, `cyber-telemetry`, `brutalist-poster`, `sketch-notebook`, `tactile-craft` (inspect via `npx make-pictures styles` or preview live at `60 FPS` in **Studio Web → `🎨 Style Lab`** at `http://127.0.0.1:3000?view=styles`).
   - **Custom Brand / Era Style (`styles/<slug>.style.json`):** Create a bespoke style via `npx make-pictures style new <slug> --from=editorial-press` and customize its palette, 13 `latin-ext` Google Fonts, surface chrome, and motion profile.

Scaffold the capsule immediately (append `--dir=<subdir>` if working inside a subdirectory studio):

```bash
# Clean 2D product / concept explainer (default kit + style):
npx make-pictures new <slug> --kit=vector-scene-2d --style=minimal-product --lang=pl

# Documentary / history / science essay:
npx make-pictures new <slug> --kit=editorial-collage --style=editorial-press --lang=pl
```

*(Supports all 7 kits via `--kit=...`, any built-in or custom style slug via `--style=...`, optional `--voice=<voiceId>` override, and `--lang=pl|en`. By default, `new` sets `styleId` in `*.props.json` and pairs `voiceId` + `score.moodPreset` in `production.json` from `style.audioDefaults` via `VOICE_ARCHETYPE_TO_ELEVENLABS_ID`.)*

---

### Step 2: Storyboard Pacing & `production.json` Manifest

Load `sound-and-music-design` and write `productions/<slug>/production.json` conforming to `ProductionManifest`:

```json
{
  "id": "printing-revolution",
  "title": "Jak prasa drukarska przyspieszyła naukę",
  "fps": 60,
  "scenes": [
    {
      "id": "s1-hook",
      "durationInSeconds": 4.5,
      "speaker": "Narrator",
      "voiceId": "EXAVITQu4vr4xnSDxMaL",
      "voiceEffect": "clean",
      "text": "W ciągu zaledwie pięćdziesięciu lat koszt książki spadł o osiemdziesiąt procent."
    }
  ],
  "score": {
    "id": "main-score",
    "mode": "prompt",
    "moodPreset": "news-pulse",
    "prompt": "Warm modern documentary piano and subtle felt strings pulse, instrumental",
    "forceInstrumental": true,
    "baseVolume": 0.24,
    "duckedVolume": 0.08
  },
  "sfx": [
    {
      "id": "reveal-whoosh",
      "prompt": "Subtle warm editorial card transition whoosh",
      "durationSeconds": 1.0,
      "fallbackPreset": "whoosh"
    }
  ]
}
```

#### Editorial & Pacing Rules (`60 FPS`)
- **3–5 Second Visual Beat Rule:** Introduce a new camera angle (`ShotSpec3D` / `DirectorCamera2D`), layout transition, media card, or data highlight every **`180–300` frames (`3–5 s`)** so the frame never stagnates.
- **Natural Breathing Pauses:** Leave **`32–42` frames** (`0.55–0.7 s`) between scenes and **`20–28` frames** after comedic or dramatic punchlines.
- **Visual Minimalism:** Never render walls of text. Use **Icon (`lucide-react`) + 2–3 words + visual indicator** (badge, progress bar, metric).
- **No Bottom Subtitles by Default:** Omit burned-in bottom captions unless the user explicitly asks for `VoiceoverCaptionBar`.
- **Polish Sentence Case:** In Polish videos, write `Jak działa pamięć podręczna` (Sentence case), **never** Anglo-Saxon `Jak Działa Pamięć Podręczna`. Frame headlines around viewer curiosity or benefit.

---

### Step 3: Unified Audio Generation & Mandatory `.mp3` Audition

1. Run `npx make-pictures doctor` (or `npx make-pictures onboard`) if this is the first session.
2. Generate voiceovers + word timestamps + AI music score + AI SFX:
   ```bash
   npx make-pictures audio --production=<slug>
   ```
   *(Add `--mock` for offline/zero-credit procedural synthesis during rapid structural tests, `--force` to bypass SHA-256 cache, or `--dir=<subdir>` in embedded SaaS repos.)*
3. **MANDATORY `.mp3` LISTEN GATE:** Read every newly generated voiceover `.mp3` inside `productions/<slug>/assets/` using `read_file` to verify acronym pronunciation, natural cadence, and unclipped word endings. Fix `text` phonetics in `production.json` and re-run `audio` if anything sounds robotic or mispronounced.

*(Optional visual asset helper: if `GEMINI_API_KEY` is configured in `.env.local`, generate custom illustrations via `npx make-pictures image "<prompt>" --out=productions/<slug>/assets/illustration.png` and mount them in `<EditorialMediaCard />` or `<ImageCutout3D />`.)*

---

### Step 4: `60 FPS` Implementation, `<StyleProvider>`, `zod` Schema & Director Timeline Metadata

1. **Read `<PascalSlug>.props.json` (and any `styles/*.style.json`) from disk first** before editing existing files so you never overwrite tweaks saved by the creator in **Studio Web** (`npx make-pictures studio`).
2. Wrap the composition in `<StyleProvider style={props.styleId} renderBackdrop>` and keep `styleId: z.string().describe('Kolory & Styl :: Styl bazowy (Style ID)')` in your exported `zod` schema alongside `'Section :: Label'` props (`'Teksty & Napisy :: Tytuł'`, `'Audio :: Głośność muzyki'`).
3. Load `cinematography-and-vfx` + your chosen `kit-*` skill(s). Synchronize visuals and audio via `getWordTriggerFrame(sceneId, word, fallbackFrame, voiceoverManifest?)`, `getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)`, `<VoiceoverTrack />`, `<SmartMusicBed />`, and `<SoundCue />` (never wrap `<Audio />` in `<Sequence>` without `durationInFrames`).
4. Wrap `productions/<slug>/index.ts` with `defineProduction({ id: '<slug>', manifest, voiceoverManifest, compositions: [...] })` from `@make-pictures/core` (auto-registering capsule timestamps and setting `origin: 'production'`, `productionId`, `sceneTimeline`, `cameraTimeline`, `sfxTimeline`, and `hasMusicScore`) so the Multi-Track Director Timeline in **Studio Web** visualizes every cut, voiceover segment, SFX cue, and ducking envelope.

---

### Step 5: Contact-Sheet Visual QA (`qa`)

Before running a full MP4 render, generate the automated 12-frame Contact-Sheet PNG:

```bash
npx make-pictures qa <CompositionId>
```

*(Optional flags: `--grid=4x3`, `--out=out/qa-<CompositionId>.png`, `--dir=<subdir>`.)*

**MANDATORY VISUAL INSPECTION:** Open `out/qa-<CompositionId>.png` with `read_file` and verify all 12 frames:
- **`f=0` Clean Board:** Frame `0` shows a clean `bgCanvas` background without half-rendered text or broken layout (`spring({ frame: frame - 2 })`).
- **Art Direction & Zero Collisions:** Typography (`latin-ext` Polish diacritics), palette, and card chrome match the chosen `StylePreset` with zero clipped headers, zero SVG curves slicing across titles, and zero 3D WebGL Z-fighting.
- **`9:16` Golden Safe Box (`1080×1920`):** On vertical compositions, `qa` draws the green Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`) and red social-UI dead zones (`top < 220`, `bottom < 480`, `right > 910` for `y > 900`). Confirm all key cards, faces, and titles sit strictly inside the green box.

---

### Step 6: Typecheck & Broadcast-Mastered Render (`-14 LUFS`)

1. Validate TypeScript across the project:
   ```bash
   npm run typecheck
   ```
2. Render the final `60 FPS` MP4 (automatically enables `--concurrency=100%`, `--gl=angle` for 3D, and EBU R128 `-14 LUFS` loudness mastering; pass `--no-master` only if raw unmastered audio is explicitly requested):
   ```bash
   npx make-pictures render <CompositionId> out/<slug>.mp4
   ```

---

## Embedding `.mp4` Screen Recordings (`<OffthreadVideo />` + `@make-pictures/kits/product-frames`)

SaaS walkthroughs and product demos usually start from a real screencast. Every capsule ships with `productions/<slug>/assets/videos/` for exactly this.

1. Drop the recording into `productions/<slug>/assets/videos/demo.mp4` (H.264 MP4 at 30 or 60 FPS works best).
2. It is mirrored to `public/_productions/<slug>/videos/demo.mp4`, so reference it with `staticFile('_productions/<slug>/videos/demo.mp4')` (or `staticFile(productionAssetPath('<slug>', 'videos/demo.mp4'))`).
3. Wrap it in a device frame inside `<StyleProvider>`. Both frames inherit theme accents from `useStudioStyle()` and render the video through Remotion `<OffthreadVideo />`, so the output is frame-accurate under `--concurrency=100%`:

```tsx
import { staticFile } from 'remotion';
import { StyleProvider, productionAssetPath } from '@make-pictures/core';
import {
  BrowserFrame,
  PhoneFrame,
  ScreenSpotlightOverlay,
} from '@make-pictures/kits/product-frames';

const DEMO = staticFile(productionAssetPath('my-film', 'videos/demo.mp4'));

<StyleProvider style={props.styleId} renderBackdrop>
  {/* 16:9 desktop SaaS */}
  <BrowserFrame url="app.example.com/dashboard" videoSrc={DEMO} startFrom={0} width={1360} enterFrame={2}>
    <ScreenSpotlightOverlay x={62} y={18} width={30} height={14} startFrame={90} endFrame={210} label="Nowy raport" />
  </BrowserFrame>

  {/* 9:16 mobile app (default 520 px wide, fits the Golden Safe Box x ∈ [40, 910], y ∈ [220, 1380]) */}
  <PhoneFrame videoSrc={DEMO} variant="dynamic-island" />
</StyleProvider>
```

- **`BrowserFrame` props:** `url`, `title`, `variant: 'macos' | 'arc' | 'minimal'`, `theme: 'dark' | 'light'`, `width` (default `1360`), `aspectRatio` (default `'16 / 10'`) or `height`, `enterFrame` (default `2`), `accentColor`, plus media props `videoSrc` / `imageSrc` / `startFrom` / `endAt` / `playbackRate` / `muted` (default `true`) / `volume` / `objectFit`.
- **`PhoneFrame` props:** `variant: 'dynamic-island' | 'minimal'`, `theme`, `width` (default `520`), `aspectRatio` (default `'9 / 19.5'`) or `height`, `enterFrame`, plus the same media props.
- **`ScreenSpotlightOverlay` props:** `x`, `y`, `width`, `height` (percent `0..100` by default, or `unit="px"`), `startFrame`, `endFrame?`, `label?` (2–3 words), `accentColor` (defaults to `useStudioStyle().palette.accentPrimary`), `dimOpacity` (default `0.45`), `borderRadius` (default `14`), `labelPosition: 'auto' | 'top' | 'bottom'`.
- **Zoom shots:** Put the frame inside `<DirectorCamera2D nodes={{ app: { cx, cy, w, h }, cta: {...} }} shots={[...]}>` to push in on the spotlighted region (`transition: 'glide'`) the way Screen Studio does.
- Keep `muted` on unless the recording's own audio matters. The voiceover and `SmartMusicBed` carry the soundtrack.
- Check in `npx make-pictures qa <CompositionId>` that `f=0` is clean (frames start at `opacity: 0`) and that the spotlight ring sits exactly on the intended UI element.
