<p align="center">
  <a href="https://make.pictures"><img src="./public/brand/make-pictures-logo.svg" alt="make.pictures — Open-source 60 FPS Video-as-Code Studio" width="540" /></a>
</p>

<p align="center">
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Studio-FF2A85?style=for-the-badge&labelColor=0F172A" alt="make.pictures Studio" /></a>
  <img src="https://img.shields.io/badge/Render-60_FPS_Remotion_%2B_Three.js-2563EB?style=for-the-badge&labelColor=0F172A" alt="Render: 60 FPS Remotion + Three.js" />
  <img src="https://img.shields.io/badge/Audio-ElevenLabs_Voice_•_Music_•_SFX-7209B7?style=for-the-badge&labelColor=0F172A" alt="Audio: ElevenLabs Voice, Music & SFX" />
  <img src="https://img.shields.io/badge/Agents-Antigravity_%26_Claude_Code-0096C7?style=for-the-badge&labelColor=0F172A" alt="Agents: Antigravity & Claude Code" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-FF5E00?style=for-the-badge&labelColor=0F172A" alt="License: MIT" /></a>
</p>

<p align="center">
  <strong>Open-source animation studio powered by code.</strong><br />
  Turn ideas and real React UI into broadcast-mastered 60 FPS films with TypeScript, Remotion, Three.js and ElevenLabs — directed by Google Antigravity &amp; Claude Code.
</p>

<p align="center">
  <a href="https://make.pictures">🌐 make.pictures</a> •
  <a href="https://www.youtube.com/@makepicturestv">📺 YouTube (EN) @makepicturestv</a> •
  <a href="https://www.youtube.com/@makepicturespl">📺 YouTube (PL) @makepicturespl</a> •
  <a href="./README.pl.md">🇵🇱 Polska dokumentacja</a>
</p>

> [!TIP]
> **Zero-terminal setup — just paste this single prompt into Google Antigravity or Claude Code:**
>
> ```text
> Set up make.pictures video studio for me: run `npx -y @make-pictures/cli@latest onboard --lang=en` and follow every step until Studio Web is running.
> ```
>
> Your agent automatically scaffolds the project, connects ElevenLabs in your browser (saving `ELEVENLABS_API_KEY` to `.env.local`), launches the `60 FPS` **Studio Web** preview at `http://127.0.0.1:3000`, and asks what film you want to build.

---

## 🎬 Featured Episode — Made Entirely with `make.pictures`

<p align="center">
  <a href="https://www.youtube.com/watch?v=IL4jrUKzkOA"><img src="./docs/showcase/thumbnail-en-1280x720.png" alt="Two feet on top of the world: why scientists added 2 fake feet to Mount Everest" width="760" /></a>
</p>

<p align="center">
  <strong><a href="https://www.youtube.com/watch?v=IL4jrUKzkOA">Two feet on top of the world: why scientists added 2 fake feet to Mount Everest</a></strong><br />
  <sub>How Mount Everest was measured from 120 miles away in 1852 — every frame, camera move, voice line and sound cue is TypeScript running at 60 FPS.</sub>
</p>

### From "CCTV footage" to a 2.5D pop-up book — 3 stages of AI direction

Iterative prompting inside `make.pictures` evolved the same Calcutta survey-office scene from raw geometry to a broadcast-ready shot:

| Stage 1 — Initial Geometry | Stage 2 — Paper Cutouts &amp; Depth | Stage 3 — Broadcast Lighting, Atmosphere &amp; Camera |
| :---: | :---: | :---: |
| <img src="./docs/showcase/stage1-v1-calcutta.jpg" alt="Stage 1: raw 3D prototype" width="280" /> | <img src="./docs/showcase/stage2-v2-calcutta.jpg" alt="Stage 2: flat 2D SVG attempt" width="280" /> | <img src="./docs/showcase/stage3-v8-calcutta.jpg" alt="Stage 3: final 2.5D paper pop-up book" width="280" /> |
| Raw 3D: paper stacks are white pillars, clerks are spheres on boxes. | Flat 2D SVG: the floor reads like bathroom tiles, arms like semaphores. | Die-cut paper figures with cream borders and cardboard thickness, lit by window sunlight. |

---

## 🚀 3 Official Ways to Use `make.pictures` 2.0

### 1. Standalone Video Studio (`npx create-make-pictures@latest`)
A dedicated Git repository for your channel, agency, or documentary series. Your `productions/*` films are tracked in Git while the whole engine runs from `node_modules/@make-pictures/*`. The AI plugin is wired up automatically for every agent (`AGENTS.md` + `.agents/plugins/make-pictures/` and `CLAUDE.md` + `.claude/skills/`):

```bash
npx create-make-pictures@latest my-films --kit=paper-diorama-3d --lang=en
cd my-films
npx make-pictures onboard
npx make-pictures studio
```

### 2. Inside an Existing SaaS / App Repo (`npx make-pictures init`)
Drop a 60 FPS video studio into your Next.js, Vite, or monorepo codebase. It scaffolds `videos/productions/` and syncs the AI skills into your repo root, so your coding agent can import **your real React components** — or your `.mp4` screen recordings — and turn them into launch trailers and product demos:

```bash
npm i -D @make-pictures/cli @make-pictures/studio @make-pictures/core @make-pictures/kits
npx make-pictures init --dir=videos --kit=motion-diagrams-2d
npx make-pictures studio --dir=videos
```

### 3. Live Interactive Web Embeds (`@make-pictures/core` + `@make-pictures/kits`)
Mount 60 FPS architecture diagrams, bar races, or 3D stages on React / Next.js pages through `@remotion/player` — crisp vector DOM/WebGL with zero MP4 encoding:

```bash
npm i @make-pictures/core @make-pictures/kits @remotion/player remotion zod lucide-react
```

```tsx
import { Player } from '@remotion/player';
import { DirectorCamera2D } from '@make-pictures/core/camera';
import { WorldBox, FlowCurve, portRight, portLeft } from '@make-pictures/kits/motion-diagrams-2d';
```

---

## 📦 Published npm Ecosystem (`v2.0.2`)

| Package | Role |
| :--- | :--- |
| **`create-make-pictures`** | Zero-config project initializer (`npx create-make-pictures@latest <dir>`) |
| **`@make-pictures/core`** | Deterministic 60 FPS runtime: `defineProduction`, `SPRING_PRESETS`, `createSeededRandom`, `DirectorCamera3D` / `DirectorCamera2D` Shot DSL, `<SmartMusicBed />` auto-ducking, `<SoundCue />`, `VoiceAcousticPreset` |
| **`@make-pictures/kits`** | Tree-shakeable subpath kits: `paper-diorama-3d`, `isometric-3d`, `motion-diagrams-2d`, `kinetic-typography`, `data-storytelling`, `product-frames`, and deterministic `vfx` |
| **`@make-pictures/studio`** | Local 60 FPS HMR **Studio Web** client &amp; programmatic Vite server (Multi-Track Director Timeline, Golden Safe Box `9:16`, Props Inspector `zod` ↔ `*.props.json`) |
| **`@make-pictures/cli`** | Unified `make-pictures` CLI (`onboard`, `doctor`, `init`, `new`, `audio`, `music`, `sfx`, `studio`, `qa`, `render`, `image`) + bundled AI plugin |

---

## ✨ Studio Highlights

- **Unified AI audio studio (1 API key = voice + music + SFX):**
  - **Word-aligned TTS + acoustic filters:** millisecond word timestamps (`eleven_multilingual_v2`) and declarative `VoiceAcousticPreset` filters (`clean`, `telephone`, `radio-walkie`, `cathedral`, `megaphone`, `excitement-boost`).
  - **AI music with sidechain auto-ducking (`<SmartMusicBed />`):** ElevenLabs Music scores (`prompt` or `composition-plan` sections), lookahead ducking under dialogue, beat-reactive `useMusicBeatPulse`, and 6 offline procedural mood presets.
  - **AI sound effects &amp; word-synced foley (`<SoundCue />`):** ElevenLabs Sound Effects triggered at exact frames or spoken words (`onWord`), finished with automatic **EBU R128 `-14 LUFS`** loudness mastering.
- **Declarative Shot DSL camera (`DirectorCamera3D` &amp; `DirectorCamera2D`):** film grammar (`establishing-wide`, `medium-two-shot`, `close-up`, `over-the-shoulder`, `low-angle-hero`, `high-crane`, `cut | glide | whip | orbit`, `dolly-zoom`), deterministic handheld sway &amp; impact shake, and automatic **`9:16` Golden Safe Box (`x ∈ [40, 910], y ∈ [220, 1380]`)** framing for Shorts / Reels / TikTok.
- **Deterministic 60 FPS VFX (`@make-pictures/kits/vfx`):** velocity-coupled `CinematicLensOverlay` (vignette, seeded grain, whip-pan chromatic aberration, light leaks), analytical `ParticleField`, `StagePostProcessing3D` volumetric fog, and `SceneTransition` wipes.
- **SaaS screencasts (`@make-pictures/kits/product-frames`):** drop an `.mp4` into `productions/<slug>/assets/videos/` and frame it with `BrowserFrame` / `PhoneFrame` + `ScreenSpotlightOverlay` callouts and `DirectorCamera2D` zooms.
- **12-frame Contact-Sheet QA (`npx make-pictures qa <Id>`):** one command renders 12 key frames with frame badges and `9:16` safe-zone overlays into `out/qa-<Id>.png` for instant human and AI visual review.
- **Portable AI plugin with zero-flag discovery:** native **Google Antigravity** (`.agents/plugins/make-pictures/`) and **Claude Code** (`.claude/skills/` + `CLAUDE.md`) plugin with 7 progressive `SKILL.md` modules — a compact `AGENTS.md` core rulebook cuts baseline prompt context by **~80%**.

---

## 🎨 Visual Kits &amp; VFX (`@make-pictures/kits`)

| Kit / Module | Import Path | Key Primitives | Best For |
| :--- | :--- | :--- | :--- |
| **1. Paper Diorama 3D** *(2.5D pop-up book)* | `@make-pictures/kits/paper-diorama-3d` | `PaperCutout3D`, `ImageCutout3D`, `PopUpHinge3D`, `PopUpBookBase3D`, `PaperBookPageTurn3D`, `PaperStageLighting3D` | Storytelling, history &amp; science explainers, theatrical cardboard worlds |
| **2. Isometric 3D Studio** | `@make-pictures/kits/isometric-3d` | `Stylized3DCharacter`, `IsometricStudioEnvironment` | Multi-character 3D dialogues, podcasts, tech explainers |
| **3. Motion Diagrams 2D** | `@make-pictures/kits/motion-diagrams-2d` | `DirectorCamera2D` / `CameraRig`, `NodeBox` (`portTop/Bottom/Left/Right`), `FlowCurve`, `DataFlowEdge`, `SystemNode` | System architecture, SaaS workflows, infinite-canvas explainers |
| **4. Kinetic Typography** | `@make-pictures/kits/kinetic-typography` | `WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter` | High-retention Shorts / Reels, word-synced hooks, animated KPIs |
| **5. Data Storytelling** | `@make-pictures/kits/data-storytelling` | `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard` | Bar races, roadmap timelines, before/after benchmarks |
| **6. Cinematic VFX** | `@make-pictures/kits/vfx` | `CinematicLensOverlay`, `ParticleField`, `StagePostProcessing3D`, `ContactShadowDisc3D`, `SceneTransition` | Film grain, lens aberration, snow / sparks / dust, 3D fog &amp; transitions |
| **7. Product Frames** | `@make-pictures/kits/product-frames` | `BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay` (`<OffthreadVideo />`) | SaaS `.mp4` screencasts, product walkthroughs, launch demos |

---

## 🧠 AI Plugin &amp; Progressive Skills (`plugins/make-pictures/`)

Every agent reads a ~5 KB [`AGENTS.md`](./AGENTS.md) rulebook (Claude Code: [`CLAUDE.md`](./CLAUDE.md)) and loads specialized skills only when needed:

| Skill | Scope |
| :--- | :--- |
| `make-pictures-director` | 6-step production workflow, workspace modes, `production.json`, 3–5 s beat pacing, Contact-Sheet QA, `-14 LUFS` render, `.mp4` screencasts |
| `kit-paper-diorama-3d` | `PaperCutout3D` / `ImageCutout3D` borders, `Δz` anti-Z-fighting, Polish `maxWidth`, 3-phase page turns |
| `kit-motion-diagrams-2d` | `NodeBox` ports, `FlowCurve` header detours (`curveX`), infinite grid, `92–120` frame packets, product frames |
| `kit-isometric-3d` | `speakingWeight` vs `speechEnergy`, `getSmoothPoseWindow`, calm 60 FPS frequency limits |
| `kit-kinetic-and-data` | `WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard` |
| `sound-and-music-design` | ElevenLabs voice profiles, PL/EN phonetics, `VoiceAcousticPreset`, `<SmartMusicBed />`, `<SoundCue />` |
| `cinematography-and-vfx` | `DirectorCamera3D` / `DirectorCamera2D` Shot DSL, `9:16` safe-box framing, camera shake, deterministic VFX |

---

## 🛠️ CLI Reference (`npx make-pictures`)

| Command | Description |
| :--- | :--- |
| `npx make-pictures onboard` | Agent-driven onboarding (browser sign-in via `@elevenlabs/cli`, saves `ELEVENLABS_API_KEY` to `.env.local`) |
| `npx make-pictures doctor` | Check Node.js, FFmpeg, `.env.local`, ElevenLabs connectivity, and Remotion readiness |
| `npx make-pictures init` | Add a studio + AI plugin to an existing app (`--dir=videos`) |
| `npx make-pictures new <slug>` | Scaffold a film capsule in `productions/<slug>/` (`--kit=...`, `--lang=pl\|en`, `--dir=...`) |
| `npx make-pictures audio` | Voiceovers + word timestamps + AI music + AI SFX (`--production=<slug>`, `--mock`, `--force`) |
| `npx make-pictures studio` | **Studio Web** at `http://127.0.0.1:3000`: 60 FPS HMR stage, Multi-Track Director Timeline, Golden Safe Box, Props Inspector, QA &amp; MP4 export |
| `npx make-pictures qa <Id>` | 12-frame Contact-Sheet PNG (`out/qa-<Id>.png`) with frame badges &amp; `9:16` overlays |
| `npx make-pictures render <Id>` | 60 FPS MP4 (auto `--gl=angle` for 3D) + EBU R128 `-14 LUFS` mastering |

---

## 🧑‍💻 Developing the Studio Monorepo

Explore the built-in showcases (`DirectorShowcase`, `StarterStory`, `PaperDioramaDemo`, `IsometricDialogueDemo`, `ArchitectureDemo`) or contribute to `@make-pictures/*`:

```bash
git clone https://github.com/make-pictures/make-pictures-studio.git
cd make-pictures-studio
npm install
npm run onboard        # or: npm run setup (manual .env.local)
npm run studio         # Studio Web with all examples/* at http://127.0.0.1:3000
npm run build:packages # builds @make-pictures/{core,kits,studio,cli} & create-make-pictures
npm run pack:verify    # hermetic end-to-end .tgz consumer verification
```

---

## 🌐 Community &amp; Channels

- **Website:** [make.pictures](https://make.pictures)
- **YouTube (English):** [@makepicturestv](https://www.youtube.com/@makepicturestv)
- **YouTube (Polski):** [@makepicturespl](https://www.youtube.com/@makepicturespl)

## 📄 License

Released under the [MIT License](./LICENSE). Free for personal, educational, and commercial use.
