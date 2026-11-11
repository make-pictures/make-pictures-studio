---
name: kit-isometric-3d
description: >-
  Character animation physics, speech-envelope separation, gesture spring rules,
  and 9:16 framing for @make-pictures/kits/isometric-3d. Use this skill whenever
  building 3D studio dialogues or multi-character explainers with
  Stylized3DCharacter and IsometricStudioEnvironment.
---

# Kit: Isometric 3D Studio (`@make-pictures/kits/isometric-3d`)

Create calm, broadcast-quality 3D multi-character conversations inside `ThreeCanvas` (`@remotion/three`) synchronized to ElevenLabs dialogue turns without robotic word-level twitching.

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import {
  DirectorCamera3D,
  getSpeechStateAtFrame,
  getSmoothPoseWindow,
  SPRING_PRESETS,
} from '@make-pictures/core';
import {
  Stylized3DCharacter,
  IsometricStudioEnvironment,
  type CharacterGestureWeights,
} from '@make-pictures/kits/isometric-3d';
```

---

## Mandatory 3D Character & Dialogue Rules

### 1. Strict Separation: Sentence Envelope (`speakingWeight`) vs. Syllable Energy (`speechEnergy`)
Raw word energy drops to `0` between words inside a single sentence. Wiring syllable energy to limbs or HUD cards makes characters convulse on every word!
- Always compute speech state via `const speech = getSpeechStateAtFrame(sceneId, localFrame, voiceoverManifest?)`:
  - **`speech.speakingWeight` (`0..1` continuous turn envelope):** Smoothly ramps in `14` frames before the first word, stays steady at `1.0` across inter-word micro-pauses, and eases out `20` frames after the final word. Use **`speakingWeight`** exclusively for:
    - body posture & conversational hand cadence,
    - floor aura ring intensity,
    - speaker HUD badge / card activation scale.
  - **`speech.energy` (`0..1` 7-tap low-pass filtered syllable envelope):** Pass as `speechEnergy={speech.energy}` **solely** to animate the visor mouth equalizer bars and audio waveform meters.

### 2. Zero Snap Gestures (`getSmoothPoseWindow` Only)
- Binary `0 / 1` ternary checks (`frame > 120 ? 1 : 0`) on character joints or head yaw are **strictly forbidden**.
- Every entry in `gestureWeights` (`shrug`, `presentRight`, `presentLeft`, `celebrate`, `listenNod`) and every `headYawOffset` change **must** pass through `getSmoothPoseWindow(frame, fps, startFrame, endFrame)` powered by `SPRING_PRESETS.calmPose` (`damping: 200, stiffness: 26, mass: 1.4`), giving organic ~`0.75 s` pose transitions.

### 3. `60 FPS` Frequency Limits (Calm Human Cadence)
- Breathing cycles, gentle conversational hand sway, and floating 3D props in the studio background must stay strictly within angular frequencies **`frame * 0.03` to `frame * 0.055`** radians/frame (one full cycle every `2.0–3.5 s`).
- Multipliers `frame * 0.1+` on limbs/props and vertical torso bouncing (`talkBounce = 0`) are **forbidden**.
- Drive camera transitions with `DirectorCamera3D` (`transition: 'glide'` uses `SPRING_PRESETS.calmCamera`: `damping: 200, stiffness: 22, mass: 1.6`, or instant editorial `'cut'` between single close-ups and two-shots).

### 4. `9:16` Vertical Framing & Zone Separation
- Enable `safeBox9x16Compensation` (default `true`) on `<DirectorCamera3D />` so vertical `1080×1920` renders automatically widen FOV and shift framing into the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)** clear of the bottom `480 px` Shorts/Reels UI.
- Never place a large gesturing foreground character directly in front of a busy multi-element 3D diagram—split upper/lower or left/right depth zones cleanly.

### 5. Hardware GPU Acceleration (`--gl=angle`)
- Always render `ThreeCanvas` compositions with `--gl=angle` (handled automatically by `npm run qa` and `npm run render` when `usesThree: true` is set on the composition entry).

---

## Reference Pattern

```tsx
const hostSpeech = getSpeechStateAtFrame('s1-host', frame - s1Start);
const guestSpeech = getSpeechStateAtFrame('s2-guest', frame - s2Start);

const hostGestures: CharacterGestureWeights = {
  presentRight: getSmoothPoseWindow(frame, fps, s1Start + 30, s1Start + 190),
  listenNod: getSmoothPoseWindow(frame, fps, s2Start + 20, s2Start + 180),
};

<ThreeCanvas width={width} height={height}>
  <DirectorCamera3D
    anchors={{
      host: { position: [-1.45, 0, 0], height: 1.55 },
      guest: { position: [1.45, 0, 0], height: 1.55 },
    }}
    shots={[
      { fromFrame: 0, shot: 'medium-two-shot', target: 'host', secondaryTarget: 'guest', transition: 'cut' },
      { fromFrame: s1Start + 45, shot: 'over-the-shoulder', target: 'host', secondaryTarget: 'guest', transition: 'glide' },
      { fromFrame: s2Start, shot: 'close-up', target: 'guest', transition: 'cut' },
    ]}
  />
  <IsometricStudioEnvironment />
  <Stylized3DCharacter
    position={[-1.45, 0, 0]}
    rotationY={0.38}
    primaryColor="#2563EB"
    accentColor="#38BDF8"
    speakingWeight={hostSpeech.speakingWeight}
    speechEnergy={hostSpeech.energy}
    gestureWeights={hostGestures}
    headYawOffset={0.18 * getSmoothPoseWindow(frame, fps, s2Start, s2End)}
  />
</ThreeCanvas>
```
