# 🎬 make.pictures — Open-Source 60 FPS Video-as-Code Studio

<p align="center">
  <strong>Turn ideas into broadcast-grade 60 FPS animations using TypeScript, React, Three.js, Remotion, and ElevenLabs — powered by Google Antigravity & Claude Code.</strong>
</p>

<p align="center">
  <a href="https://make.pictures">🌐 make.pictures</a> •
  <a href="https://www.youtube.com/@makepicturestv">📺 YouTube (EN: @makepicturestv)</a> •
  <a href="https://www.youtube.com/@makepicturespl">📺 YouTube (PL: @makepicturespl)</a> •
  <a href="./README.pl.md">🇵🇱 Dokumentacja po polsku (README.pl.md)</a> •
  <a href="./LICENSE">⚖️ MIT License</a>
</p>

> [!TIP]
> **Get started with your coding agent. No account or API key needed beforehand.**
>
> Paste this into **Google Antigravity**, **Claude Code**, **Cursor** or **Codex**. It installs dependencies, signs you in or creates an ElevenLabs account in your browser, saves `ELEVENLABS_API_KEY` to `.env.local` (never shown in chat), and prepares the 60 FPS studio:
>
> ```text
> Set up make.pictures studio: run `npm run onboard` and follow what it prints.
> ```

---

## ✨ What is `make.pictures`?

**make.pictures** is an open-source **Video-as-Code** studio designed to work natively with agentic AI coding environments (**Google Antigravity** and **Claude Code**).

Instead of keyframing by hand in After Effects or modeling in Blender, every character, 3D paper cutout, camera flight, triangulation ray, and data-flow diagram is a deterministic **TypeScript + React** program running at **60 FPS** and synchronized to the exact millisecond of **ElevenLabs** word-level timestamps.

- **Domain-Agnostic & Multi-Style:** Create science documentaries, history stories, technical architecture explainers, product demos, or vertical YouTube Shorts / Reels (`9:16`).
- **Modular Visual Kits (`src/kits/`):** Choose from 3 built-in production kits (`paper-diorama-3d`, `isometric-3d`, `motion-diagrams-2d`) or ask your AI agent to generate a brand-new visual kit on demand.
- **Word-Accurate Audio Sync (SHA-256 Cached):** `npm run voiceover` generates `.mp3` tracks and character/word alignment `.json` files via ElevenLabs (`eleven_multilingual_v2`), with automatic deterministic offline fallback when no API key is configured.
- **Pre-Tuned Agent Rules (`AGENTS.md` & `CLAUDE.md`):** Built-in guardrails teach Google Antigravity and Claude Code how to avoid WebGL Z-fighting, rubbery springs, clipped headers, and robotic character jitter.

---

## 🎨 Modular Visual Kits (`src/kits/`)

| Visual Kit | Folder | Key Primitives | Best For |
| :--- | :--- | :--- | :--- |
| **1. Paper Diorama 3D** *(2.5D Pop-Up Book)* | [`src/kits/paper-diorama-3d/`](./src/kits/paper-diorama-3d) | `PaperCutout3D`, `PopUpHinge3D`, `PaperBookPageTurn3D`, `PaperStageLighting3D` | Storytelling, history & science explainers, theatrical 2.5D animations |
| **2. Isometric 3D Studio** | [`src/kits/isometric-3d/`](./src/kits/isometric-3d) | `Stylized3DCharacter`, `IsometricStudioEnvironment` | Multi-character 3D dialogues, tech explainers, podcast/conversation visuals |
| **3. Motion Diagrams 2D** | [`src/kits/motion-diagrams-2d/`](./src/kits/motion-diagrams-2d) | `CameraRig` (infinite grid), `NodeBox` (`portTop/Bottom/Left/Right`), `FlowCurve`, `DataFlowEdge`, `SystemNode` | System architecture, SaaS/product workflows, one-shot infinite canvas stories |
| **+ Custom AI Kits** | [`src/kits/README.md`](./src/kits/README.md) | Generated on request by Antigravity / Claude Code | Flat Vector 2D, Kinetic Typography, Low-Poly 3D, Retro Pixel, Data Storytelling |

---

## 🚀 Quickstart

### Set up with your coding agent

You do not need an ElevenLabs account or API key before you start. Clone the repository, open it in **Google Antigravity**, **Claude Code**, **Cursor** or **Codex**, and paste:

```text
Set up make.pictures studio: run `npm run onboard` and follow what it prints.
```

`npm run onboard` ([`scripts/onboard.mjs`](./scripts/onboard.mjs), powered by `@elevenlabs/cli onboard`) takes it from there and tells your agent each step:
1. Installs dependencies (`npm install`) and checks `ffmpeg`.
2. Opens your browser once so you can sign in to ElevenLabs (or create an account) and click **Authorize**.
3. Saves `ELEVENLABS_API_KEY` directly in `.env.local` (kept out of git and **never** shown in chat).
4. Verifies 60 FPS Remotion rendering and asks what animation you'd like to build.

*(Want to run only the official ElevenLabs CLI onboarding step directly? Paste: ``Add ElevenLabs to my project: run `npx -y @elevenlabs/cli@latest onboard init` and follow what it prints.``)*

### Set up by hand

<details>
<summary><b>Prefer manual terminal setup? (Click to expand)</b></summary>

```bash
git clone https://github.com/make-pictures/make-pictures-studio.git
cd make-pictures-studio
npm install
npm run setup
```

Open `.env.local` and paste your `ELEVENLABS_API_KEY` (get one at [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)):

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Verify your environment at any time with:

```bash
npm run doctor
```
</details>

---

## 🛠️ Core Commands

| Command | Description |
| :--- | :--- |
| `npm run onboard` | Agent-driven onboarding (`init` → browser sign-in via `@elevenlabs/cli` → `check`) |
| `npm run doctor` | Check Node.js, FFmpeg, `.env.local`, ElevenLabs API connectivity, and Remotion readiness |
| `npm run setup` | Create `.env.local` from `.env.example` and run the environment doctor |
| `npm run voiceover` | Generate `.mp3` voiceovers + word-level `.json` timestamps from `scenes.json` (SHA-256 cached) |
| `npm run studio` | Launch interactive Remotion Studio (`http://localhost:3000`) to preview all compositions at 60 FPS |
| `npm run render` | Render the `StarterStory` (`16:9`, `1920×1080` @ `60 FPS`) to `out/starter-story.mp4` |
| `npm run render:vertical` | Render the vertical `StarterStoryVertical` (`9:16`, `1080×1920` @ `60 FPS`) |
| `npm run render:diorama` | Render `PaperDioramaDemo` (`paper-diorama-3d` kit @ `60 FPS`, `--gl=angle`) |
| `npm run render:iso` | Render `IsometricDialogueDemo` (`isometric-3d` kit @ `60 FPS`, `--gl=angle`) |
| `npm run render:diagrams` | Render `ArchitectureDemo` (`motion-diagrams-2d` kit @ `60 FPS`) |
| `npm run typecheck` | Run TypeScript compiler check (`tsc --noEmit`) |

---

## 📦 Included Showcase Compositions (`src/Root.tsx`)

1. **`StarterStory` & `StarterStoryVertical`** (`src/compositions/StarterStory.tsx`)
   Clean, minimal `16:9` and `9:16` starter templates demonstrating `CameraRig` (infinite grid), `NodeBox` mathematical ports (`portRight`, `portLeft`, `portTop`, `portBottom`), `FlowCurve`, and word-synchronized triggers.
2. **`PaperDioramaDemo`** (`src/compositions/PaperDioramaDemo.tsx`)
   2.5D paper pop-up book demo showcasing `PopUpBookBase3D`, `PopUpHinge3D`, `PaperCutout3D`, and `PaperStageLighting3D` (`src/kits/paper-diorama-3d/`).
3. **`IsometricDialogueDemo`** (`src/compositions/IsometricDialogueDemo.tsx`)
   Multi-voice 3D isometric studio dialogue showcasing `Stylized3DCharacter` (`speakingWeight` vs `speechEnergy`) and `IsometricStudioEnvironment`.
4. **`ArchitectureDemo` & `ProductPromo`** (`src/scenes/ArchitectureDemoScene.tsx`)
   Dark-mode system architecture telemetry diagram with cubic Bézier data packets (`DataFlowEdge`, `SystemNode`, `CodePayloadToast`).

---

## 🌐 Community & Channels

- **Website:** [https://make.pictures](https://make.pictures)
- **YouTube (English):** [@makepicturestv](https://www.youtube.com/@makepicturestv)
- **YouTube (Polski):** [@makepicturespl](https://www.youtube.com/@makepicturespl)

---

## 📄 License

Released under the [MIT License](./LICENSE). Free for personal, educational, and commercial use.
