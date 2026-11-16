# Director DNA, 3 Artistic Worlds & Showreel v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bake director pacing, optical continuity, and a hard cinematography QA gate into `@make-pictures/core` and `@make-pictures/cli`, eliminate CSS/SVG geometry defects while elevating `@make-pictures/kits` and all 7 CLI templates into three distinct Artistic Worlds (`atelier`, `illustrative`, `editorial-gallery`), and build the calm, cohesive `44.0s` (`2640` frames @ `60 FPS`) Showreel v4 across 4 mastered `-14 LUFS` MP4 compositions.

**Architecture:** Sequential 3-stage foundation:
1. **Stage 1 (`@make-pictures/core` + `@make-pictures/cli`):** `ArtWorld` taxonomy (`'atelier' | 'illustrative' | 'editorial-gallery'`), continuous `60 FPS` style interpolation (`interpolateStylePresets`), `<ContinuousSceneFlow>` optical cross-dissolve composer (with automatic `<= 1` WebGL context handoff), `<ClippedSurfaceChrome>`, `<ScenicBackdropLayers>`, and hard `auditCompositionDirection` inside `npx make-pictures qa`.
2. **Stage 2 (`@make-pictures/kits` + `@make-pictures/studio` + CLI scaffolds):** Fix `SystemNode` overhanging top bars and `DataFlowEdge` clearances, remove developer clutter (`MOD 01`, `SLOT 01/03`), add rich 2D scenic backdrops, painterly 2.5D `ScenicCutoutMotifs`, full 3D architectural rooms (`IsometricScenicSet3D`), and upgrade all 7 `new-production.ts` scaffolds + `StyleLabShowcase.tsx`.
3. **Stage 3 (`productions/make-pictures-showreel/` v4):** Four `10.5–11.5s` scenes (`630 + 690 + 690 + 630 = 2640` frames = `44.0s`) connected exclusively via `54`-frame (`0.9s`) `<ContinuousSceneFlow>` optical dissolves and `60`-frame `interpolateStylePresets` morphing, paired with calm `speed: 1.04` ElevenLabs PL/EN narration and a `44s` score.

**Tech Stack:** TypeScript, React 18, Remotion 4 (`60 FPS`), Three.js / `@remotion/three`, `zod`, `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`, ElevenLabs TTS/Music/SFX, `ffmpeg` (`-14 LUFS` EBU R128).

## Global Constraints

- **Schema Section Stability:** `StylePresetSchema` introspection MUST preserve the exact 7 Polish section titles (`['Informacje', 'Paleta kolorów', 'Typografia', 'Powierzchnia & Tło', 'Fizyka ruchu', 'Optyka & Światło', 'Domyślne Audio']`); place `artWorld` under `'Informacje :: Świat artystyczny'`.
- **Clean Frame `0`:** `frame === 0` renders 100% uniform `palette.bgCanvas` (`opacity: 0` on foreground); entrances start at `frame >= 2`.
- **Determinism (`--concurrency=100%`):** Zero `Math.random()` and zero cross-frame mutable `useRef` state in scene trees; use `createSeededRandom(seed)`.
- **Corner & Clipping Precision:** Every rounded card/node with `overflow: 'visible'` MUST wrap internal accent bars, highlights, and surface textures inside `<ClippedSurfaceChrome>` (`position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden'`) so zero pixels ever protrude past rounded corners.
- **Director Pacing Law (Hard QA Gate):** Minimum `270` frames (`4.5s` @ `60 FPS`) per visual scene in `origin: 'production'`, single focal point per sequence (never combine `<WordByWordStage>` with card components), `<= 2.8` spoken words/s with `>= 45` frames (`0.75s`) calm breathing hold, and zero choppy `<SceneTransition type="flash-cut" | "paper-curtain" | "iris-wipe">` unless `--allow-fast-cuts` is explicitly passed.
- **WebGL Context Budget:** At most **1 active `<ThreeCanvas>`** mounted on any frame across the entire timeline.
- **`9:16 Golden Safe Box`:** All vertical `1080×1920` cards, nodes, 3D subjects, and plaques stay strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`.
- **Security:** Never read, cat, or print `.env` or `.env.local`.

---

## STAGE 1 — Director DNA in `@make-pictures/core` & Hard QA Gate in `@make-pictures/cli`

### Task 1: `ArtWorld`, `interpolateStylePresets`, `<ContinuousSceneFlow>`, `<ScenicBackdropLayers>` & `<ClippedSurfaceChrome>` (`@make-pictures/core`)

**Files:**
- Modify: `packages/core/src/style/schema.ts`
- Modify: `packages/core/src/style/presets.ts`
- Create: `packages/core/src/style/interpolate.ts`
- Modify: `packages/core/src/style/index.ts`
- Create: `packages/core/src/director/pacing.ts`
- Create: `packages/core/src/director/ContinuousSceneFlow.tsx`
- Create: `packages/core/src/director/ScenicBackdropLayers.tsx`
- Create: `packages/core/src/director/ClippedSurfaceChrome.tsx`
- Create: `packages/core/src/director/index.ts`
- Modify: `packages/core/src/optics/tactileSurface.ts`
- Modify: `packages/core/src/optics/StageLightingRig.tsx`
- Modify: `packages/core/src/index.ts`
- Test: `packages/cli/tests/director-dna-core.test.ts`

**Interfaces:**
- Produces from `@make-pictures/core`:
  - `ArtWorldSchema = z.enum(['atelier', 'illustrative', 'editorial-gallery'])`, `export type ArtWorld = z.infer<typeof ArtWorldSchema>`
  - `resolveArtWorld(style: StylePreset): ArtWorld`
  - `interpolateStylePresets(fromStyle: StylePreset, toStyle: StylePreset, progress: number): StylePreset`
  - `DIRECTOR_PACING_BUDGET`, `CINEMATIC_SPRINGS`, `useFocalStagger(frame, fps, options?)`
  - `<ContinuousSceneFlow scenes={ContinuousSceneSpec[]} crossDissolveFrames={number} />`, `<OpticalCrossDissolve />`
  - `<ScenicBackdropLayers style?: StylePreset; seed?: string | number; intensity?: number />`
  - `<ClippedSurfaceChrome topBarHeight?: number; topBarColor?: string; specularRim?: boolean; children?: React.ReactNode />`

- [ ] **Step 1: Write failing tests in `packages/cli/tests/director-dna-core.test.ts`**

Test:
1. All 7 `BUILT_IN_STYLES` resolve expected `artWorld` (`minimal-product` & `cyber-telemetry` -> `'atelier'`; `tactile-craft` & `sketch-notebook` -> `'illustrative'`; `editorial-press`, `archival-chronicle`, `brutalist-poster` -> `'editorial-gallery'`), and `StylePresetSchema` preserves exact 7 Polish sections.
2. `interpolateStylePresets(a, b, t)` returns `a` at `t=0`, `b` at `t=1`, smooth intermediate hex/rgba palette & `optics` values at `t=0.5`, and switches discrete fonts cleanly at `t=0.5`.
3. `computeContinuousSceneWindows(scenes, crossDissolveFrames)` enforces `<= 1` active `usesThree` scene on every frame `0..totalFrames - 1` while overlapping 2D-to-2D and 2D-to-3D transitions smoothly across `crossDissolveFrames`.
4. `DIRECTOR_PACING_BUDGET` & `useFocalStagger` enforce lead-before-support stagger (`>= 20` frames) and monotonic critically damped `CINEMATIC_SPRINGS`.

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test packages/cli/tests/director-dna-core.test.ts`

- [ ] **Step 3: Implement `@make-pictures/core` style interpolation, director primitives, scenic backdrops & tactile elevation**

- In `schema.ts` & `presets.ts`: add `ArtWorldSchema`, `artWorld: ArtWorldSchema.optional().describe('Informacje :: Świat artystyczny')`, `resolveArtWorld`, and set `artWorld` on all 7 built-in styles. Slightly deepen `minimal-product.palette.bgCanvas` (`#F1F5F9`) vs `bgSurface` (`#FFFFFF`) or enrich `tactileSurface.ts` + `StageLightingRig.tsx` so light-mode cards have crisp studio figure-ground contrast (`inset 0 1px 0 rgba(255,255,255,0.9)` + rich ambient-occlusion + directional shadow).
- Implement `interpolate.ts` using `Easing.inOut(Easing.cubic)` + Remotion `interpolateColors`.
- Implement `ContinuousSceneFlow.tsx`:
  - `ContinuousSceneSpec`: `{ id: string; durationInFrames: number; usesThree?: boolean; veilColor?: string; render: () => React.ReactNode }`.
  - When `prev.usesThree && next.usesThree`: render `prev` up to boundary `B`, render `next` starting at `B` (zero WebGL overlap!), and drape a smooth `crossDissolveFrames` optical luminous veil (`0 -> 1 -> 0` centered at `B`) over the seam so the transition looks completely liquid while mounting at most 1 `<ThreeCanvas>`!
  - Otherwise (2D↔2D or 2D↔3D): extend outgoing `<Sequence>` by `+halfDissolve` and start incoming `<Sequence>` at `-halfDissolve` with smoothstep opacity, subtle `0 -> 4px -> 0` optical defocus (`< 0.25px -> filter: 'none'` outside transition!), and gentle `0.986 -> 1.0 -> 1.016` scale continuity.
- Implement `ScenicBackdropLayers.tsx` rendering Clean Frame `0` (`null` on `frame <= 0`) and rich multi-plane SVG/CSS scenery per `artWorld`:
  - `'atelier'`: architectural cyclorama horizon curve, soft floor reflection pool, subtle optical lens caustics.
  - `'illustrative'`: layered parallax vector hills, soft organic clouds, warm sun/moon disc, subtle botanical/geometric accents.
  - `'editorial-gallery'`: gallery passe-partout frame lines, subtle warm window shadow cast, monumental tonal architectural planes.
- Implement `ClippedSurfaceChrome.tsx` (`position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none'`) rendering clipped top accent bars and subtle top specular highlights cleanly inside any rounded card.

- [ ] **Step 4: Run tests & typecheck, then commit**

Run:
```bash
npx tsx --test packages/cli/tests/director-dna-core.test.ts
npx tsx --test packages/cli/tests/studio-player-and-schema.test.ts
npm run typecheck
```

---

### Task 2: Hard Director Audit Gate in `npx make-pictures qa` & Canonical Skills Update (`@make-pictures/cli`)

**Files:**
- Create: `packages/cli/src/director/audit-direction.ts`
- Modify: `packages/cli/src/commands/qa-contact-sheet.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `.agents/plugins/make-pictures/skills/make-pictures-director/SKILL.md`
- Modify: `.agents/plugins/make-pictures/skills/style-and-art-direction/SKILL.md`
- Modify: `.agents/plugins/make-pictures/skills/cinematography-and-vfx/SKILL.md`
- Sync: `npm run sync:skills`
- Test: `packages/cli/tests/director-qa-audit.test.ts`

**Interfaces:**
- Produces:
  - `auditCompositionDirection(params: AuditDirectionParams): DirectorAuditResult` (`violations: DirectorAuditViolation[]`, throws formatted `DirectorAuditError` when `violations.length > 0 && !allowFastCuts`)
  - `verifyCleanFrameZeroImage(pngPath: string): { clean: boolean; maxChannelSpread: number }`
  - CLI boolean flag `--allow-fast-cuts` on `make-pictures qa`

- [ ] **Step 1: Write failing tests in `packages/cli/tests/director-qa-audit.test.ts`**

Test that `auditCompositionDirection`:
1. Rejects visual `<Sequence durationInFrames={174}>` (`< 270f` @ `60 FPS`) in a `origin: 'production'` composition while ignoring `<Sequence layout="none">` audio wrappers.
2. Rejects mounting `<WordByWordStage` alongside `<ImpactKeywordCard` / `<StoryCard2D` / `<SystemNode` in the same file/sequence.
3. Rejects `<SceneTransition` with `type="flash-cut" | "paper-curtain" | "iris-wipe"` or `durationInFrames < 30`.
4. Rejects `production.json` scenes exceeding `2.8` spoken words/s over their visual scene span or leaving `< 36` frames of breathing room.
5. Rejects JSX blocks containing `overflow: 'visible'` paired with an unclipped `top: 0` bar outside `ClippedSurfaceChrome`.
6. Passes cleanly on well-paced `<ContinuousSceneFlow>` productions AND passes all existing `examples/*` compositions.

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test packages/cli/tests/director-qa-audit.test.ts`

- [ ] **Step 3: Implement `audit-direction.ts`, wire into `qa-contact-sheet.ts` & `index.ts`, and update skills**

- Wire `auditCompositionDirection` inside `runQaContactSheetCommand` BEFORE rendering stills (instant fast-fail feedback for agents!) AND run `verifyCleanFrameZeroImage` on rendered `f=0` still!
- Add `'allow-fast-cuts'` to `BOOLEAN_FLAGS` in `packages/cli/src/index.ts` and pass `allowFastCuts` to `runQaContactSheetCommand`.
- Document `<ContinuousSceneFlow>`, `interpolateStylePresets`, `ArtWorld` (`atelier` / `illustrative` / `editorial-gallery`), `<ClippedSurfaceChrome>`, and the hard `qa` Director Gate in the 3 canonical skills and run `npm run sync:skills`.

- [ ] **Step 4: Run tests, typecheck & commit**

Run:
```bash
npx tsx --test packages/cli/tests/director-qa-audit.test.ts
npm run typecheck
npm test
```

---

## STAGE 2 — Geometric Precision & 3 Artistic Worlds Across `@make-pictures/kits`, `Style Lab` & CLI Scaffolds

### Task 3: 2D Kits Overhaul — `<ClippedSurfaceChrome>`, Clean Typography, Scenic Backdrops & Contrast (`@make-pictures/kits`)

**Files:**
- Modify: `packages/kits/src/motion-diagrams-2d/SystemNode.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/NodeBox.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/DataFlowEdge.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/CodePayloadToast.tsx`
- Modify: `packages/kits/src/motion-diagrams-2d/MotionDiagramStage2D.tsx`
- Modify: `packages/kits/src/editorial-collage/EditorialDeskStage.tsx`
- Modify: `packages/kits/src/editorial-collage/EditorialMediaCard.tsx`
- Modify: `packages/kits/src/vector-scene-2d/VectorSceneStage2D.tsx`
- Modify: `packages/kits/src/vector-scene-2d/StoryCard2D.tsx`
- Modify: `packages/kits/src/vector-scene-2d/ComparisonSplit2D.tsx`
- Modify: `packages/kits/src/data-storytelling/DataStoryStage2D.tsx`
- Modify: `packages/kits/src/data-storytelling/MetricComparisonCard.tsx`
- Modify: `packages/kits/src/data-storytelling/AnimatedBarRace.tsx`
- Modify: `packages/kits/src/kinetic-typography/ImpactKeywordCard.tsx`
- Test: `packages/cli/tests/artistic-worlds-kits-2d.test.ts`

- [ ] **Step 1: Write failing tests in `packages/cli/tests/artistic-worlds-kits-2d.test.ts`**

Verify:
1. `SystemNode` wraps its top header bar & specular sheen inside `ClippedSurfaceChrome` (zero unclipped `top: 0` bars inside `overflow: 'visible'`) and omits technical `MOD 01` clutter unless `moduleCode` is explicitly non-empty.
2. `MotionDiagramStage2D` recessed nodes on light backgrounds preserve crisp legibility (`opacityScale >= 0.82`, `blurPx <= 2.2` on `!isDark`) instead of washed-out `0.55` ghosts.
3. `DataFlowEdge` maintains `>= 26px` clearance between curve apex and floating label.
4. `VectorSceneStage2D`, `EditorialDeskStage`, `DataStoryStage2D`, and `MotionDiagramStage2D` embed `<ScenicBackdropLayers>` adapting to all 3 `ArtWorld`s while keeping `frame === 0` pure `bgCanvas`.

- [ ] **Step 2: Implement the 2D kit geometric & artistic upgrades**

- Fix `SystemNode.tsx` (`<ClippedSurfaceChrome topBarHeight={...} topBarColor={...} specularRim />`), soften port pins into refined architectural terminals, increase title typography prominence, and hide developer metadata unless explicitly passed.
- Fix `DataFlowEdge.tsx` label offset clearance (`>= 26px` above/below curve apex) and smooth luminous flow trail.
- Fix `MotionDiagramStage2D.tsx` & `ComparisonSplit2D.tsx` light-mode rack focus so unfocused cards remain dignified, legible objects in space rather than disabled form boxes.
- Integrate `<ScenicBackdropLayers />` across `EditorialDeskStage`, `VectorSceneStage2D`, `DataStoryStage2D`, and `MotionDiagramStage2D`, and wrap internal card bars/highlights in `StoryCard2D`, `MetricComparisonCard`, `CodePayloadToast`, and `ImpactKeywordCard` with `<ClippedSurfaceChrome />`.

- [ ] **Step 3: Run tests & typecheck, then commit**

Run:
```bash
npx tsx --test packages/cli/tests/artistic-worlds-kits-2d.test.ts
npm run typecheck
npm test
```

---

### Task 4: 3D & 2.5D Artistic Scenery — `ScenicCutoutMotifs` & `IsometricScenicSet3D` (`@make-pictures/kits`)

**Files:**
- Create: `packages/kits/src/paper-diorama-3d/ScenicCutoutMotifs.tsx`
- Modify: `packages/kits/src/paper-diorama-3d/index.ts`
- Create: `packages/kits/src/isometric-3d/IsometricScenicSet3D.tsx`
- Modify: `packages/kits/src/isometric-3d/IsometricStage3D.tsx`
- Modify: `packages/kits/src/isometric-3d/index.ts`
- Modify: `.agents/plugins/make-pictures/skills/kit-paper-diorama-3d/SKILL.md`
- Modify: `.agents/plugins/make-pictures/skills/kit-isometric-3d/SKILL.md`
- Sync: `npm run sync:skills`
- Test: `packages/cli/tests/artistic-worlds-kits-3d.test.ts`

- [ ] **Step 1: Write failing tests in `packages/cli/tests/artistic-worlds-kits-3d.test.ts`**

Verify:
1. `ScenicCutoutMotifs` exports `MountainRangeCutout3D`, `CloudCanopyCutout3D`, `PineGroveCutout3D`, `AtelierDeskCutout3D`, and `SunburstArchCutout3D` with deterministic `cacheDeps`, `whiteBorderPx` margins, and Polish-safe `maxWidth` text bounds.
2. `IsometricScenicSet3D` resolves distinct architectural room themes (`computeScenicRoomTokens(style)`) across `'atelier'`, `'illustrative'`, and `'editorial-gallery'`, and `IsometricStage3D` mounts `IsometricScenicSet3D` by default (`showScenicSet = true`) while preserving Clean Frame `0`.

- [ ] **Step 2: Implement `ScenicCutoutMotifs.tsx` & `IsometricScenicSet3D.tsx`**

- `ScenicCutoutMotifs.tsx`: multi-toned painterly Canvas2D illustrations (layered snow/terracotta mountains with ridge shading, fluffy layered clouds, stylized pine/cypress trees, warm studio desk with brass lamp & open sketchbook, sunburst celestial arch) extruded as genuine `PaperCutout3D` props.
- `IsometricScenicSet3D.tsx`: corner architectural studio walls (`y = 0..3.1`), tall mullioned window casting a directional light shaft aligned with `optics.lightAngleDeg`, recessed gallery/bookshelf niche with sculptural vessels/books, low centerpiece table, and warm inlay floor — proportioned so `16:9` and `9:16 Safe Box` framing stay completely unobstructed!

- [ ] **Step 3: Run tests, sync skills & typecheck, then commit**

Run:
```bash
npm run sync:skills
npx tsx --test packages/cli/tests/artistic-worlds-kits-3d.test.ts
npm run typecheck
npm test
```

---

### Task 5: Studio `Style Lab` 3-World Previews, 7 CLI Starter Scaffolds & `pack:verify` (`@make-pictures/studio`, `@make-pictures/cli`)

**Files:**
- Modify: `packages/studio/src/client/components/StyleLabShowcase.tsx`
- Modify: `packages/cli/src/commands/new-production.ts`
- Modify: `packages/create-make-pictures/` (if template mirror exists — check & keep synced)
- Test: `packages/cli/tests/new-production.test.ts`

- [ ] **Step 1: Upgrade `StyleLabShowcase.tsx` & all 7 `new-production.ts` scaffolds**

- In `StyleLabShowcase.tsx`: embed `<ScenicBackdropLayers />`, `<ClippedSurfaceChrome />`, painterly diorama & architectural room previews, and clean editorial typography without `MOD 01` clutter across all 7 kit tabs.
- In `new-production.ts`: upgrade all 7 kit scaffolds (`editorial-collage`, `vector-scene-2d`, `kinetic-typography`, `data-storytelling`, `motion-diagrams-2d`, `paper-diorama-3d`, `isometric-3d`) to `720` frames (`12.0s` = two calm `360`-frame scenes) connected via `<ContinuousSceneFlow crossDissolveFrames={48} />`, using `ScenicCutoutMotifs` in `paper-diorama-3d`, `IsometricStage3D` with `IsometricScenicSet3D` in `isometric-3d`, and calm spoken copy (`<= 2.4 words/s`) so every generated capsule passes the hard `auditCompositionDirection` gate out-of-the-box!

- [ ] **Step 2: Run full test suite, scaffold QA spot-checks (`read_file`), and `npm run pack:verify`**

Run:
```bash
npm run typecheck
npm test
npm run pack:verify
```
Also scaffold & run `qa` on `motion-diagrams-2d`, `paper-diorama-3d`, and `isometric-3d` into a temporary check capsule (cleaned up afterward), inspecting the generated PNGs via `read_file` to verify `ClippedSurfaceChrome`, `ScenicBackdropLayers`, `ScenicCutoutMotifs`, and `IsometricScenicSet3D` visually!

---

## STAGE 3 — Flagship Showreel v4 (`44.0 s` / `2640` Frames @ `60 FPS`, 4 Calm Continuous Scenes)

### Task 6: Showreel v4 `production.json`, Calm ElevenLabs Synthesis (`speed: 1.04`) & `contracts.ts`

**Files:**
- Modify: `productions/make-pictures-showreel/production.json`
- Modify: `productions/make-pictures-showreel/compositions/contracts.ts`
- Delete obsolete v3 HUD/act files when wiring: `OpticalHudBadge.tsx`, `Act1KineticEditorial.tsx`, `Act2VectorDataOptics.tsx`, `Act3PolymorphicDiagram.tsx`, `Act4DimensionalMaquettes.tsx`, `Act5StudioFinale.tsx`
- Regenerate (via CLI): `productions/make-pictures-showreel/generated/audio-manifest.ts`

- [ ] **Step 1: Write `production.json` (8 calm scenes: `scene1..4` in `pl` & `en` at `speed: 1.04`, `44s` `composition-plan` score, 4 subtle organic SFX) and `contracts.ts` (`2640` frames: `0..630`, `630..1320`, `1320..2010`, `2010..2640`)**

- Synthesize via `npx tsx packages/cli/src/index.ts audio --production=make-pictures-showreel`.
- Audition all generated `.mp3` clips via `read_file` (`AGENTS.md` §4.1) and verify each ~`4.5–5.5s` clip sits inside its `10.5–11.5s` scene with `>= 5.0s` of musical breathing room!

---

### Task 7: Showreel v4 Four Artistic Scenes (`Scene1..Scene4`)

**Files:**
- Create: `productions/make-pictures-showreel/compositions/Scene1EditorialGallery.tsx` (`0..630`, `10.5s`)
- Create: `productions/make-pictures-showreel/compositions/Scene2AtelierMorph.tsx` (`630..1320`, `11.5s`)
- Create: `productions/make-pictures-showreel/compositions/Scene3IllustrativeWorlds3D.tsx` (`1320..2010`, `11.5s`)
- Create: `productions/make-pictures-showreel/compositions/Scene4StudioFinale.tsx` (`2010..2640`, `10.5s`)

- [ ] **Step 1: Implement all 4 calm, gallery-grade scenes (`16:9` & `9:16 Safe Box`)**

1. **`Scene1EditorialGallery.tsx` (`630f`):**
   - `0..282` (`4.7s`): Pure `editorial-press` cotton paper & warm window light with **only** a single monumental `<ChapterTitleCard>` (*„Jedna opowieść. Trzy światy sztuki.”* / *„One story. Three worlds of craft.”*), entering smoothly via `CINEMATIC_SPRINGS.entrance` and holding in calm stillness.
   - `282..630` (`5.8s`): Smooth `48`-frame internal optical dissolve on the same editorial desk into passe-partout `<SplitStoryLayout>` with bespoke gallery illustration `<EditorialMediaCard>` and concise `<HighlightQuoteStage>`.
2. **`Scene2AtelierMorph.tsx` (`690f`):**
   - Continuous `<StyleProvider style={morphedStyle} renderBackdrop>` where `morphedStyle = interpolateStylePresets(BUILT_IN_STYLES['minimal-product'], BUILT_IN_STYLES['cyber-telemetry'], morphProgress)` glides across `localFrame 280..352` (`1.2s` liquid transformation, zero cuts!).
   - Clean 3-node `<MotionDiagramStage2D>` (`Opis` → `Kierunek sztuki` → `Film 60 FPS`, zero `MOD 01` clutter, clipped acrylic/obsidian `<SystemNode>` chrome, luminous `<DataFlowEdge>`) paired harmoniously with a single `<MetricComparisonCard>`.
3. **`Scene3IllustrativeWorlds3D.tsx` (`690f`):**
   - Sub-flow via `<ContinuousSceneFlow crossDissolveFrames={48}>` across two `usesThree: true` acts (`330f` = `5.5s` and `360f` = `6.0s`, guaranteed `<= 1` WebGL context per frame!):
     - `3A` (`330f`): `tactile-craft` `<DioramaStage3D>` with `<SunburstArchCutout3D>`, `<MountainRangeCutout3D>`, `<CloudCanopyCutout3D>`, `<PineGroveCutout3D>`, and `<AtelierDeskCutout3D>` unfolding gracefully.
     - `3B` (`360f`): `<IsometricStage3D>` with full `<IsometricScenicSet3D>` studio room, sunlit tall window shaft, bookcase, centerpiece table, and two `<Stylized3DCharacter>` figures conversing gently to `VOICEOVER_MANIFEST['scene3-*']`.
4. **`Scene4StudioFinale.tsx` (`630f`):**
   - `0..300` (`5.0s`): `<BrowserFrame>` (`16:9`) / `<PhoneFrame>` (`9:16`) showcasing the 3 Artistic Worlds (`Atelier` / `Ilustracyjny` / `Galeryjny`) in **🎨 Style Lab** with `<ScreenSpotlightOverlay>`.
   - `300..630` (`5.5s`): Smooth `48`-frame optical dissolve into a serene, monumental `make.pictures` open-source finale plaque (`npx create-make-pictures@latest`) holding cleanly for `3+ seconds` as the music resolves.

---

### Task 8: Showreel v4 Composer Integration, Hard `qa` Inspection (`4 × PNG`) & `-14 LUFS` Renders (`4 × MP4`)

**Files:**
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreel.tsx`
- Modify: `productions/make-pictures-showreel/index.ts`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreel{PL,EN,VerticalPL,VerticalEN}.props.json`
- Replace test: `productions/make-pictures-showreel/compositions/__tests__/showreel-v4.test.ts` (delete `showreel-v3.test.ts`)

- [ ] **Step 1: Wire `MakePicturesShowreel.tsx` on `<ContinuousSceneFlow crossDissolveFrames={54} />`, pass `showreel-v4.test.ts`, run hard `npx make-pictures qa` on all 4 compositions, inspect all 4 PNGs via `read_file`, and render all 4 `-14 LUFS` MP4s**

Run:
```bash
npx tsx --test productions/make-pictures-showreel/compositions/__tests__/showreel-v4.test.ts
npm run typecheck
npm test
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelPL
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelVerticalPL
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelEN
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelVerticalEN
npx tsx packages/cli/src/index.ts render MakePicturesShowreelPL
npx tsx packages/cli/src/index.ts render MakePicturesShowreelVerticalPL
npx tsx packages/cli/src/index.ts render MakePicturesShowreelEN
npx tsx packages/cli/src/index.ts render MakePicturesShowreelVerticalEN
```
Inspect every QA sheet via `read_file` (plus extra stills on `SystemNode` top corners and Scene 2 style-morph midpoint!) and run an independent `swarm` verifier across code, tests, audio, QA sheets, and `-14 LUFS` `ffprobe`/`ebur128` streams before finishing.
