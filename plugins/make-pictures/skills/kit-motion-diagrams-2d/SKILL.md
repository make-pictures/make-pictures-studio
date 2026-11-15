---
name: kit-motion-diagrams-2d
description: >-
  Mathematical coordinate ports, infinite-canvas 2D camera & optical rack focus
  rules, polymorphic schematic couplers, packet speed cadence, and 9:16 cascade
  layout rules for @make-pictures/kits/motion-diagrams-2d. Use this skill
  whenever creating system architecture diagrams, SaaS product flows, or
  one-shot 2D canvas explainers.
---

# Kit: Motion Diagrams 2D (`@make-pictures/kits/motion-diagrams-2d`)

Build crisp `60 FPS` infinite-canvas architectural schematics, system topology flows, and product explainers with directional optical lighting, shot-driven Circle-of-Confusion rack focus, zero coordinate guessing, and zero GPU background clipping.

---

## Core Primitives & Imports

```tsx
import { DirectorCamera2D, SPRING_PRESETS } from '@make-pictures/core';
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

## Mandatory Layout, Optical Focus, Port & Camera Rules

### 1. Single Source of Truth for Node Coordinates (`NodeBox`)
- **Zero manual coordinate guessing:** Never write separate approximate `(x, y)` numbers for HTML cards and SVG connection curves.
- Define every block on the 2D canvas inside one dictionary (`WORLD_NODES` for `16:9` and a dedicated `VERTICAL_WORLD_NODES` for `9:16`) as `NodeBox` (`{ cx, cy, w, h }`).
- Mount HTML cards with `<WorldBox node={NODES.apiGateway} nodeId="apiGateway">` or `<SystemNode id="apiGateway" x={NODES.apiGateway.cx} y={NODES.apiGateway.cy} width={NODES.apiGateway.w} height={NODES.apiGateway.h} ... />` and attach all edges (`FlowCurve` / `DataFlowEdge`) **exclusively** via mathematical border port helpers:
  - `portTop(node, dx = 0)` — top border (`y = cy - h / 2`)
  - `portBottom(node, dx = 0)` — bottom border (`y = cy + h / 2`)
  - `portLeft(node, dy = 0)` — left border (`x = cx - w / 2`)
  - `portRight(node, dy = 0)` — right border (`x = cx + w / 2`)

### 2. Optical Rack Focus & Polymorphic Schematic Grammar (`<MotionDiagramStage2D />`)
- Prefer `<MotionDiagramStage2D />` (which wraps `<DirectorCamera2D />` + `<StageLightingRig />` + `MotionDiagramFocusContext`):
  - **Automatic Shot-Driven Rack Focus:** When `shots: ShotSpec2D[]` glides from a wide establishing shot (`target: ['ingest', 'engine']`) onto a focused cluster (`target: ['engine', 'payload']`), `MotionDiagramStage2D` spring-interpolates focus weights so non-targeted `SystemNode` and `WorldBox` modules smoothly recess into optical background CoC blur (`computeCircleOfConfusionPx`, emitting `filter: 'none'` whenever `< 0.25px` so active typography stays razor-sharp). Pass `focusedNodeIds` or per-node `focusState="sharp" | "recessed"` (or read `useMotionDiagramFocus()` in custom world cards) when overriding manually.
  - **Viewport Sheet Index (`diagramCode`):** Optional monospace sheet index stamp pinned safely inside the `9:16` Golden Safe Box (`left: 76, top: 236` in vertical; `left: 64, top: 44` in `16:9`).
  - **Polymorphic Couplers & Terminals (`resolveStyleOptics(style).typographyGrammar`):**
    - `'swiss-spatial'` — crisp single-axis schematic trace, square/circle pin terminals, tangent-aligned drafted chevron courier.
    - `'optical-gate'` — precision telemetry bus with circular terminals and high-contrast luminous frame bar courier.
    - `'risograph-poster'` — bold ink bus with heavy rectangular terminals and graphic triangle courier.
  - **Zero SaaS AI-Slop:** Never add `borderRadius: 9999` pills, glowing neon dots, hardcoded `#00F0FF` / `#6366F1` radial blobs, fixed `1920×1080` edge `viewBox` limits (`DataFlowEdge` uses world-coordinate `1×1` `overflow: 'visible'` SVG), or hardcoded GitHub-dark syntax hexes (`CodePayloadToast` derives token colors from `resolvePayloadTokenColors(style)`). `SystemNode` makes `icon?: LucideIcon` optional (rendering a deterministic geometric module SVG glyph when omitted) and accepts optional `moduleCode?: string`.

### 3. Header & Card Border Avoidance (`curveX` Detour)
- **Never slice section headers with lines:** Never route a vertical connection straight through the middle of a section title or flush along the vertical side edge of a card.
- When connecting a card in an upper section to a card in a lower section across a section header, exit from `portBottom(sourceNode)` and bypass the header with a wide, smooth lateral Bézier arch using `curveX` (e.g., `curveX={-240}` or `curveX={240}` on `<FlowCurve orientation="vertical" ... />`).

### 4. Infinite Viewport-Pinned Grid & Clean Frame `0`
- **Never place a finite background `div` inside a 3D perspective container:** Putting a large grid element inside `perspective` + `rotateX` causes Chromium's GPU tile buffer to clip edges when zooming out (`zoom ~ 0.5x`), leaving empty strips around the screen.
- Always use `<MotionDiagramStage2D />`, `<DirectorCamera2D />`, or `<CameraRig />`, which pin the calibrated technical grid and `<StageLightingRig />` directly to the viewport `AbsoluteFill`:
  - `gridSpacing = Math.max(24, 80 * cam.zoom)`
  - `gridOffsetX = (stageWidth / 2) - cam.x * cam.zoom`
  - `gridOffsetY = (stageHeight / 2) - cam.y * cam.zoom`
- **Clean Frame `0`:** On `frame <= 0`, `DirectorCamera2D` / `CameraRig` render pure `style.palette.bgCanvas` (or `null` when `renderBaseFill={false}` inside `<StyleProvider renderBackdrop>`), and `SystemNode`, `FlowCurve`, `DataFlowEdge`, and `CodePayloadToast` return `null` (`enterFrame >= 2`).

### 5. Natural `60 FPS` Data Packet Cadence
- At `60 FPS`, **never** set `packetSpeedFrames` below `60` (fast-blinking couriers look frantic and unreadable).
- Set `packetSpeedFrames` between **`92` and `120` frames (`1.5–2.0 s`)** with `packetCount={2}` (at most `3` on the longest cross-section curves).

### 6. Dedicated `9:16` Vertical Layout (`1080×1920`)
- **Never shrink a wide `16:9` diagram down to fit `9:16`:** Create a dedicated `VERTICAL_WORLD_NODES` layout stacking cards top-to-bottom (`w <= 640 px`) so cards stay crisp and legible at `zoom ~ 1.0` on a phone.
- Keep all active content inside the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**.
- Pass `nodes={VERTICAL_WORLD_NODES}` and `shots={[...]}` to `<MotionDiagramStage2D />`—it automatically fits target bounding boxes into the `9:16` Golden Safe Box while recessing background nodes via optical CoC blur.

### 7. Visual Minimalism & Typography
- Replace dense paragraphs, tables, and long code blocks with **architectural module stamp + 2–3 words + crisp calibration status bar**.
- Use Polish *Sentence case* (`Bramka płatności`, never `Bramka Płatności`) and viewer-benefit headlines.

---

## Reference Pattern (`<StyleProvider>` + `<MotionDiagramStage2D>`)

```tsx
const WORLD_NODES = {
  ingest: { cx: 560, cy: 460, w: 430, h: 196 },
  engine: { cx: 1360, cy: 460, w: 430, h: 196 },
  payload: { cx: 1360, cy: 730, w: 430, h: 168 },
} satisfies Record<string, NodeBox>;

<StyleProvider style={props.styleId} renderBackdrop>
  <MotionDiagramStage2D
    diagramCode="SCHEMAT 01 • ARCHITEKTURA"
    renderBaseFill={false}
    nodes={WORLD_NODES}
    shots={[
      { fromFrame: 0, target: ['ingest', 'engine'], transition: 'cut', padding: 140 },
      { fromFrame: 240, target: ['engine', 'payload'], transition: 'glide', padding: 150 },
    ]}
  >
    <FlowCurve
      from={portRight(WORLD_NODES.ingest)}
      to={portLeft(WORLD_NODES.engine)}
      activeFromFrame={18}
      packetSpeedFrames={96}
      packetCount={2}
    />
    <SystemNode
      id="ingest"
      moduleCode="MOD 01"
      badge="WEJŚCIE"
      title="Bramka zdarzeń"
      subtitle="Walidacja schematu wejściowego"
      statusText="Gotowość 60 FPS"
      activeStatusText="Przesył aktywny"
      x={WORLD_NODES.ingest.cx}
      y={WORLD_NODES.ingest.cy}
      width={WORLD_NODES.ingest.w}
      height={WORLD_NODES.ingest.h}
      enterFrame={4}
      activeRanges={[[18, 220]]}
    />
    <SystemNode
      id="engine"
      moduleCode="MOD 02"
      badge="RDZEŃ"
      title="Silnik rozliczeń"
      subtitle="Deterministyczny zapis transakcji"
      statusText="Oczekiwanie"
      activeStatusText="Przetwarzanie potoku"
      x={WORLD_NODES.engine.cx}
      y={WORLD_NODES.engine.cy}
      width={WORLD_NODES.engine.w}
      height={WORLD_NODES.engine.h}
      enterFrame={12}
      activeRanges={[[90, 420]]}
    />
    <CodePayloadToast
      x={WORLD_NODES.payload.cx}
      y={WORLD_NODES.engine.cy + WORLD_NODES.engine.h / 2 + 28}
      width={WORLD_NODES.payload.w}
      methodBadge="POST"
      endpoint="/v1/ledger/commit"
      latencyText="14ms"
      code={'{\n  "status": "committed",\n  "frames": 60\n}'}
      startFrame={248}
      endFrame={460}
    />
  </MotionDiagramStage2D>
</StyleProvider>
```

---

## SaaS Walkthroughs: `MotionDiagramStage2D` + Product Frames (`@make-pictures/kits/product-frames`)

Put real `.mp4` screencasts on the infinite canvas and direct the camera onto UI details with calibrated spotlight callouts:

```tsx
import { staticFile } from 'remotion';
import { MotionDiagramStage2D } from '@make-pictures/kits/motion-diagrams-2d';
import { BrowserFrame, PhoneFrame, ScreenSpotlightOverlay } from '@make-pictures/kits/product-frames';

const NODES = {
  desktop: { cx: 960, cy: 540, w: 1360, h: 902 },
  mobile: { cx: 2050, cy: 560, w: 420, h: 910 },
  exportBtn: { cx: 1380, cy: 260, w: 320, h: 140 },
};

<MotionDiagramStage2D
  renderBaseFill={false}
  nodes={NODES}
  shots={[
    { fromFrame: 0, target: 'desktop' },
    { fromFrame: 150, target: 'exportBtn', transition: 'glide', padding: 120 },
    { fromFrame: 300, target: ['desktop', 'mobile'], transition: 'glide' },
  ]}
>
  <div style={{ position: 'absolute', left: NODES.desktop.cx - 680, top: NODES.desktop.cy - 451 }}>
    <BrowserFrame url="app.example.com" videoSrc={staticFile('_productions/my-film/videos/desktop.mp4')}>
      <ScreenSpotlightOverlay x={70} y={12} width={22} height={12} startFrame={150} endFrame={290} label="Eksport PDF" />
    </BrowserFrame>
  </div>
  <div style={{ position: 'absolute', left: NODES.mobile.cx - 210, top: NODES.mobile.cy - 455 }}>
    <PhoneFrame width={420} videoSrc={staticFile('_productions/my-film/videos/mobile.mp4')} enterFrame={300} />
  </div>
</MotionDiagramStage2D>
```

- Describe each frame (and each zoom target inside it) as a `NodeBox`, so `MotionDiagramStage2D` auto-fits it into `16:9` or the `9:16` Golden Safe Box.
- `ScreenSpotlightOverlay` frames target regions in percentage coordinates of the video viewport (`frame <= 0` returns `null`, rectangular callout tag scaled by `studioStyle.surface.radiusScale` + `1px solid inkBorder`, zero `9999px` pills), inheriting `useStudioStyle()` palette & typography.
- Keep the camera on the spotlighted region for at least `90–120` frames at `60 FPS` so viewers can read it, then glide back out.
- Use `<FlowCurve />` between a `BrowserFrame` and a `PhoneFrame` (via `portRight` / `portLeft` on their nodes) to show data syncing across devices.
