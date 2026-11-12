---
name: make-pictures-director
description: >-
  End-to-end 6-step production workflow for creating 60 FPS animated videos in
  make.pictures Studio (standalone create-make-pictures repos, embedded SaaS
  repos via make-pictures init --dir=videos, or the engine monorepo). Use this
  skill whenever starting a new film, scaffolding productions/<slug>/, authoring
  production.json storyboards, running audio generation, inspecting 12-frame
  Contact-Sheet QA PNGs, or rendering mastered -14 LUFS MP4 videos.
---

# make.pictures Director — 6-Step Production Workflow (`60 FPS`)

Use this runbook to guide every new film from initial user idea to broadcast-mastered `60 FPS` MP4 across any `make.pictures` 2.0 workspace.

---

## Project Modes & Universal CLI (`npx make-pictures`)

`make.pictures` runs identically across **3 workspace layouts** via the `@make-pictures/cli` binary (`npx make-pictures <command>`, also wired to `npm run <command>` in standalone and monorepo `package.json` files):

1. **Standalone Video Studio (`npx create-make-pictures@latest my-films`):**
   - Engine packages (`@make-pictures/{core,kits,studio,cli}`) live in `node_modules/`.
   - `productions/<slug>/` is the user's primary Git-tracked source code!
   - Commands: `npx make-pictures new <slug>`, `npx make-pictures audio`, `npx make-pictures studio`, `npx make-pictures qa <Id>`, `npx make-pictures render <Id>`.
2. **Embedded Inside an Existing SaaS / Web Repo (`npx make-pictures init --dir=videos`):**
   - Keeps video capsules neatly scoped under `<dir>/productions/<slug>/` while `.agents/plugins/make-pictures` sits at repo root so agents can import real app UI components into `60 FPS` product videos.
   - Pass `--dir=videos` to CLI commands (`npx make-pictures new <slug> --dir=videos`, `npx make-pictures audio --production=<slug> --dir=videos`, `npx make-pictures studio --dir=videos`, `npx make-pictures qa <Id> --dir=videos`, `npx make-pictures render <Id> --dir=videos`).
3. **Engine Monorepo (`make-pictures-studio`):**
   - `packages/*` holds engine source; `examples/*` holds showcase demos; `productions/<slug>/` holds isolated user films (`npm run new -- <slug>` or `npx make-pictures new <slug>`). Never hardcode user scene IDs inside `packages/` or `scripts/`.

*(Bonus Mode — **Live Web Embeds**: applications can also `npm i @make-pictures/core @make-pictures/kits` and mount kits directly inside `<Player numberOfSharedAudioTags={32} />` from `@remotion/player` on React/Next.js pages with zero MP4 rendering!)*

### Capsule Layout (`productions/<slug>/`)

```text
productions/<slug>/
├── production.json                  # Unified manifest: scenes (TTS), score (Music), sfx (Foley)
├── index.ts                         # defineProduction(...) auto-discovered by Studio Web & Remotion
├── compositions/
│   ├── <PascalSlug>.tsx             # 60 FPS Remotion composition + exported Zod schema
│   └── <PascalSlug>.props.json      # Disk-backed Props Inspector state
├── assets/                          # Cached .mp3/.json voiceovers, AI score, SFX, and generated images
└── generated/
    └── audio-manifest.ts            # Auto-generated typed voiceover timestamps & asset paths
```

Static assets inside `productions/<slug>/assets/` are mirrored/symlinked to `public/_productions/<slug>`. Always resolve URLs with `staticFile(productionAssetPath(slug, relPath))` from `@make-pictures/core`.

---

## The 6-Step Interactive Production Process

### Step 1: Brief Creative Interview & Kit Selection

Confirm with the user (or propose sensible defaults if given creative freedom):
1. **Topic, goal, and audience** (science story, architecture explainer, SaaS launch promo, narrative dialogue).
2. **Language & voice cast** (`pl` or `en`; single narrator vs. multi-character dialogue).
3. **Aspect ratio:** Horizontal `16:9` (`1920×1080`), vertical `9:16` (`1080×1920` Shorts/Reels/TikTok), or both.
4. **Visual Kit** (load the matching `kit-*` skill before coding!):
   - `paper-diorama-3d` — 2.5D Pop-Up Book cardboard theater (`kit-paper-diorama-3d`)
   - `motion-diagrams-2d` — Infinite-canvas 2D architecture & workflows (`kit-motion-diagrams-2d`)
   - `isometric-3d` — 3D isometric studio character dialogue (`kit-isometric-3d`)
   - `kinetic-typography` / `data-storytelling` — High-impact word spotlights, counters, bar races & timelines (`kit-kinetic-and-data`)

Scaffold the capsule immediately (append `--dir=<subdir>` if working inside a subdirectory studio):

```bash
npx make-pictures new <slug> --kit=paper-diorama-3d --lang=pl
```

*(Supports `--kit=motion-diagrams-2d|paper-diorama-3d|isometric-3d|kinetic-typography|data-storytelling` and `--lang=pl|en`; inside the engine monorepo `npm run new -- <slug> ...` is an equivalent shortcut.)*

---

### Step 2: Storyboard Pacing & `production.json` Manifest

Load `sound-and-music-design` and write `productions/<slug>/production.json` conforming to `ProductionManifest`:

```json
{
  "id": "cosmic-lighthouse",
  "title": "Latarnia na krańcu układu",
  "fps": 60,
  "scenes": [
    {
      "id": "s1-hook",
      "durationInSeconds": 4.5,
      "speaker": "Narrator",
      "voiceId": "TX3LPaxmHKxFdv7VOQHJ",
      "voiceEffect": "clean",
      "text": "Przez czterdzieści lat odbieraliśmy sygnał z pustej przestrzeni!"
    }
  ],
  "score": {
    "id": "main-score",
    "mode": "prompt",
    "moodPreset": "paper-expedition",
    "prompt": "Warm cinematic chamber strings and subtle marimba pulse, instrumental",
    "forceInstrumental": true,
    "baseVolume": 0.24,
    "duckedVolume": 0.08
  },
  "sfx": [
    {
      "id": "page-slide",
      "prompt": "Crisp heavy paper pop-up book page turn",
      "durationSeconds": 1.2,
      "fallbackPreset": "whoosh"
    }
  ]
}
```

#### Editorial & Pacing Rules (`60 FPS`)
- **3–5 Second Visual Beat Rule:** Introduce a new camera angle (`ShotSpec3D` / `DirectorCamera2D`), unfolding prop, or card highlight every **`180–300` frames (`3–5 s`)** so the frame never stagnates.
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

*(Optional visual asset helper: if `GEMINI_API_KEY` is configured in `.env.local`, generate custom props via `npx make-pictures image "<prompt>" --out=productions/<slug>/assets/prop.png` and mount them in 3D with `<ImageCutout3D />`.)*

---

### Step 4: `60 FPS` Implementation, `zod` Schema & Director Timeline Metadata

1. **Read `<PascalSlug>.props.json` from disk first** before editing any existing composition so you never overwrite tweaks saved by the creator in **Studio Web** (`npx make-pictures studio`).
2. Export a `zod` schema with `'Section :: Label'` descriptions (`'Teksty & Napisy :: Tytuł'`, `'Kolory & Styl :: Akcent'`, `'Audio :: Głośność muzyki'`, `'Kamera & Układ :: Korekta dystansu Z'`).
3. Load `cinematography-and-vfx` + your chosen `kit-*` skill. Synchronize visuals and audio via `getWordTriggerFrame(sceneId, word, fallbackFrame, voiceoverManifest?)`, `getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)`, `<VoiceoverTrack />`, `<SmartMusicBed />`, and `<SoundCue />` (never wrap `<Audio />` in `<Sequence>` without `durationInFrames`).
4. Wrap `productions/<slug>/index.ts` with `defineProduction({ id: '<slug>', manifest, voiceoverManifest, compositions: [...] })` from `@make-pictures/core` (auto-registering capsule timestamps and setting `origin: 'production'`, `productionId`, `sceneTimeline`, `cameraTimeline`, `sfxTimeline`, and `hasMusicScore`) so the Multi-Track Director Timeline in **Studio Web** visualizes every cut, voiceover segment, SFX cue, and ducking envelope.

---

### Step 5: Contact-Sheet Visual QA (`qa`)

Before running a full MP4 render, generate the automated 12-frame Contact-Sheet PNG:

```bash
npx make-pictures qa <CompositionId>
```

*(Optional flags: `--grid=4x3`, `--out=out/qa-<CompositionId>.png`, `--dir=<subdir>`.)*

**MANDATORY VISUAL INSPECTION:** Open `out/qa-<CompositionId>.png` with `read_file` and verify all 12 frames:
- **`f=0` Clean Board:** Frame `0` shows a clean background without half-rendered text or broken layout (`spring({ frame: frame - 2 })`).
- **Zero Collisions:** No clipped Polish headers, no SVG curves slicing across titles, and no 3D WebGL Z-fighting.
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
3. Wrap it in a device frame. Both frames render the video through Remotion `<OffthreadVideo />`, so the output is frame-accurate under `--concurrency=100%`:

```tsx
import { staticFile } from 'remotion';
import { productionAssetPath } from '@make-pictures/core';
import {
  BrowserFrame,
  PhoneFrame,
  ScreenSpotlightOverlay,
} from '@make-pictures/kits/product-frames';

const DEMO = staticFile(productionAssetPath('my-film', 'videos/demo.mp4'));

// 16:9 desktop SaaS
<BrowserFrame url="app.example.com/dashboard" videoSrc={DEMO} startFrom={0} width={1360} enterFrame={2}>
  <ScreenSpotlightOverlay x={62} y={18} width={30} height={14} startFrame={90} endFrame={210} label="Nowy raport" />
</BrowserFrame>

// 9:16 mobile app (default 520 px wide, fits the Golden Safe Box x ∈ [40, 910], y ∈ [220, 1380])
<PhoneFrame videoSrc={DEMO} variant="dynamic-island" />
```

- **`BrowserFrame` props:** `url`, `title`, `variant: 'macos' | 'arc' | 'minimal'`, `theme: 'dark' | 'light'`, `width` (default `1360`), `aspectRatio` (default `'16 / 10'`) or `height`, `enterFrame` (default `2`), `accentColor`, plus media props `videoSrc` / `imageSrc` / `startFrom` / `endAt` / `playbackRate` / `muted` (default `true`) / `volume` / `objectFit`.
- **`PhoneFrame` props:** `variant: 'dynamic-island' | 'minimal'`, `theme`, `width` (default `520`), `aspectRatio` (default `'9 / 19.5'`) or `height`, `enterFrame`, plus the same media props.
- **`ScreenSpotlightOverlay` props:** `x`, `y`, `width`, `height` (percent `0..100` by default, or `unit="px"`), `startFrame`, `endFrame?`, `label?` (2–3 words), `accentColor` (default `'#38bdf8'`), `dimOpacity` (default `0.45`), `borderRadius` (default `14`), `labelPosition: 'auto' | 'top' | 'bottom'`.
- **Zoom shots:** Put the frame inside `<DirectorCamera2D nodes={{ app: { cx, cy, w, h }, cta: {...} }} shots={[...]}>` to push in on the spotlighted region (`transition: 'glide'`) the way Screen Studio does.
- Keep `muted` on unless the recording's own audio matters. The voiceover and `SmartMusicBed` carry the soundtrack.
- Check in `npx make-pictures qa <CompositionId>` that `f=0` is clean (frames start at `opacity: 0`) and that the spotlight ring sits exactly on the intended UI element.
