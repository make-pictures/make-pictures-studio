<p align="center">
  <a href="https://make.pictures"><img src="./public/brand/make-pictures-logo.svg" alt="make.pictures — Production & Audio/QA Toolkit for Remotion + AI Agents" width="480" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/remotion"><img src="https://img.shields.io/badge/npm-v3.0.0-2563EB?style=for-the-badge&labelColor=0F172A" alt="npm v3.0.0" /></a>
  <img src="https://img.shields.io/badge/Remotion-4.0.545%2B_•_React_19-0096C7?style=for-the-badge&labelColor=0F172A" alt="Remotion 4 + React 19" />
  <img src="https://img.shields.io/badge/Audio-ElevenLabs_v4_•_-14_LUFS-7209B7?style=for-the-badge&labelColor=0F172A" alt="ElevenLabs v4 and -14 LUFS" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-FF2A85?style=for-the-badge&labelColor=0F172A" alt="MIT License" /></a>
</p>

<h3 align="center">Production &amp; Audio/QA Toolkit for Remotion + AI Agents.</h3>

<p align="center">
  <a href="https://make.pictures">🌐 make.pictures</a> •
  <a href="https://www.youtube.com/@makepicturestv">📺 YouTube (EN)</a> •
  <a href="https://www.youtube.com/@makepicturespl">📺 YouTube (PL)</a> •
  <a href="./docs/MIGRATION-v3.md">🔄 v3 Migration Guide</a> •
  <a href="./CHANGELOG.md">📋 Changelog</a> •
  <a href="./README.pl.md">🇵🇱 Polska wersja</a>
</p>

---

> **Remotion is the engine and editing studio** (`npx remotion studio`, `remotion render`, `@remotion/player`).
> **`make.pictures` is the production layer and director harness for AI agents:** 2D / 2.5D / 3D visual kits, 10 art-direction styles, ElevenLabs `eleven_v4` audio + `-14 LUFS` mastering, Remotion Elements, and a hard visual QA gate — with **zero lock-in**.

## ⚡ Start with one prompt

`1. Paste into Antigravity, Claude Code, Cursor, or Codex` → `2. Describe your idea & pick a style in StyleLab` → `3. Preview & export in native Remotion Studio`

```text
Set up make.pictures for me: run `npx -y @make-pictures/cli@latest onboard --lang=en` and follow every step until Remotion Studio is running.
```

Works seamlessly in **three modes**:
1. **Empty directory** → scaffolds a clean Remotion 4 + React 19 project (`create-make-pictures`) with `StyleLab` in `src/Root.tsx`.
2. **Existing Remotion project** (`npx create-video@latest`) → runs `npx make-pictures init` in-place without touching your existing `src/Root.tsx`.
3. **Existing web / SaaS app** (Next.js, Vite, etc.) → initializes an isolated `--dir=videos` Remotion workspace.

---

## 🎨 Native Remotion Studio + `StyleLab` & Visual Kits (`v3.0.0`)

<p align="center">
  <a href="https://make.pictures"><img src="./docs/showcase/showreel-preview.gif" alt="make.pictures 49s Showreel — One Page, Five Worlds: Tactile 3D, 2D Product Flow, 2.5D Paper Cutouts, Soft-Clay 3D Dialogue &amp; Editorial Panorama" width="760" /></a>
  <br />
  <sub>▶ <strong>49s Showreel — One Page, Five Worlds</strong> — <strong>Tactile 3D • 2D Product Flow • 2.5D Paper Cutouts • Soft-Clay 3D Dialogue • Editorial Panorama</strong> (watch with voice &amp; music at <a href="https://make.pictures">make.pictures</a>).</sub>
</p>

<p align="center">
  <img src="./docs/showcase/style-lab-grid.png" alt="make.pictures Style Lab — preview 10 built-in styles across 2D, 2.5D and 3D spaces directly inside Remotion Studio" width="920" />
  <br />
  <sub><strong>🎨 Native <code>StyleLab</code> Composition</strong> (<code>@make-pictures/remotion/style-lab</code>) — switch <strong>2D / 2.5D / 3D</strong> spaces and <strong>10 built-in art direction presets</strong> directly inside Remotion Studio's Props panel at 60 FPS.</sub>
</p>

---

## 🎬 What you can build in minutes

| Product Launch &amp; Live Sync (`product-frames`) | 2D Systems Choreography (`motion-diagrams-2d`) |
| :---: | :---: |
| <img src="./docs/showcase/kit-product-promo.png" alt="Product launch frame with side-by-side live dispatch map and synced mobile tracker" width="440" /> | <img src="./docs/showcase/kit-architecture-2d.png" alt="2D systems choreography with staggered nodes and luminous Bézier flow" width="440" /> |
| **Editorial Panorama &amp; Pinned Media (`editorial-collage`)** | **Data Storytelling &amp; Bar Races (`data-storytelling`)** |
| <img src="./docs/showcase/kit-editorial-data-2d.png" alt="Editorial collage panorama and museum-matted pinned media story" width="440" /> | <img src="./docs/showcase/kit-data-storytelling-2d.png" alt="Animated bar race and data storytelling visualization" width="440" /> |
| **2.5D Paper Cutouts &amp; Dioramas (`paper-diorama-3d`)** | **Soft-Clay 3D &amp; Text-to-Dialogue (`isometric-3d`)** |
| <img src="./docs/showcase/kit-paper-diorama-3d.png" alt="2.5D paper cutout cosmic diorama with pop-up moon and rocket" width="440" /> | <img src="./docs/showcase/kit-isometric-dialogue-3d.png" alt="Soft-Clay 3D studio scene with expressive multi-speaker Text-to-Dialogue" width="440" /> |

<sub>10 tree-shakeable visual kits in `@make-pictures/remotion/kits/*` across **`2D` / `2.5D` / `3D`** (`editorial-collage`, `vector-scene-2d`, `motion-diagrams-2d`, `kinetic-typography`, `data-storytelling`, `product-frames`, `vfx`, `paper-diorama-3d`, `isometric-3d`, `tactile-3d`) — with optional 3D peer dependencies so 2D projects never install Three.js.</sub>

---

## 🔄 How AI direction works in practice

| 1. First prompt (rough 3D) | 2. Style experiment (flat 2D) | 3. Final 2.5D pop-up shot |
| :---: | :---: | :---: |
| <img src="./docs/showcase/stage1-v1-calcutta.jpg" alt="Stage 1: rough 3D draft" width="290" /> | <img src="./docs/showcase/stage2-v2-calcutta.jpg" alt="Stage 2: flat 2D attempt" width="290" /> | <img src="./docs/showcase/stage3-v8-calcutta.jpg" alt="Stage 3: final 2.5D paper cutout shot" width="290" /> |

<p align="center">
  <a href="https://www.youtube.com/watch?v=IL4jrUKzkOA"><img src="./docs/showcase/thumbnail-en-1280x720.png" alt="Watch full example film on YouTube" width="640" /></a>
  <br />
  <sub>▶ <a href="https://www.youtube.com/watch?v=IL4jrUKzkOA"><strong>Watch the full 2:42 film on YouTube</strong></a> — voice, music, sound effects and every camera move created with <code>make.pictures</code> + Remotion.</sub>
</p>

---

## 🛠️ For developers — 5 ways to use

```bash
# 1. Start a fresh Remotion 4 + React 19 project
npx create-make-pictures@latest my-films --lang=en && cd my-films && npx remotion studio

# 2. Add to ANY existing Remotion project (zero lock-in, preserves your src/Root.tsx)
npm i @make-pictures/remotion && npm i -D @make-pictures/cli
npx make-pictures init

# 3. Embed inside an existing Next.js / Vite / SaaS repo
npx make-pictures init --dir=videos

# 4. Install tandem AI Agent Skills (official Remotion API + 5 lean make.pictures production skills)
npx remotion skills add
npx skills add make-pictures/make-pictures-studio

# 5. Export or install standalone Remotion Elements (@remotion/studio-protocol)
npx make-pictures elements build --out=dist/elements
```

<details>
<summary><strong>📦 Packages &amp; CLI quick reference (<code>v3.0.0</code>)</strong></summary>

<br />

| Package | Purpose |
| :--- | :--- |
| `@make-pictures/remotion` | Unified `60 FPS` runtime: 10 visual kits, 10 `StylePreset` worlds, `ContinuousSceneFlow`, Shot DSL cameras, Disney kinematics + 15-axis 3D SAT collision audit, `SmartMusicBed`, `SoundCue`, `<StyleLabComposition />`, and 7 Remotion Elements (`sideEffects: false`, zero-`three` root) |
| `@make-pictures/cli` | Universal Remotion CLI: `onboard`, `init`, `new`, `audio` (`eleven_v4` TTS / Text-to-Dialogue / Music / SFX), `voices`, `image`, `cutout`, `assets`, native `selectComposition` `qa`, `-14 LUFS` `render`, `elements build`, plus 5 bundled `SKILL.md` modules |
| `create-make-pictures` | Ultra-thin scaffolder for fresh Remotion 4 + React 19 projects with native `StyleLab` |

| Command | Action |
| :--- | :--- |
| `npx make-pictures onboard` | 3-mode onboarding + tandem skills + optional ElevenLabs `.env.local` auth |
| `npx make-pictures init` | Add toolkit to an existing Remotion repo (or `--dir=videos` in a SaaS app) |
| `npx make-pictures studio` | Launch native **`npx remotion studio`** |
| `npx make-pictures new <slug>` | Scaffold `src/videos/<slug>/` (`audio.json` + component) and register `<Composition>` in `src/Root.tsx` |
| `npx make-pictures styles` | List 10 built-in &amp; custom `styles/*.style.json` presets (`style new <slug>` to fork) |
| `npx make-pictures audio [slug]` | Generate word-aligned `eleven_v4` voiceovers, multi-speaker Text-to-Dialogue, music &amp; SFX (`--mock` offline) |
| `npx make-pictures qa <Id>` | Native `selectComposition` Director QA gate &amp; Contact-Sheet PNG (`out/qa-<Id>.png`) with `9:16` safe zones |
| `npx make-pictures render <Id>` | Export `60 FPS` MP4 (auto `--gl=angle` for 3D) mastered to `-14 LUFS` |
| `npx make-pictures elements build` | Build `@remotion/studio-protocol` JSON/HTML payloads for all 7 flagship Remotion Elements |

</details>

---

<p align="center">
  MIT License • <a href="https://make.pictures">make.pictures</a> • <a href="./docs/MIGRATION-v3.md">Migration Guide (v2 → v3)</a> • <a href="https://buycoffee.to/makepictures">☕ Buy me a coffee</a>
</p>
