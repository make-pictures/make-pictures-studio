---
name: kit-motion-diagrams-2d
description: >-
  Mathematical coordinate ports, RetroPcWindowStage2D (--style=retro-pc CRT OS
  packet hops), infinite-canvas 2D camera & dignified light/dark optical rack
  focus rules, ClippedSurfaceChrome corner hygiene, 3-ArtWorld ScenicBackdropLayers,
  luminous DataFlowEdge flow trails & >= 26px label clearance, packet speed
  cadence, and 9:16 cascade layout rules for @make-pictures/kits/motion-diagrams-2d.
  Use this skill whenever creating system architecture diagrams, Retro-PC network
  explainers, SaaS product flows, or continuous 2D canvas explainers.
---

# Kit: Motion Diagrams 2D & Retro-PC (`@make-pictures/kits/motion-diagrams-2d`)

Build gallery-grade `60 FPS` infinite-canvas architectural diagrams (`<MotionDiagramStage2D />`), classic computing / network packet windows (`<RetroPcWindowStage2D />` paired with `--style=retro-pc`), and SaaS product explainers with 3-ArtWorld `<ScenicBackdropLayers />`, `<ClippedSurfaceChrome />` rounded-corner precision, dignified light-mode rack focus, luminous Bézier flow trails, and zero GPU background clipping.

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
  RetroPcWindowStage2D,
  computeRetroPcWindowLayout,
  CameraRig,
  WorldBox,
  portTop,
  portBottom,
  portLeft,
  portRight,
  FlowCurve,
  DataFlowEdge,
  buildCubicBezierPath,
  buildElasticCordPath,
  computeLiveNodePort,
  evaluateCubicBezier,
  evaluateCubicBezierAngleDeg,
  SystemNode,
  CodePayloadToast,
  resolvePayloadTokenColors,
  type CubicBezierCurve2D,
  type ElasticCordOptions,
  type LiveNodeTransform2D,
  type Point2D,
  type MotionDiagramStage2DProps,
  type MotionDiagramFocusState,
  type RetroPcWindowStage2DProps,
  type RetroPcHopSpec,
  type RetroPcWindowLayout,
  type NodeBox,
} from '@make-pictures/kits/motion-diagrams-2d';
```

---

## Mandatory Layout, Corner Clipping, Optical Focus, Port & Camera Rules

### 1. Single Source of Truth for Node Coordinates (`NodeBox` & `boxSizing: 'border-box'`)
- **Zero manual coordinate guessing:** Never write separate approximate `(x, y)` numbers for HTML cards and SVG connection curves.
- Define every block on the 2D canvas inside one dictionary (`WORLD_NODES` for `16:9` and a dedicated `VERTICAL_WORLD_NODES` for `9:16`) as `NodeBox` (`{ cx, cy, w, h }`).
- **Explicit `boxSizing: 'border-box'` (`WorldBox` & Custom Nodes):** `WorldBox` and `getCardChromeStyle` always set `boxSizing: 'border-box'` so `padding` + `border` never inflate the rendered box beyond `{ w, h }`, keeping `portTop` / `portBottom` / `portLeft` / `portRight` pixel-accurate on card borders (`>= 18px` minimum font size across all node labels and badges).
- Mount HTML cards with `<WorldBox node={NODES.apiGateway} nodeId="apiGateway">` or `<SystemNode id="apiGateway" x={NODES.apiGateway.cx} y={NODES.apiGateway.cy} width={NODES.apiGateway.w} height={NODES.apiGateway.h} ... />` and attach all edges (`FlowCurve` / `DataFlowEdge`) **exclusively** via mathematical border port helpers:
  - `portTop(node, dx = 0)` — top border (`y = cy - h / 2`)
  - `portBottom(node, dx = 0)` — bottom border (`y = cy + h / 2`)
  - `portLeft(node, dy = 0)` — left border (`x = cx - w / 2`)
  - `portRight(node, dy = 0)` — right border (`x = cx + w / 2`)
- **Live Elastic Cords on Animated Cards (`computeLiveNodePort` & `buildElasticCordPath`):** Whenever cards bounce, squash, or tilt (`translateX/Y`, `rotateDeg`, `scaleX/Y`), compute transformed border ports with `computeLiveNodePort(box, side, transform, outsetPx)` (exact center-origin `scale -> rotate -> translate` + outward normal) and connect them via `buildElasticCordPath(from, to, { orientation, restLength, baseSagPx, archOffset, whipOffset, tension })` so cables stay locked 1:1 to live card borders, pull taut under stretch, and bow/whip elastically under slack.
- **Zero-Jitter 2D Diagrams (`handheldIntensity = 0` default):** `DirectorCamera2D` defaults to `handheldIntensity = 0` and snaps to `transform: 'none'` (omitting `willChange`) at identity; `SystemNode`, `DataFlowEdge`, `CodePayloadToast`, and `RetroPcWindowStage2D` snap settled transforms to clean 2D / `'none'` without persistent `translate3d` or `willChange`.

### 2. Rounded-Corner Clipping Hygiene (`<ClippedSurfaceChrome />`) & Zero Developer Clutter
- **`ClippedSurfaceChrome` Inside `overflow: 'visible'` Cards:** `SystemNode`, `WorldBox`, `CodePayloadToast`, and `DataFlowEdge` labels wrap their internal top accent bars, specular top-edge highlights (`specularRim={!isDark}`), and surface tint gradients inside `<ClippedSurfaceChrome />` (`borderRadius: 'inherit', overflow: 'hidden'`) while keeping only external port terminals (`data-port-terminal="left" | "right"`) outside the mask. If you build a custom world card with `overflow: 'visible'`, **always** wrap internal accent strips in `<ClippedSurfaceChrome>` (enforced by the `UNCLIPPED_CARD_BAR` rule in `npx make-pictures qa`).
- **Zero Default Developer Clutter:** `diagramCode` on `MotionDiagramStage2D` and `moduleCode` / `badge` on `SystemNode` default to `undefined` — no `MOD 01` or `SCHEMAT 01` stamps are rendered unless explicitly passed as non-empty strings. When `icon` is omitted on `SystemNode`, it renders a bespoke sculpted SVG medallion (`data-node-medallion="atelier" | "illustrative" | "editorial-gallery"`) adapted to `resolveArtWorld(style)`.

### 3. 3 Artistic Worlds & Dignified Optical Rack Focus (`<MotionDiagramStage2D />`)
- Prefer `<MotionDiagramStage2D />` (which layers `<StageLightingRig />` + `<ScenicBackdropLayers />` + `<DirectorCamera2D />` + `MotionDiagramFocusContext`):
  - **Automatic 3-ArtWorld Scenery (`showScenicBackdrop = true`):** Renders studio cyclorama & glass caustics (`'atelier'`), warm parallax hills & clouds (`'illustrative'`), or gallery passe-partout & window light (`'editorial-gallery'`) behind the infinite grid while returning `null` on `frame <= 0`.
  - **Dignified Light-Mode Rack Focus:** When `shots: ShotSpec2D[]` or `focusedNodeIds` recesses non-targeted `SystemNode` / `WorldBox` modules on light surfaces (`!surface.isDark`), `MotionDiagramStage2D` keeps `opacityScale >= 0.88`, caps `blurPx <= 1.85px` (`blur(...) saturate(0.88)`), and preserves crisp `inkBorder` definition so background nodes read as physical acrylic/paper objects sitting deeper in studio light — never washed-out `0.55` gray HTML inputs. Emits `filter: 'none'` whenever CoC blur `< 0.25px`.

### 4. Visual Noise Ban, Single-Source Cubic Bézier Geometry (`buildCubicBezierPath`) & `DataFlowEdge`
- **Visual Noise Ban & The 2-Second Test:** Never decorate diagrams with simultaneous packet clouds on every edge, spinning dashed radar rings, wavy multi-color cables, or tangled spaghetti graphs with color legends. If a viewer needs `> 2 s` to decode edge colors/dots, replace the graph with `<ComparisonSplit2D />` or at most `3` calm nodes connected by clean directional strokes (`packetCount={0}`).
- **Single Source of Truth for SVG Curves (`buildCubicBezierPath` & `evaluateCubicBezier`):** Both `FlowCurve` and `DataFlowEdge` default to **`packetCount = 0`** (clean `strokeDashoffset` line draw without wandering dots). Whenever a single pulse (`packetCount={1}`) is genuinely warranted, both `<path d={curve.d} />` and `evaluateCubicBezier(curve.p0, curve.p1, curve.p2, curve.p3, t)` derive from the **exact same 4 control points** — never approximate dot motion with linear interpolation or `Math.sin(...)`!
- **`>= 26px` Label Clearance & Header Avoidance (`curveX` / `curveOffsetX`):** Floating `<DataFlowEdge />` labels sit `>= 30px` clear of the cubic Bézier apex (`>= 18px` font floor), and lateral arches (`curveX` / `curveOffsetX`) cleanly bypass section headers.

### 5. Calm `60 FPS` Pacing (`>= 4.5s` Scenes & Optional `92–120f` Single-Pulse Cadence)
- Keep `packetCount={0}` by default; when a single pulse (`packetCount={1}`) illustrates an active hop, set `packetSpeedFrames` / `traverseFrames` between **`92` and `120` frames (`1.5–2.0 s`)** — never `< 60`.
- Every visual scene in `productions/*` must span **`>= 270` frames (`4.5 s` @ `60 FPS`)** with full voiceover breathing room (`computeSceneTimingFromVoiceover`), connected via `<ContinuousSceneFlow />` (`npx make-pictures qa` hard gate).
- For sub-pixel callout pins on UI screenshots or hardware plates inside `@make-pictures/kits/product-frames`, use `<PinnedMediaStage />` (`sourceWidth`, `sourceHeight`, `pins`, `Δx = 0.00 px` — re-exported directly from `@make-pictures/kits/product-frames`).

### 6. Dedicated `9:16` Vertical Layout (`1080×1920`)
- Create a dedicated `VERTICAL_WORLD_NODES` layout stacking cards top-to-bottom (`w <= 640 px`) strictly inside the **Golden Safe Box (`x ∈ [40, 910]`, `y ∈ [220, 1380]`)**, connecting vertical ports (`portBottom` -> `portTop`).

---

## Reference Pattern (`<MotionDiagramStage2D>` + Liquid Style Morphing)

```tsx
const WORLD_NODES = {
  prompt: { cx: 460, cy: 480, w: 380, h: 196 },
  direction: { cx: 960, cy: 440, w: 390, h: 196 },
  master: { cx: 1460, cy: 480, w: 380, h: 196 },
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

## Classic Computing & Network Hop Windows: `<RetroPcWindowStage2D />` (`--style=retro-pc`)

For networking, HTTP/DNS/CDN explainers, or classic computing stories (`npx make-pictures new <slug> --space=2d --style=retro-pc`), `<RetroPcWindowStage2D />` renders a complete CRT desktop OS window with titlebar controls, address bar, animated packet hop cards (`RetroPcHopSpec[]`), cumulative latency readout, and status bar:

- **Key Props (`RetroPcWindowStage2DProps`):**
  - `windowTitle: string` & `addressLabel: string` — **SECURITY / OFFLINE RULE:** Always use **symbolic offline example URLs only** (e.g., `'GET https://twoja-strona.pl'`, `'GET https://your-site.dev'`, or `'GET https://example.app'`). **Never** place private LAN, gateway, or router IP literals in `addressLabel` or diagram copy!
  - `hops: ReadonlyArray<RetroPcHopSpec>` — `{ id, title, subtitle, badge, latencyMs, icon?: 'browser' | 'directory' | 'server' | 'check' }`.
  - `statusBanner: string`, `progress: number` (`0..1` packet journey progress across hops), `lang?: 'pl' | 'en'` (renders localized `'AKTYWNY' / 'GOTOWY'` vs `'ACTIVE' / 'READY'` chrome), `isVertical?: boolean`, `enterFrame?: number` (default `2`; returns `null` on `frame <= 0` for Clean Frame `0`).
- **Automatic `16:9` + `9:16` Golden Safe Box Layout (`computeRetroPcWindowLayout`):**
  - `computeRetroPcWindowLayout({ viewportWidth, viewportHeight, isVertical, hopCount })` arranges hops horizontally in `16:9` (`1920×1080`) and automatically cascades them vertically inside `x ∈ [64, 880], y ∈ [264, 1308]` on `9:16` (`1080×1920`) — strictly inside the **Golden Safe Box (`x ∈ [40, 910], y ∈ [220, 1380]`)** with zero packet/label overlaps.

```tsx
const HOPS: RetroPcHopSpec[] = [
  { id: 'browser', title: 'Przeglądarka', subtitle: 'Zapytanie HTTPS', badge: 'KLIENT', latencyMs: 2, icon: 'browser' },
  { id: 'edge', title: 'Katalog nazw', subtitle: 'Rozpoznanie domeny', badge: 'KATALOG', latencyMs: 6, icon: 'directory' },
  { id: 'origin', title: 'Serwer aplikacji', subtitle: 'Odpowiedź 200 OK', badge: 'SERWER', latencyMs: 10, icon: 'server' },
];

<StyleProvider style="retro-pc" renderBackdrop>
  <RetroPcWindowStage2D
    lang="pl"
    windowTitle="Monitor pakietów — Retro OS"
    addressLabel="GET https://twoja-strona.pl"
    hops={HOPS}
    statusBanner="Połączenie szyfrowane TLS • Suma opóźnień: 18 ms"
    progress={packetProgress}
    isVertical={height > width}
  />
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
