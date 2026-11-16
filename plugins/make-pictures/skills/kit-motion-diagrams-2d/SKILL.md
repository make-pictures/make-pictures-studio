---
name: kit-motion-diagrams-2d
description: >-
  Mathematical coordinate ports, infinite-canvas 2D camera & dignified light/dark
  optical rack focus rules, ClippedSurfaceChrome corner hygiene, 3-ArtWorld
  ScenicBackdropLayers, luminous DataFlowEdge flow trails & >= 26px label
  clearance, packet speed cadence, and 9:16 cascade layout rules for
  @make-pictures/kits/motion-diagrams-2d. Use this skill whenever creating
  system architecture diagrams, SaaS product flows, or continuous 2D canvas
  explainers.
---

# Kit: Motion Diagrams 2D (`@make-pictures/kits/motion-diagrams-2d`)

Build gallery-grade `60 FPS` infinite-canvas architectural diagrams, continuous style-morphing topology flows, and product explainers with 3-ArtWorld `<ScenicBackdropLayers />`, `<ClippedSurfaceChrome />` rounded-corner precision, dignified light-mode rack focus, luminous Bézier flow trails, and zero GPU background clipping.

---

## Core Primitives & Imports

```tsx
import {
  ClippedSurfaceChrome,
  ContinuousSceneFlow,
  DirectorCamera2D,
  CINEMATIC_SPRINGS,
  interpolateStylePresets,
} from '@make-pictures/core';
import {
  MotionDiagramStage2D,
  useMotionDiagramFocus,
  CameraRig,
  WorldBox,
  portTop,
  portBottom,
  portLeft,
  portRight,
  FlowCurve,
  DataFlowEdge,
  SystemNode,
  CodePayloadToast,
  resolvePayloadTokenColors,
  type MotionDiagramStage2DProps,
  type MotionDiagramFocusState,
  type NodeBox,
} from '@make-pictures/kits/motion-diagrams-2d';
```

---

## Mandatory Layout, Corner Clipping, Optical Focus, Port & Camera Rules

### 1. Single Source of Truth for Node Coordinates (`NodeBox`)
- **Zero manual coordinate guessing:** Never write separate approximate `(x, y)` numbers for HTML cards and SVG connection curves.
- Define every block on the 2D canvas inside one dictionary (`WORLD_NODES` for `16:9` and a dedicated `VERTICAL_WORLD_NODES` for `9:16`) as `NodeBox` (`{ cx, cy, w, h }`).
- Mount HTML cards with `<WorldBox node={NODES.apiGateway} nodeId="apiGateway">` or `<SystemNode id="apiGateway" x={NODES.apiGateway.cx} y={NODES.apiGateway.cy} width={NODES.apiGateway.w} height={NODES.apiGateway.h} ... />` and attach all edges (`FlowCurve` / `DataFlowEdge`) **exclusively** via mathematical border port helpers:
  - `portTop(node, dx = 0)` — top border (`y = cy - h / 2`)
  - `portBottom(node, dx = 0)` — bottom border (`y = cy + h / 2`)
  - `portLeft(node, dy = 0)` — left border (`x = cx - w / 2`)
  - `portRight(node, dy = 0)` — right border (`x = cx + w / 2`)

### 2. Rounded-Corner Clipping Hygiene (`<ClippedSurfaceChrome />`) & Zero Developer Clutter
- **`ClippedSurfaceChrome` Inside `overflow: 'visible'` Cards:** `SystemNode`, `WorldBox`, `CodePayloadToast`, and `DataFlowEdge` labels wrap their internal top accent bars, specular top-edge highlights (`specularRim={!isDark}`), and surface tint gradients inside `<ClippedSurfaceChrome />` (`borderRadius: 'inherit', overflow: 'hidden'`) while keeping only external port terminals (`data-port-terminal="left" | "right"`) outside the mask. If you build a custom world card with `overflow: 'visible'`, **always** wrap internal accent strips in `<ClippedSurfaceChrome>` (enforced by the `UNCLIPPED_CARD_BAR` rule in `npx make-pictures qa`).
- **Zero Default Developer Clutter:** `diagramCode` on `MotionDiagramStage2D` and `moduleCode` / `badge` on `SystemNode` default to `undefined` — no `MOD 01` or `SCHEMAT 01` stamps are rendered unless explicitly passed as non-empty strings. When `icon` is omitted on `SystemNode`, it renders a bespoke sculpted SVG medallion (`data-node-medallion="atelier" | "illustrative" | "editorial-gallery"`) adapted to `resolveArtWorld(style)`.

### 3. 3 Artistic Worlds & Dignified Optical Rack Focus (`<MotionDiagramStage2D />`)
- Prefer `<MotionDiagramStage2D />` (which layers `<StageLightingRig />` + `<ScenicBackdropLayers />` + `<DirectorCamera2D />` + `MotionDiagramFocusContext`):
  - **Automatic 3-ArtWorld Scenery (`showScenicBackdrop = true`):** Renders studio cyclorama & glass caustics (`'atelier'`), warm parallax hills & clouds (`'illustrative'`), or gallery passe-partout & window light (`'editorial-gallery'`) behind the infinite grid while returning `null` on `frame <= 0`.
  - **Dignified Light-Mode Rack Focus:** When `shots: ShotSpec2D[]` or `focusedNodeIds` recesses non-targeted `SystemNode` / `WorldBox` modules on light surfaces (`!surface.isDark`), `MotionDiagramStage2D` keeps `opacityScale >= 0.88`, caps `blurPx <= 1.85px` (`blur(...) saturate(0.88)`), and preserves crisp `inkBorder` definition so background nodes read as physical acrylic/paper objects sitting deeper in studio light — never washed-out `0.55` gray HTML inputs. Emits `filter: 'none'` whenever CoC blur `< 0.25px`.

### 4. `DataFlowEdge` Luminous Trails & `>= 26px` Label Clearance
- **`>= 26px` Label Clearance:** When `label` is set on `<DataFlowEdge />`, default offsets automatically place the floating label **`>= 30px`** clear of the cubic Bézier apex (`-32px` above upward arches, `+32px` below downward arches, and `±30px` horizontally clear on vertical `9:16` spans).
- **Luminous Flow Trails:** Traveling couplers emit a smooth, tapered cubic-Bézier gradient comet (`data-flow-trail="true"`) behind each polymorphic coupler (`swiss-spatial`, `optical-gate`, `risograph-poster`).
- **Header & Card Border Avoidance (`curveX` / `curveOffsetX`):** Never slice section headers with lines; bypass headers with a smooth lateral Bézier arch (`curveX` on `FlowCurve` or `curveOffsetX` on vertical `DataFlowEdge`).

### 5. Calm `60 FPS` Pacing (`>= 4.5s` Scenes & `92–120f` Packet Cadence)
- Set `packetSpeedFrames` / `traverseFrames` between **`92` and `120` frames (`1.5–2.0 s`)** with `packetCount={2}` — never `< 60`.
- Every visual scene in `productions/*` must span **`>= 270` frames (`4.5 s` @ `60 FPS`)** and connect via `<ContinuousSceneFlow />` or continuous `interpolateStylePresets` morphing (`npx make-pictures qa` hard gate).

### 6. Dedicated `9:16` Vertical Layout (`1080×1920`)
- Create a dedicated `VERTICAL_WORLD_NODES` layout stacking cards top-to-bottom (`w <= 640 px`) strictly inside the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**, connecting vertical ports (`portBottom` -> `portTop`).

---

## Reference Pattern (`<MotionDiagramStage2D>` + Liquid Style Morphing)

```tsx
const WORLD_NODES = {
  prompt: { cx: 460, cy: 480, w: 380, h: 192 },
  direction: { cx: 960, cy: 440, w: 390, h: 192 },
  master: { cx: 1460, cy: 480, w: 380, h: 192 },
} satisfies Record<string, NodeBox>;

<StyleProvider style={morphedStyle} renderBackdrop>
  <MotionDiagramStage2D
    renderBaseFill={false}
    nodes={WORLD_NODES}
    shots={[
      { fromFrame: 0, target: ['prompt', 'direction', 'master'], transition: 'cut', padding: 120 },
      { fromFrame: 270, target: ['direction', 'master'], transition: 'glide', padding: 140 },
    ]}
  >
    <DataFlowEdge
      id="prompt-to-direction"
      from={portRight(WORLD_NODES.prompt)}
      to={portLeft(WORLD_NODES.direction)}
      curveOffsetY={-76}
      drawStartFrame={6}
      flowStartFrame={24}
      flowEndFrame={660}
      traverseFrames={96}
      label="Kierunek plastyczny"
    />
    <DataFlowEdge
      id="direction-to-master"
      from={portRight(WORLD_NODES.direction)}
      to={portLeft(WORLD_NODES.master)}
      curveOffsetY={-76}
      drawStartFrame={18}
      flowStartFrame={42}
      flowEndFrame={660}
      traverseFrames={96}
      label="Master 60 FPS"
    />
    <SystemNode
      id="prompt"
      title="Opis historii"
      subtitle="Zwięzła intencja i nastrój opowieści"
      statusText="Wejście gotowe"
      x={WORLD_NODES.prompt.cx}
      y={WORLD_NODES.prompt.cy}
      width={WORLD_NODES.prompt.w}
      height={WORLD_NODES.prompt.h}
      enterFrame={4}
      activeRanges={[[12, 260]]}
    />
    <SystemNode
      id="direction"
      badge="STYL"
      title="Świat artystyczny"
      subtitle="Światło, faktura i płynna ciągłość"
      statusText="Kalibracja optyki"
      activeStatusText="Metamorfoza 60 FPS"
      x={WORLD_NODES.direction.cx}
      y={WORLD_NODES.direction.cy}
      width={WORLD_NODES.direction.w}
      height={WORLD_NODES.direction.h}
      enterFrame={14}
      activeRanges={[[180, 620]]}
    />
    <SystemNode
      id="master"
      title="Gotowy film"
      subtitle="Czysty dźwięk -14 LUFS i ostrość"
      statusText="Eksport MP4"
      x={WORLD_NODES.master.cx}
      y={WORLD_NODES.master.cy}
      width={WORLD_NODES.master.w}
      height={WORLD_NODES.master.h}
      enterFrame={24}
      activeRanges={[[320, 660]]}
    />
  </MotionDiagramStage2D>
</StyleProvider>
```

---

## SaaS Walkthroughs: `MotionDiagramStage2D` + Product Frames (`@make-pictures/kits/product-frames`)

Put `.mp4` screencasts or interactive UI compositions inside `BrowserFrame` (`16:9`) / `PhoneFrame` (`9:16`) on the infinite canvas and direct the camera onto UI details with `<ScreenSpotlightOverlay />`:

```tsx
import { staticFile } from 'remotion';
import { MotionDiagramStage2D } from '@make-pictures/kits/motion-diagrams-2d';
import { BrowserFrame, PhoneFrame, ScreenSpotlightOverlay } from '@make-pictures/kits/product-frames';

const NODES = {
  desktop: { cx: 960, cy: 540, w: 1360, h: 902 },
  styleLab: { cx: 1320, cy: 320, w: 420, h: 220 },
};

<MotionDiagramStage2D
  renderBaseFill={false}
  nodes={NODES}
  shots={[
    { fromFrame: 0, target: 'desktop' },
    { fromFrame: 150, target: 'styleLab', transition: 'glide', padding: 120 },
  ]}
>
  <div style={{ position: 'absolute', left: NODES.desktop.cx - 680, top: NODES.desktop.cy - 451 }}>
    <BrowserFrame url="make.pictures/studio?view=styles" videoSrc={staticFile('_productions/my-film/videos/desktop.mp4')}>
      <ScreenSpotlightOverlay x={66} y={14} width={26} height={16} startFrame={150} endFrame={320} label="Trzy światy sztuki" />
    </BrowserFrame>
  </div>
</MotionDiagramStage2D>
```
