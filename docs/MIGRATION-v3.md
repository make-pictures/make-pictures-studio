# Migrating from `make.pictures` v2.x to v3.0.0

**`make.pictures` v3.0.0** is a clean architectural reset: **Remotion is the engine and editing studio** (`npx remotion studio`, `remotion render`, `@remotion/player`), while **`make.pictures` is the production, visual-kit, ElevenLabs audio, and QA toolkit** built cleanly on top of Remotion 4 + React 19.

---

## 1. Package Swap & Stack Upgrade

In v3.0.0, 5 overlapping packages (`core`, `kits`, `studio`, `cli`, `create-make-pictures`) are consolidated into **2 primary packages + an ultra-thin scaffolder**:

| v2.x Package | v3.0.0 Replacement | Action |
| :--- | :--- | :--- |
| `@make-pictures/core` | `@make-pictures/remotion` | Replace |
| `@make-pictures/kits` | `@make-pictures/remotion` (`./kits/*` subpaths) | Replace |
| `@make-pictures/studio` | Native `npx remotion studio` + `@make-pictures/remotion/style-lab` | Remove |
| `vite`, `@vitejs/plugin-react` | Not required by `make.pictures` | Remove (unless your own app uses Vite) |
| `@make-pictures/cli` | `@make-pictures/cli@^3.0.0` | Upgrade |
| `create-make-pictures` | `create-make-pictures@^3.0.0` | Upgrade |

### Install & clean up dependencies

```bash
# Remove deprecated v2 packages and Vite Studio dependencies
npm uninstall @make-pictures/core @make-pictures/kits @make-pictures/studio vite @vitejs/plugin-react

# Install v3.0 runtime + CLI + Remotion >= 4.0.545 + React 19
npm install @make-pictures/remotion@^3.0.0 \
  remotion@^4.0.545 \
  @remotion/cli@^4.0.545 \
  @remotion/bundler@^4.0.545 \
  @remotion/renderer@^4.0.545 \
  @remotion/google-fonts@^4.0.545 \
  @remotion/media-utils@^4.0.545 \
  @remotion/zod-types@^4.0.545 \
  react@^19.1.0 react-dom@^19.1.0 zod@^3.24.2 lucide-react

npm install -D @make-pictures/cli@^3.0.0 @types/react@^19.1.0 @types/react-dom@^19.1.0
```

> **Optional 3D stack:** `three`, `@react-three/fiber@^9`, `@react-three/drei@^10`, and `@remotion/three@^4.0.545` are optional `peerDependencies` of `@make-pictures/remotion`. Pure 2D projects no longer need to install Three.js.

Update your `package.json` scripts:

```json
{
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "new": "make-pictures new",
    "audio": "make-pictures audio",
    "qa": "make-pictures qa",
    "render": "make-pictures render",
    "elements": "make-pictures elements"
  }
}
```

Delete obsolete v2 files if present in your repository:

```bash
rm -rf vite.config.ts index.html src/compositions/registry.ts
find . -name "*.props.json" -delete
```

---

## 2. Import Path Mapping Table

| v2.x Import | v3.0.0 Import | Notes |
| :--- | :--- | :--- |
| `@make-pictures/core` | `@make-pictures/remotion` | Zero-`three` root barrel (`style`, `audio`, `director`, `optics`, `kinematics`, `DirectorCamera2D`, `utils`, `types`) |
| `@make-pictures/core/style` | `@make-pictures/remotion/style` | `StyleProvider`, `StyleBackdrop`, `BUILT_IN_STYLES`, `SPRING_PRESETS`, `useStudioFontsReady` |
| `@make-pictures/core/style/presets` | `@make-pictures/remotion/style/presets` | React-free style data & Zod schemas |
| `@make-pictures/core/audio` | `@make-pictures/remotion/audio` | `VoiceoverTrack`, `SmartMusicBed`, `SoundCue`, `VoiceoverCaptionBar` |
| `@make-pictures/core/audio/voices` | `@make-pictures/remotion/audio/voices` | React-free curated PL/EN voice catalog |
| `@make-pictures/core/camera` | `@make-pictures/remotion/camera` | `DirectorCamera2D`, `DirectorCamera3D`, `evaluateDirectorCamera3D`, Shot DSL |
| `@make-pictures/core/kinematics` | `@make-pictures/remotion/kinematics` | Zero-`three` Disney curves & 15-axis SAT 3D collision audit |
| `@make-pictures/core/director` | `@make-pictures/remotion/director` | `ContinuousSceneFlow`, `SceneSubViewDissolve`, `ClippedSurfaceChrome`, `computeSceneTimingFromVoiceover` |
| `@make-pictures/core/optics` | `@make-pictures/remotion/optics` | `OpticalStage2D`, `StageLightingRig`, `getTactileSurfaceStyle` |
| `@make-pictures/core/types` | `@make-pictures/remotion/types` | `AudioManifestFile`, `AudioSceneSpec`, `SceneVoiceoverData`, `DialogueVoiceSegment` |
| `@make-pictures/core/utils` | `@make-pictures/remotion/utils` | `createSeededRandom`, `getSpeechStateAtFrame`, timestamp helpers |
| `@make-pictures/core/theme` | **Removed** | Replace `THEME` / `STUDIO_THEME` with `useStudioStyle()` from `@make-pictures/remotion/style`; `VoiceoverCaptionBar` moved to `@make-pictures/remotion/audio` |
| `@make-pictures/kits/<kit>` | `@make-pictures/remotion/kits/<kit>` | All 10 kits: `editorial-collage`, `vector-scene-2d`, `motion-diagrams-2d`, `kinetic-typography`, `data-storytelling`, `product-frames`, `vfx`, `paper-diorama-3d`, `isometric-3d`, `tactile-3d` |
| *(new in v3.0)* | `@make-pictures/remotion/style-lab` | `<StyleLabComposition />`, `StyleLabSchema`, `DEFAULT_STYLE_LAB_PROPS` |
| *(new in v3.0)* | `@make-pictures/remotion/elements` | `REMOTION_ELEMENTS_CATALOG` (7 flagship Remotion Elements) |

> **Important:** `DirectorCamera3D` and `evaluateDirectorCamera3D` are no longer exported from the root barrel `@make-pictures/remotion` (to guarantee zero `three` coupling in 2D projects). Import them from `@make-pictures/remotion/camera`.

---

## 3. Manifest & Composition Migration (`production.json` → `audio.json` & `src/Root.tsx`)

### 3.1 Rename `production.json` to `audio.json`

v3.0 removes Studio-only metadata from manifests. Rename `production.json` → `audio.json` (in `src/videos/<slug>/audio.json` or wherever `videosDir` points in optional `make-pictures.json`):

```json
{
  "id": "my-video",
  "title": "My Video",
  "fps": 60,
  "lang": "en",
  "modelId": "eleven_v4",
  "voiceId": "TX3LPaxmHKxFdv7VOQHJ",
  "scenes": [
    {
      "id": "intro",
      "text": "[warmly] Welcome to a cleaner workflow.",
      "acousticPreset": "clean"
    }
  ],
  "score": {
    "id": "main-score",
    "mode": "prompt",
    "prompt": "Warm modern editorial pulse, subtle felt piano",
    "moodPreset": "warm-story",
    "durationSeconds": 24
  },
  "sfx": [
    {
      "id": "whoosh-open",
      "prompt": "Soft paper whoosh transition",
      "fallbackPreset": "whoosh"
    }
  ]
}
```

Re-run audio generation to emit `public/audio/<slug>/*.mp3` and `generated/audio-manifest.ts`:

```bash
npx make-pictures audio my-video
```

### 3.2 Replace `defineProduction` & `*.props.json` with native `src/Root.tsx`

Delete `defineProduction(...)`, `StudioCompositionEntry`, `propsFile`, and `src/compositions/registry.ts`. Export your component, Zod schema, and default props as plain TypeScript values, then register them directly in `src/Root.tsx`:

```tsx
import React from 'react';
import { Composition } from 'remotion';
import {
  DEFAULT_STYLE_LAB_PROPS,
  StyleLabComposition,
  StyleLabSchema,
} from '@make-pictures/remotion/style-lab';
import { MyVideo, MyVideoSchema, defaultMyVideoProps } from './videos/my-video';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="StyleLab"
      component={StyleLabComposition}
      schema={StyleLabSchema}
      defaultProps={DEFAULT_STYLE_LAB_PROPS}
      durationInFrames={360}
      fps={60}
      width={1920}
      height={1080}
    />
    <Composition
      id="MyVideo"
      component={MyVideo}
      schema={MyVideoSchema}
      defaultProps={defaultMyVideoProps}
      durationInFrames={900}
      fps={60}
      width={1920}
      height={1080}
    />
  </>
);
```

### 3.3 Optional `make-pictures.json` for custom folder layouts

If your existing repository keeps videos in `productions/` instead of `src/videos/`, add an optional `make-pictures.json` at the repo root (no lock-in required):

```json
{
  "entryPoint": "src/index.ts",
  "publicDir": "public",
  "videosDir": "productions",
  "stylesDir": "styles",
  "lang": "pl",
  "fps": 60
}
```

---

## 4. Preview & QA Workflow in Native Remotion Studio

- **Preview & Props editing:** Run `npx remotion studio src/index.ts` (or `npx make-pictures studio`). Every `<Composition schema={...} defaultProps={...} />`—including `StyleLab`—is editable live in Remotion Studio's native Props panel at 60 FPS.
- **Hard Director QA Gate:** `npx make-pictures qa <CompositionId>` now uses `@remotion/renderer`'s native `selectComposition()` and works on **any** standard Remotion project—even without an `audio.json` manifest.
- **AI Agent Skills:** Install official Remotion skills alongside the 5 lean `make.pictures` skills:

```bash
npx remotion skills add
npx skills add make-pictures/make-pictures-studio
```

---

## 5. npm Deprecation Commands (Maintainers — Run After Publishing `3.0.0`)

After publishing `@make-pictures/remotion@3.0.0`, `@make-pictures/cli@3.0.0`, and `create-make-pictures@3.0.0` to npm, run the following deprecation notices on the superseded v2 packages:

```bash
npm deprecate @make-pictures/studio "Use native 'npx remotion studio' with @make-pictures/remotion v3.0+"
npm deprecate @make-pictures/core "Merged into @make-pictures/remotion in v3.0+"
npm deprecate @make-pictures/kits "Merged into @make-pictures/remotion in v3.0+"
```
