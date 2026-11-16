---
name: kit-isometric-3d
description: >-
  3D Soft-Clay & Spatial IBL podcast studio (<StudioHdrRig3D>, <PodcastStudioSet3D>,
  <ClayCharacter3D>, computePodcastStudioLayout, computeClayBlinkProgress,
  resolvePhysicalFinishProps) plus architectural <IsometricStage3D>,
  <IsometricScenicSet3D>, and <Stylized3DCharacter> across all 10 built-in styles
  (@make-pictures/kits/isometric-3d). Use this skill whenever building 3D podcast
  dialogues, soft-clay character scenes, frosted-glass spatial sets, or isometric
  3D studio explainers wrapped in <StyleProvider>.
---

# Kit: 3D Soft-Clay, Spatial IBL & Isometric Studio (`@make-pictures/kits/isometric-3d`)

Create expressive, broadcast-grade 3D character dialogues, podcast sets, and architectural studio explainers inside `ThreeCanvas` (`@remotion/three`) — powered by **100% offline GPU `<Lightformer>` IBL** (`<StudioHdrRig3D />`), beveled **Soft-Clay / Frosted-Glass / Retro-Voxel / Matte-Ceramic** PBR materials (`resolveStyleMaterial3D(style)`), sculpted 3D characters with blinking eyes & catchlights (`<ClayCharacter3D />` on `<PodcastStudioSet3D />`), or architectural turntable rooms (`<IsometricStage3D />` + `<Stylized3DCharacter />`).

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import {
  StyleProvider,
  CINEMATIC_SPRINGS,
  DirectorCamera3D,
  getSpeechStateAtFrame,
  getSmoothPoseWindow,
  resolveStyleMaterial3D,
  useStudioStyle,
  SPRING_PRESETS,
} from '@make-pictures/core';
import {
  // Flagship v5 3D Soft-Clay & Spatial IBL Stack
  StudioHdrRig3D,
  resolveStudioHdrRigSpec,
  PodcastStudioSet3D,
  computePodcastStudioLayout,
  ClayCharacter3D,
  computeClayBlinkProgress,
  resolvePhysicalFinishProps,
  // Architectural Turntable & Maquette Stack
  IsometricStage3D,
  IsometricScenicSet3D,
  Stylized3DCharacter,
  computeScenicRoomTokens,
  resolveIsometricMaterialPreset,
  resolveIsometricMaterialTokens,
  computeIsometricLightRig,
  type StudioHdrRig3DProps,
  type StudioHdrRigSpec,
  type PodcastStudioSet3DProps,
  type PodcastStudioLayout,
  type ClayCharacter3DProps,
  type ClayCharacterAccessory,
  type ClayCharacterPose,
  type PhysicalFinishProps,
  type IsometricStage3DProps,
  type IsometricScenicSet3DProps,
  type Stylized3DCharacterProps,
  type CharacterGestureWeights,
} from '@make-pictures/kits/isometric-3d';
```

---

## 1. Flagship v5 `3D Soft-Clay & Spatial IBL` Stack (`--space=3d`)

When scaffolding `--space=3d` (default style `soft-clay`, or `glass-studio`, `retro-pc`, `cyber-telemetry`, or any custom `styles/*.style.json`), prefer the v5 `<StudioHdrRig3D />` + `<PodcastStudioSet3D />` + `<ClayCharacter3D />` stack:

- **`<StudioHdrRig3D preset="warm-softbox" | "clean-atelier" | "neon-grid" />`** (`contactShadowY?: number`, `contactShadowScale?: number`, `contactShadowOpacity?: number`, `intensity?: number`, `resolveStudioHdrRigSpec(preset, intensity)`):
  - **100% Offline GPU `<Lightformer>` IBL (HARD RULE):** Builds an analytic `<Environment resolution={256} frames={1}>` rig exclusively from GPU `<Lightformer>` softbox/ring panels, paired with a shadow-casting `directionalLight`, fill + hemisphere lights, and deterministic `<ContactShadowDisc3D />` grounding. **NEVER mount `<Environment preset="..." />` or `<Environment files="..." />`** from `@react-three/drei` (which fetches remote `.hdr` assets from GitHub CDNs and breaks offline/sandboxed renders!).
  - Defaults `preset` automatically from `resolveStyleMaterial3D(style).studioHdr` (`'warm-softbox'` for `soft-clay` / `tactile-craft` / `editorial-press` / `archival-chronicle` / `sketch-notebook`, `'clean-atelier'` for `glass-studio` / `minimal-product` / `brutalist-poster`, `'neon-grid'` for `retro-pc` / `cyber-telemetry`) and returns `null` on `frame <= 0` for Clean Frame `0`.
- **`<PodcastStudioSet3D compactVertical={isVertical} onAirActive />` & `computePodcastStudioLayout({ width, depth, wallHeight, compactVertical })`:**
  - Sculpted 3D cutaway broadcast room with beveled acoustic slat panels, oak studio desk (`tableZ = 0.18`), broadcast boom microphones, ceramic mugs, potted plants, recessed bookshelf, and a glowing sculpted 3D **`ON AIR`** sign (`onAirActive`).
  - Pass `compactVertical={isVertical}` (`height > width`) so `computePodcastStudioLayout({ compactVertical: isVertical })` narrows the room (`4.6 m` vs `6.2 m`), tightens host seating (`leftHostPosition: [-0.92, 0, 0.14]`, `rightHostPosition: [0.92, 0, 0.14]` vs `±1.30 m` in `16:9`), and keeps both hosts cleanly inside the **`9:16` Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**.
- **`<ClayCharacter3D />` (`computeClayBlinkProgress`, `resolvePhysicalFinishProps`):**
  - Expressive vinyl-toy / soft-clay 3D host (`seated?: boolean`, `accessory?: 'headphones' | 'glasses' | 'beanie' | 'none'`, `finish?: 'soft-clay' | 'frosted-glass' | 'retro-voxel' | 'matte-ceramic'`, `pose?: 'idle' | 'talking' | 'listening' | 'pointing'`, `sweaterColor?`, `pantsColor?`, `skinColor?`, `hairColor?`, `eyeColor?`, `accentColor?`, `speakingWeight?`, `speechEnergy?`, `headYawOffset?`, `enterFrame = 2`, `seed?`).
  - Features real 3D eyeballs, irises, specular catchlight spheres, sculpted brows, deterministic eyelid blinks firing smoothly once every `~3.2 s` via `computeClayBlinkProgress(frame, fps, seed)` (`0` on `frame <= 0`), scale-driven lip/mouth articulation (`speechEnergy`), calm arm gestures (`speakingWeight`), and strict **`talkBounce = 0`** (zero vertical torso hopping).

### 10 Built-in Styles → 3D Material & Studio HDR Mapping

| Built-in Style (`BuiltInStyleId`) | `ArtWorld` | `material3d.finish` | `material3d.bevelRadius` | `material3d.studioHdr` | `IsometricStage3D` Maquette Preset |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `soft-clay` *(default `--space=3d`)* | `illustrative` | `soft-clay` | `0.14` | `warm-softbox` | `ink-figurine` |
| `glass-studio` | `atelier` | `frosted-glass` | `0.10` | `clean-atelier` | `ceramic-maquette` |
| `retro-pc` | `atelier` | `retro-voxel` | `0.04` | `neon-grid` | `anodized-telemetry` |
| `cyber-telemetry` | `atelier` | `frosted-glass` | `0.08` | `neon-grid` | `anodized-telemetry` |
| `minimal-product` | `atelier` | `frosted-glass` | `0.10` | `clean-atelier` | `ceramic-maquette` |
| `sketch-notebook` | `illustrative` | `soft-clay` | `0.10` | `warm-softbox` | `ink-figurine` |
| `tactile-craft` | `illustrative` | `soft-clay` | `0.14` | `warm-softbox` | `ink-figurine` |
| `editorial-press` | `editorial-gallery` | `matte-ceramic` | `0.06` | `warm-softbox` | `ceramic-maquette` |
| `archival-chronicle` | `editorial-gallery` | `matte-ceramic` | `0.06` | `warm-softbox` | `ceramic-maquette` |
| `brutalist-poster` | `editorial-gallery` | `matte-ceramic` | `0.02` | `clean-atelier` | `ink-figurine` |

---

## 2. Architectural Turntable Stack (`<IsometricStage3D />` & `<Stylized3DCharacter />`)

For abstract architectural explainers and museum-style maquette debates:
- **`IsometricStage3D`:** Two-tier architectural turntable plinth (`radius = 5.4`, `showScenicSet = true`, `scenicVariant?: 'auto' | ArtWorld`) mounting `<IsometricScenicSet3D />` (`atelier`, `illustrative`, or `editorial-gallery` room alcove with rear console at `z = -1.35`), directional key/rim lights (`computeIsometricLightRig(style)`), and `<StagePostProcessing3D />`.
- **`Stylized3DCharacter`:** Sculptural architectural maquette speaker (`'ceramic-maquette' | 'anodized-telemetry' | 'ink-figurine'`) grounded on `<ContactShadowDisc3D />` with `gestureWeights` (`shrug`, `presentRight`, `presentLeft`, `celebrate`, `listenNod`).

---

## Mandatory 3D Character & Dialogue Rules

1. **Strict Separation: Sentence Envelope (`speakingWeight`) vs. Syllable Energy (`speechEnergy`):**
   - Compute `const speech = getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)`.
   - Use **`speech.speakingWeight`** (`0..1` continuous phrase envelope) for posture, hand cadence, `ON AIR` / index ring glow, and nameplate focus.
   - Pass **`speech.energy`** (`0..1` low-pass syllable envelope) **solely** as `speechEnergy={speech.energy}` to drive lip/mouth opening (`ClayCharacter3D`) or acoustic equalizer bars (`Stylized3DCharacter`).
2. **Zero Snap Gestures (`getSmoothPoseWindow` Only) & `talkBounce = 0`:**
   - Never use binary `frame > N ? 1 : 0` ternaries on joints or `headYawOffset` — always wrap pose windows in `getSmoothPoseWindow(frame, fps, startFrame, endFrame)`.
   - Keep all idle/conversational sway strictly inside **`frame * 0.03` to `frame * 0.055` rad/frame** (`2.0–3.5 s` cycles), and keep vertical torso bounce at **`talkBounce = 0`**.
3. **Clean Frame `0`, Offline IBL & `<= 1` WebGL Context Budget:**
   - `StudioHdrRig3D`, `PodcastStudioSet3D`, `ClayCharacter3D`, `IsometricStage3D`, and `Stylized3DCharacter` all return `null` on `frame <= 0` so `f=0` renders a pure uniform `palette.bgCanvas`.
   - When chaining multiple 3D scenes, orchestrate them via `<ContinuousSceneFlow>` with `usesThree: true` so at most **1 `<ThreeCanvas>`** is mounted per frame (`--gl=angle` is enabled automatically by `qa` and `render`).

---

## Reference Pattern (`<StudioHdrRig3D>` + `<PodcastStudioSet3D>` + `<ClayCharacter3D>`)

```tsx
const PodcastDialogueScene: React.FC<{ frame: number; fps: number; width: number; height: number }> = ({
  frame,
  fps,
  width,
  height,
}) => {
  const style = useStudioStyle();
  const mat3d = resolveStyleMaterial3D(style);
  const isVertical = height > width;
  const layout = computePodcastStudioLayout({ compactVertical: isVertical });

  const hostSpeech = getSpeechStateAtFrame('s1-host', frame - 14);
  const guestSpeech = getSpeechStateAtFrame('s2-guest', frame - 190);

  return (
    <ThreeCanvas width={width} height={height} shadows>
      <DirectorCamera3D
        safeBox9x16Compensation
        anchors={{
          host: { position: layout.leftHostPosition, height: 1.55 },
          guest: { position: layout.rightHostPosition, height: 1.55 },
        }}
        shots={[
          { fromFrame: 0, shot: 'medium-two-shot', target: 'host', secondaryTarget: 'guest', transition: 'cut' },
          { fromFrame: 180, shot: 'medium', target: 'guest', transition: 'glide' },
        ]}
      />
      <StudioHdrRig3D preset={mat3d.studioHdr} />
      <PodcastStudioSet3D
        compactVertical={isVertical}
        onAirActive={hostSpeech.speakingWeight > 0.1 || guestSpeech.speakingWeight > 0.1}
      >
        <ClayCharacter3D
          seated
          position={layout.leftHostPosition}
          rotationY={layout.leftHostRotationY}
          finish={mat3d.finish}
          accessory="headphones"
          sweaterColor={style.palette.accentPrimary}
          speakingWeight={hostSpeech.speakingWeight}
          speechEnergy={hostSpeech.energy}
          pose={hostSpeech.speakingWeight > 0.2 ? 'talking' : 'listening'}
          headYawOffset={0.14 * getSmoothPoseWindow(frame, fps, 185, 340)}
          seed="host-a"
        />
        <ClayCharacter3D
          seated
          position={layout.rightHostPosition}
          rotationY={layout.rightHostRotationY}
          finish={mat3d.finish}
          accessory="glasses"
          sweaterColor={style.palette.accentSecondary}
          speakingWeight={guestSpeech.speakingWeight}
          speechEnergy={guestSpeech.energy}
          pose={guestSpeech.speakingWeight > 0.2 ? 'talking' : 'listening'}
          headYawOffset={-0.14 * getSmoothPoseWindow(frame, fps, 14, 175)}
          seed="guest-b"
        />
      </PodcastStudioSet3D>
    </ThreeCanvas>
  );
};
```
