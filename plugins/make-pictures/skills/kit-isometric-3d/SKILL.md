---
name: kit-isometric-3d
description: >-
  Character animation physics, speech-envelope separation, gesture spring rules,
  and 9:16 framing for @make-pictures/kits/isometric-3d. Use this skill whenever
  building 3D studio dialogues, podcasts, or multi-character explainers with
  IsometricStage3D and Stylized3DCharacter wrapped in <StyleProvider>.
---

# Kit: Isometric 3D Studio (`@make-pictures/kits/isometric-3d`)

Create calm, broadcast-quality 3D multi-character conversations inside `ThreeCanvas` (`@remotion/three`) on the neutral, style-aware `<IsometricStage3D />` stage — synchronized to ElevenLabs dialogue turns without robotic word-level twitching.

---

## Core Primitives & Imports

```tsx
import { ThreeCanvas } from '@remotion/three';
import {
  StyleProvider,
  DirectorCamera3D,
  getSpeechStateAtFrame,
  getSmoothPoseWindow,
  useStudioStyle,
  SPRING_PRESETS,
} from '@make-pictures/core';
import {
  IsometricStage3D,
  Stylized3DCharacter,
  type IsometricStage3DProps,
  type CharacterGestureWeights,
} from '@make-pictures/kits/isometric-3d';
```

- **`IsometricStage3D`:** Neutral circular 3D studio platform (`radius?: number` default `5.4`, `showGrid?: boolean` default `true`, `accentColor?: string`, `surfaceColor?: string`, `children?: React.ReactNode`). Automatically adapts lighting intensity (`isDark`), platform surface (`bgSurface`), grid lines (`inkBorder`), and rim accent (`accentPrimary`) from `useStudioStyle()`, with an optional `children` slot for topic-specific central 3D props.
- **`Stylized3DCharacter`:** Expressive 3D speaker figure driven by continuous sentence `speakingWeight`, low-pass syllable `speechEnergy`, and smooth `CharacterGestureWeights`.

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

### 3. `60 FPS` Frequency Limits (`0.03..0.055 rad/frame`)
- Breathing cycles, gentle conversational hand sway, head yaw turns, and any custom 3D props placed inside `<IsometricStage3D>` must stay strictly within angular frequencies **`frame * 0.03` to `frame * 0.055`** radians/frame (one full cycle every `2.0–3.5 s`).
- Multipliers `frame * 0.1+` on limbs/props and vertical torso bouncing (`talkBounce = 0`) are **forbidden**.
- Drive camera transitions with `DirectorCamera3D` (`transition: 'glide'` uses `SPRING_PRESETS.calmCamera`: `damping: 200, stiffness: 22, mass: 1.6`, or instant editorial `'cut'` between single close-ups and two-shots).

### 4. `9:16` Vertical Framing & Zone Separation
- Enable `safeBox9x16Compensation` (default `true`) on `<DirectorCamera3D />` so vertical `1080×1920` renders automatically widen FOV and shift framing into the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)** clear of the bottom `480 px` Shorts/Reels UI.
- Never place a large gesturing foreground character directly in front of a busy multi-element 3D prop — split upper/lower or left/right depth zones cleanly.

### 5. Clean Frame `0` & Hardware GPU Acceleration (`--gl=angle`)
- Keep `frame === 0` clean (`StyleBackdrop` renders pure `palette.bgCanvas` at `frame <= 0`, and stage/card entrances start at `frame - 2`).
- Always render `ThreeCanvas` compositions with `--gl=angle` (handled automatically by `npx make-pictures qa` and `npx make-pictures render` when `usesThree: true` is set on the composition entry).

---

## Reference Pattern (`<StyleProvider>` + `<IsometricStage3D>`)

```tsx
const DialogueStage: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const style = useStudioStyle();
  const s1Start = 12;
  const s2Start = 240;
  const s2End = 450;

  const hostSpeech = getSpeechStateAtFrame('s1-host', frame - s1Start);
  const guestSpeech = getSpeechStateAtFrame('s2-guest', frame - s2Start);

  const hostGestures: CharacterGestureWeights = {
    presentRight: getSmoothPoseWindow(frame, fps, s1Start + 24, s1Start + 190),
    listenNod: getSmoothPoseWindow(frame, fps, s2Start + 20, s2End - 30),
  };

  const guestGestures: CharacterGestureWeights = {
    presentLeft: getSmoothPoseWindow(frame, fps, s2Start + 24, s2End - 24),
  };

  return (
    <IsometricStage3D radius={5.4} showGrid>
      <Stylized3DCharacter
        position={[-1.45, 0, 0]}
        rotationY={0.38}
        primaryColor={style.palette.accentPrimary}
        accentColor={style.palette.accentSecondary}
        speakingWeight={hostSpeech.speakingWeight}
        speechEnergy={hostSpeech.energy}
        gestureWeights={hostGestures}
        headYawOffset={0.18 * getSmoothPoseWindow(frame, fps, s2Start, s2End)}
      />
      <Stylized3DCharacter
        position={[1.45, 0, 0]}
        rotationY={-0.38}
        primaryColor={style.palette.accentSecondary}
        accentColor={style.palette.accentPrimary}
        speakingWeight={guestSpeech.speakingWeight}
        speechEnergy={guestSpeech.energy}
        gestureWeights={guestGestures}
        headYawOffset={-0.18 * getSmoothPoseWindow(frame, fps, s1Start, s2Start - 12)}
      />
    </IsometricStage3D>
  );
};

// Inside your composition:
<StyleProvider style={props.styleId} renderBackdrop>
  <ThreeCanvas width={width} height={height}>
    <DirectorCamera3D
      anchors={{
        host: { position: [-1.45, 0, 0], height: 1.55 },
        guest: { position: [1.45, 0, 0], height: 1.55 },
      }}
      shots={[
        { fromFrame: 0, shot: 'medium-two-shot', target: 'host', secondaryTarget: 'guest', transition: 'cut' },
        { fromFrame: 60, shot: 'over-the-shoulder', target: 'host', secondaryTarget: 'guest', transition: 'glide' },
        { fromFrame: 240, shot: 'close-up', target: 'guest', transition: 'cut' },
      ]}
    />
    <DialogueStage frame={frame} fps={fps} />
  </ThreeCanvas>
</StyleProvider>
```
