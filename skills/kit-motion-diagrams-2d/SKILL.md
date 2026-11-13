---
name: kit-motion-diagrams-2d
description: >-
  Mathematical coordinate ports, infinite-canvas 2D camera rules, packet speed
  cadence, and 9:16 cascade layout rules for @make-pictures/kits/motion-diagrams-2d.
  Use this skill whenever creating system architecture diagrams, SaaS product
  flows, or one-shot 2D canvas explainers.
---

# Kit: Motion Diagrams 2D (`@make-pictures/kits/motion-diagrams-2d`)

Build crisp `60 FPS` infinite-canvas system diagrams, architecture flows, and product explainers with zero coordinate guessing and zero GPU background clipping.

---

## Core Primitives & Imports

```tsx
import { DirectorCamera2D, SPRING_PRESETS } from '@make-pictures/core';
import {
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
  type NodeBox,
} from '@make-pictures/kits/motion-diagrams-2d';
```

---

## Mandatory Layout, Port & Camera Rules

### 1. Single Source of Truth for Node Coordinates (`NodeBox`)
- **Zero manual coordinate guessing:** Never write separate approximate `(x, y)` numbers for HTML cards and SVG connection curves.
- Define every block on the 2D canvas inside one dictionary (`WORLD_NODES` for `16:9` and a dedicated `VERTICAL_WORLD_NODES` for `9:16`) as `NodeBox` (`{ cx, cy, w, h }`).
- Mount HTML cards with `<WorldBox node={NODES.apiGateway}>...</WorldBox>` and attach all edges (`FlowCurve` / `DataFlowEdge`) **exclusively** via mathematical border port helpers:
  - `portTop(node, dx = 0)` — top border (`y = cy - h / 2`)
  - `portBottom(node, dx = 0)` — bottom border (`y = cy + h / 2`)
  - `portLeft(node, dy = 0)` — left border (`x = cx - w / 2`)
  - `portRight(node, dy = 0)` — right border (`x = cx + w / 2`)

### 2. Header & Card Border Avoidance (`curveX` Detour)
- **Never slice section headers with lines:** Never route a vertical connection straight through the middle of a section title or flush along the vertical side edge of a card.
- When connecting a card in an upper section to a card in a lower section across a section header, exit from `portBottom(sourceNode)` and bypass the header with a wide, smooth lateral Bézier arch using `curveX` (e.g., `curveX={-240}` or `curveX={240}` on `<FlowCurve orientation="vertical" ... />`).

### 3. Infinite Viewport-Pinned Grid (`DirectorCamera2D` / `CameraRig`)
- **Never place a finite background `div` inside a 3D perspective container:** Putting a large grid element inside `perspective` + `rotateX` causes Chromium's GPU tile buffer to clip edges when zooming out (`zoom ~ 0.5x`), leaving empty strips around the screen.
- Always use `<DirectorCamera2D />` (Shot DSL auto-framing) or `<CameraRig />` (explicit `CameraKeyframe[]`), which pins the technical grid directly to the viewport `AbsoluteFill`:
  - `gridSpacing = Math.max(24, 80 * cam.zoom)`
  - `gridOffsetX = (stageWidth / 2) - cam.x * cam.zoom`
  - `gridOffsetY = (stageHeight / 2) - cam.y * cam.zoom`
- The world container uses `width: 0; height: 0; transformOrigin: '0 0'` and pure 2D transform `translate3d(centerX, centerY, 0) scale(zoom) rotate(rotateZ) translate3d(-cam.x, -cam.y, 0)`.
- **Frame `0` Clean Board:** Start the first card entrance at `frame - 2` (`spring({ frame: frame - 2, fps, config: SPRING_PRESETS.snappy })`) so `frame === 0` renders a clean empty grid (`opacity: 0`).

### 4. Natural `60 FPS` Data Packet Cadence
- At `60 FPS`, **never** set `packetSpeedFrames` below `60` (fast-blinking dots look frantic and unreadable).
- Set `packetSpeedFrames` between **`92` and `120` frames (`1.5–2.0 s`)** with `packetCount={2}` (at most `3` on the longest cross-section curves).

### 5. Dedicated `9:16` Vertical Layout (`1080×1920`)
- **Never shrink a wide `16:9` diagram down to fit `9:16`:** Create a dedicated `VERTICAL_WORLD_NODES` layout stacking cards top-to-bottom (or in compact pairs `<= 860 px` wide) so cards stay crisp and legible at `zoom ~ 1.0` on a phone.
- Keep all active content inside the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**.
- When using `DirectorCamera2D`, pass `nodes={VERTICAL_WORLD_NODES}` and `shots={[...]}`—it automatically fits target bounding boxes into the `9:16` Golden Safe Box! When computing manual `CameraKeyframe` targets, set `cam.y = (sectionHeaderTop + bottomCardBottom) / 2` so the header never clips at the top edge.

### 6. Visual Minimalism & Typography
- Replace dense paragraphs, tables, and long code blocks with **Icon (`lucide-react`) + 2–3 words + state pill/progress bar**.
- Use Polish *Sentence case* (`Bramka płatności`, never `Bramka Płatności`) and viewer-benefit headlines.

---

## Reference Pattern

```tsx
const WORLD_NODES = {
  ingest: { cx: 480, cy: 540, w: 340, h: 150 },
  engine: { cx: 1020, cy: 540, w: 360, h: 170 },
  archive: { cx: 1020, cy: 980, w: 360, h: 150 },
} satisfies Record<string, NodeBox>;

<DirectorCamera2D
  nodes={WORLD_NODES}
  shots={[
    { fromFrame: 0, target: ['ingest', 'engine'], transition: 'cut', padding: 140 },
    { fromFrame: 210, target: ['engine', 'archive'], transition: 'glide', padding: 150 },
  ]}
>
  <FlowCurve
    from={portRight(WORLD_NODES.ingest)}
    to={portLeft(WORLD_NODES.engine)}
    activeFromFrame={24}
    packetSpeedFrames={104}
    packetCount={2}
  />
  <FlowCurve
    from={portBottom(WORLD_NODES.engine)}
    to={portTop(WORLD_NODES.archive)}
    orientation="vertical"
    curveX={-240} // Detours cleanly around any intermediate section title
    activeFromFrame={220}
    packetSpeedFrames={108}
    packetCount={2}
  />
  <WorldBox node={WORLD_NODES.ingest} opacity={ingestEnter} scale={0.94 + 0.06 * ingestEnter}>
    {/* Crisp Icon + 2-3 words + status badge */}
  </WorldBox>
</DirectorCamera2D>
```


---

## SaaS Walkthroughs: `DirectorCamera2D` + Product Frames (`@make-pictures/kits/product-frames`)

Put real `.mp4` screencasts on the infinite canvas and direct the camera onto UI details:

```tsx
import { staticFile } from 'remotion';
import { DirectorCamera2D } from '@make-pictures/core';
import { BrowserFrame, PhoneFrame, ScreenSpotlightOverlay } from '@make-pictures/kits/product-frames';

const NODES = {
  desktop: { cx: 960, cy: 540, w: 1360, h: 902 },
  mobile: { cx: 2050, cy: 560, w: 420, h: 910 },
  // Sub-region of the desktop frame to zoom into (world coords)
  exportBtn: { cx: 1380, cy: 260, w: 320, h: 140 },
};

<DirectorCamera2D
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
</DirectorCamera2D>
```

- Describe each frame (and each zoom target inside it) as a `NodeBox`, so `DirectorCamera2D` auto-fits it into `16:9` or the `9:16` Golden Safe Box.
- `ScreenSpotlightOverlay` coordinates default to **percent of the video viewport**, so they work at any recording resolution.
- Keep the camera on the spotlighted region for at least 90–120 frames at 60 FPS so viewers can read it, then glide back out.
- Use `<FlowCurve />` between a `BrowserFrame` and a `PhoneFrame` (via `portRight` / `portLeft` on their nodes) to show data syncing across devices.
