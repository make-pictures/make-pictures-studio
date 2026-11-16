<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures — Open-source 60 FPS Video-as-Code Studio" width="420" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/kits"><img src="https://img.shields.io/npm/v/@make-pictures/kits?style=for-the-badge&labelColor=0F172A&color=FF2A85&label=%40make-pictures%2Fkits" alt="@make-pictures/kits on npm" /></a>
  <img src="https://img.shields.io/badge/7_Visual_Kits_%2B_VFX-FF2A85?style=for-the-badge&labelColor=0F172A" alt="7 Visual Kits %2B VFX" />
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Studio-2563EB?style=for-the-badge&labelColor=0F172A" alt="make.pictures Studio" /></a>
</p>

# `@make-pictures/kits`

Composable **60 FPS Visual Kits** across **`2D` / `2.5D` / `3D`** dimensional spaces for [`make.pictures`](https://make.pictures):

- `@make-pictures/kits/editorial-collage` — Documentary essays, Ken Burns media frames & ink-brush quotes (`EditorialDeskStage`, `ChapterTitleCard`, `EditorialMediaCard`, `HighlightQuoteStage`, `SplitStoryLayout`).
- `@make-pictures/kits/vector-scene-2d` — Universal 2D narrative cards, callouts & comparisons (`VectorSceneStage2D`, `StoryCard2D`, `AnnotatedCallout2D`, `ComparisonSplit2D`).
- `@make-pictures/kits/motion-diagrams-2d` — Infinite-canvas architecture & Retro-PC packet flows (`MotionDiagramStage2D`, `RetroPcWindowStage2D`, `SystemNode`, `DataFlowEdge`, `NodeBox`, `FlowCurve`).
- `@make-pictures/kits/kinetic-typography` — Polymorphic 3-grammar phrase beats & counters (`WordByWordStage`, `ImpactKeywordCard`, `AnimatedMetricCounter`).
- `@make-pictures/kits/data-storytelling` — Animated bar races, timelines & metric cards (`DataStoryStage2D`, `AnimatedBarRace`, `TimelineTrack`, `MetricComparisonCard`).
- `@make-pictures/kits/paper-diorama-3d` — 2.5D layered cutout theater (`DioramaStage3D`, `PaperCutout3D`, `ImageCutout3D`, `PopUpHinge3D`, `PaperStageLighting3D`, plus 9 `ScenicCutoutMotifs` including Apollo 11 lunar motifs).
- `@make-pictures/kits/isometric-3d` — 3D Soft-Clay podcast studio, offline `<Lightformer>` IBL & architectural turntable (`StudioHdrRig3D`, `PodcastStudioSet3D`, `ClayCharacter3D`, `IsometricStage3D`, `Stylized3DCharacter`).
- `@make-pictures/kits/product-frames` — Product Frames for SaaS `.mp4` screen recordings (`BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay`) rendered via Remotion `<OffthreadVideo />`.
- `@make-pictures/kits/vfx` — Velocity-coupled optical overlays & 3D volumetric atmosphere (`CinematicLensOverlay`, `ParticleField`, `StagePostProcessing3D`, `ContactShadowDisc3D`).

## Install

```bash
npm install @make-pictures/core @make-pictures/kits
```

## Usage

```tsx
import { FlowCurve, portRight, portLeft, type NodeBox } from '@make-pictures/kits/motion-diagrams-2d';

const NODES = {
  api: { cx: 520, cy: 540, w: 340, h: 150 },
  db: { cx: 1180, cy: 540, w: 340, h: 150 },
} satisfies Record<string, NodeBox>;

<FlowCurve from={portRight(NODES.api)} to={portLeft(NODES.db)} activeFromFrame={24} packetSpeedFrames={104} />;
```

## Links

- Website: [make.pictures](https://make.pictures)
- Source & docs: [github.com/make-pictures/make-pictures-studio](https://github.com/make-pictures/make-pictures-studio)
- YouTube: [@makepicturestv](https://www.youtube.com/@makepicturestv) (EN) · [@makepicturespl](https://www.youtube.com/@makepicturespl) (PL)

## License

MIT © [make.pictures](https://make.pictures)
