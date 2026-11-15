# make.pictures Showreel v3 ("Kino z Kodu") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `productions/make-pictures-showreel/` into the flagship `36.0s` (`2160` frames @ `60 FPS`) 5-Act Showreel v3 showcasing all 7 scene kits, all 7 built-in styles, 3 optical lighting regimes, Circle-of-Confusion rack focus, polymorphic 2D/3D engines, Studio Web / Style Lab, and real ElevenLabs PL/EN narration + AI music + Foley SFX across 4 mastered `-14 LUFS` MP4 compositions (`16:9` & `9:16` in `PL` & `EN`).

**Architecture:** Five bounded `<Sequence>` acts (`0..390`, `390..810`, `810..1260`, `1260..1770`, `1770..2160`) mount genuine `@make-pictures/core` optical rigs and `@make-pictures/kits` primitives full-bleed with a subtle viewport `OpticalHudBadge` (`kit • style • lightingRig`). WebGL (`<ThreeCanvas>`) is isolated exclusively inside Act 4 across two non-overlapping sub-sequences (`DioramaStage3D` `0..180`, `IsometricStage3D` `180..510`) so at most one WebGL context exists on any frame.

**Tech Stack:** TypeScript, React 18, Remotion 4 (`60 FPS`), Three.js / `@remotion/three`, `zod`, `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/cli`, ElevenLabs TTS (`eleven_multilingual_v2`), ElevenLabs Music (`composition-plan`), ElevenLabs SFX, `ffmpeg` (`-14 LUFS` EBU R128).

## Global Constraints

- **Isolated Capsule Scope:** All production code lives inside `productions/make-pictures-showreel/` (`productions/*` is gitignored in the engine monorepo; never hardcode showreel scene IDs inside `packages/*`).
- **Clean Frame `0`:** Global frame `0` (and `1`) renders pure `palette.bgCanvas` (`opacity: 0` on foreground & HUD); scenic entrances start at `frame - 2` (`localFrame >= 2`).
- **Determinism (`--concurrency=100%`):** Zero `Math.random()` and zero cross-frame mutable `useRef` state; use `createSeededRandom(seed)` from `@make-pictures/core`.
- **Typography & Copy:** Sharp typography deadzone (`< 0.25px -> filter: 'none'`), Polish *Sentence case* with full `latin-ext`, concise visual cards (*Icon + 2–3 words*), no bottom subtitles duplicating voiceover.
- **TTS Phonetics (`production.json`):** Zero raw acronyms, digits, exclamation marks, or URLs in `text` / `previousText` / `nextText`; write `mejk kropka pikczers` (PL) and `make dot pictures` (EN).
- **`9:16 Golden Safe Box`:** Every card, node, chart, callout, HUD badge, and CLI plaque in `1080×1920` vertical compositions must stay strictly inside `x ∈ [40, 910], y ∈ [220, 1380]` (using inner safe margin `x ∈ [64, 884], y ∈ [248, 1344]` to absorb optical micro-dolly zoom `<= 1.045`).
- **3D & Audio Hygiene:** At most 1 active `<ThreeCanvas>` per frame; `PaperCutout3D` rows separated by `Δz >= 0.45` with `maxWidth` on Polish canvas text; `Stylized3DCharacter` separates `speakingWeight` vs `speechEnergy` (`talkBounce = 0`, gesture frequency `0.03..0.055 rad/frame`); `<Audio />` only via `<VoiceoverTrack />`, `<SmartMusicBed />`, and `<SoundCue />`.
- **4 Mandatory Verification Gates (`AGENTS.md` §4):** (1) Listen to generated `.mp3` files via `read_file`, (2) Inspect all 4 `out/qa-MakePicturesShowreel*.png` sheets via `read_file`, (3) Pass `npm run typecheck` + `npm test`, (4) Render all 4 `-14 LUFS` MP4 files via `npx tsx packages/cli/src/index.ts render`.

---

### Task 1: Showreel v3 Contracts, `OpticalHudBadge`, `production.json` & Real ElevenLabs Audio Synthesis

**Files:**
- Modify: `productions/make-pictures-showreel/compositions/contracts.ts`
- Create: `productions/make-pictures-showreel/compositions/OpticalHudBadge.tsx`
- Modify: `productions/make-pictures-showreel/production.json`
- Regenerate (via CLI): `productions/make-pictures-showreel/generated/audio-manifest.ts`

**Interfaces:**
- Consumes: `@make-pictures/core` (`BuiltInStyleId`, `CompositionSceneSegment`, `ProductionCameraCut`, `ProductionSfxCue`, `SceneVoiceoverData`, `WordTimestamp`, `resolveStyleOptics`, `useStudioStyle`, `formatFontFamilyCss`).
- Produces:
  - `SHOWREEL_FPS = 60`, `SHOWREEL_DURATION_SECONDS = 36`, `SHOWREEL_DURATION_FRAMES = 2160`
  - `ShowreelLanguage = 'pl' | 'en'`
  - `ShowreelActId = 'act1-kinetic-editorial' | 'act2-vector-data' | 'act3-polymorphic-diagram' | 'act4-dimensional-maquettes' | 'act5-studio-finale'`
  - `SHOWREEL_ACTS`, `SHOWREEL_ACT_MAP`, `SHOWREEL_ALL_KIT_IDS` (7 kits), `SHOWREEL_ALL_STYLE_IDS` (7 built-in styles)
  - `ACT3_DIAGRAM_MORPH_SLOTS` (`3 × 150` frames: `minimal-product`, `cyber-telemetry`, `sketch-notebook`)
  - `ACT4_ISOMETRIC_STYLE_SLOTS` (`3 × 110` frames across `localFrame 180..510`: `editorial-press`, `cyber-telemetry`, `sketch-notebook`)
  - `VERTICAL_SAFE_BOX` (`{ minX: 40, maxX: 910, minY: 220, maxY: 1380, innerLeft: 64, innerRight: 884, innerTop: 248, innerBottom: 1344 }`)
  - `SHOWREEL_VOICEOVER_WINDOWS`, `buildShowreelSceneTimelineFromManifest(lang, manifest)`
  - `computeVoiceoverSpeechEnvelope(vo, localFrameInScene)` returning `{ speechEnergy: number; activeWordIndex: number }`
  - `SHOWREEL_SFX_BEATS`, `SHOWREEL_SFX_TIMELINE`, `SHOWREEL_CAMERA_TIMELINE`
  - `hasBannedVoiceoverToken(text: string): boolean`
  - `<OpticalHudBadge kitLabel={string} styleId={BuiltInStyleId} visible={boolean} isVertical={boolean} />`

- [ ] **Step 1: Write `productions/make-pictures-showreel/compositions/contracts.ts` with complete 5-act `2160`-frame timelines, `7×7` coverage matrix, speech-envelope math, and `9:16` Safe Box constants**

```ts
// Core exports in productions/make-pictures-showreel/compositions/contracts.ts
export const SHOWREEL_FPS = 60 as const;
export const SHOWREEL_DURATION_SECONDS = 36 as const;
export const SHOWREEL_DURATION_FRAMES = 2160 as const; // 36.0s @ 60 FPS

export type ShowreelLanguage = 'pl' | 'en';

export type ShowreelActId =
  | 'act1-kinetic-editorial'
  | 'act2-vector-data'
  | 'act3-polymorphic-diagram'
  | 'act4-dimensional-maquettes'
  | 'act5-studio-finale';

export const SHOWREEL_ALL_KIT_IDS = [
  'kinetic-typography',
  'editorial-collage',
  'vector-scene-2d',
  'data-storytelling',
  'motion-diagrams-2d',
  'paper-diorama-3d',
  'isometric-3d',
] as const;

export const SHOWREEL_ALL_STYLE_IDS: readonly BuiltInStyleId[] = [
  'brutalist-poster',
  'editorial-press',
  'archival-chronicle',
  'minimal-product',
  'cyber-telemetry',
  'sketch-notebook',
  'tactile-craft',
] as const;

export const VERTICAL_SAFE_BOX = {
  minX: 40,
  maxX: 910,
  minY: 220,
  maxY: 1380,
  innerLeft: 64,
  innerRight: 884,
  innerTop: 248,
  innerBottom: 1344,
} as const;
```

Include exact act windows (`0..390`, `390..810`, `810..1260`, `1260..1770`, `1770..2160`), `SHOWREEL_VOICEOVER_WINDOWS` (`fromFrame: 12`, `404`, `824`, `1274`, `1784` with `maxEndFrame` inside each act), `SHOWREEL_SFX_BEATS` (`shutter-gate`, `paper-slide`, `aperture-focus`, `prism-morph`, `popup-unfold`, `orbital-whip`, `finale-bloom`), `SHOWREEL_CAMERA_TIMELINE` covering `0..2160`, `computeVoiceoverSpeechEnvelope`, and `hasBannedVoiceoverToken`.

- [ ] **Step 2: Create `productions/make-pictures-showreel/compositions/OpticalHudBadge.tsx`**

Implement a crisp viewfinder badge pinned to `(x: 68, y: 52)` in `16:9` and `(x: 68, y: 252)` in `9:16` (strictly inside `VERTICAL_SAFE_BOX`), displaying `[KIT] • [STYLE] • [LIGHTING RIG]` in `monoFont`, hidden when `globalFrame < 2` or `!visible`.

- [ ] **Step 3: Update `productions/make-pictures-showreel/production.json` with the 10 PL/EN scenes, 36s `composition-plan` score, and 7 SFX specs**

Write all 5 `PL` scenes (`act1-pl..act5-pl`) and 5 `EN` scenes (`act1-en..act5-en`) with `voiceId: "onwK4e9ZLuTAKqWW03F9"` (`Daniel`, `stability: 0.58`, `similarityBoost: 0.84`, `style: 0.24`, `speed: 1.12`, `useSpeakerBoost: true`), stitched `previousText`/`nextText`, zero raw acronyms/digits/URLs, `score` (`id: "optical-showreel-score"`, `mode: "composition-plan"`, `durationSeconds: 36`, 3 `sections` totaling `36000 ms`), and the 7 `sfx` assets.

- [ ] **Step 4: Synthesize real ElevenLabs voiceovers, AI music, and SFX via CLI & audition `.mp3` files (`read_file`)**

Run:
```bash
npx tsx packages/cli/src/index.ts audio --production=make-pictures-showreel
```
Then inspect `productions/make-pictures-showreel/generated/audio-manifest.ts` to verify every `act1..5` (`pl` & `en`) duration fits cleanly inside its act window (`fromFrame + Math.ceil(durationInSeconds * 60) <= maxEndFrame`), and listen to generated `.mp3` files in `public/_productions/make-pictures-showreel/` via `read_file` (`AGENTS.md` §4.1). If any spoken line runs slightly tight, adjust `fromFrame` or act split by a few frames in `contracts.ts` before building visual acts.

---

### Task 2: Acts 1 & 2 — Kinetic, Editorial, Vector Plate & Data Optics (`0..810`)

**Files:**
- Create: `productions/make-pictures-showreel/compositions/Act1KineticEditorial.tsx`
- Create: `productions/make-pictures-showreel/compositions/Act2VectorDataOptics.tsx`

**Interfaces:**
- Consumes: `contracts.ts`, `OpticalHudBadge.tsx`, `VOICEOVER_MANIFEST`, `@make-pictures/core` (`StyleProvider`, `OpticalStage2D`, `DepthPlane`, `StageLightingRig`), `@make-pictures/kits` (`WordByWordStage`, `ImpactKeywordCard`, `EditorialDeskStage`, `SplitStoryLayout`, `HighlightQuoteStage`, `EditorialMediaCard`, `VectorSceneStage2D`, `ComparisonSplit2D`, `StoryCard2D`, `AnnotatedCallout2D`, `DataStoryStage2D`, `MetricComparisonCard`, `AnimatedBarRace`, `TimelineTrack`, `SceneTransition`).
- Produces:
  - `Act1KineticEditorial: React.FC<{ lang: ShowreelLanguage; isVertical: boolean; showOpticalHud: boolean }>` (`390` frames)
  - `Act2VectorDataOptics: React.FC<{ lang: ShowreelLanguage; isVertical: boolean; showOpticalHud: boolean }>` (`420` frames)

- [ ] **Step 1: Implement `Act1KineticEditorial.tsx` (`localFrame 0..389`)**

- Frame `0..1`: clean `palette.bgCanvas` (`opacity: 0` on foreground).
- Sub-sequence `1A` (`0..186`): `<StyleProvider style="brutalist-poster" renderBackdrop>` + `<StageLightingRig />` + `<OpticalStage2D>` mounting `<WordByWordStage words={act1Words} sceneStartFrame={12} wordsPerBeat={3} safeBox9x16 />` synced directly to `VOICEOVER_MANIFEST['act1-pl' | 'act1-en'].words`, paired with a compact `<ImpactKeywordCard>` stamp (`60 FPS • RISOGRAFIA` / `60 FPS • RISOGRAPH`) inside `9:16 Safe Box`.
- Sub-sequence `1B` (`186..390`): `<StyleProvider style="editorial-press" renderBackdrop>` + `<EditorialDeskStage>` + `<SplitStoryLayout focusShiftFrame={84}>` combining `<HighlightQuoteStage>` (pen-stroke underline synced to `"światło"` / `"light"`) and `<EditorialMediaCard>` (deterministic data-URI architectural light-study SVG with Ken Burns `zoomFrom={1.02}` → `zoomTo={1.09}`).
- Internal `<SceneTransition atFrame={186} durationInFrames={16} type="paper-curtain" />` and `<OpticalHudBadge />`.

- [ ] **Step 2: Implement `Act2VectorDataOptics.tsx` (`localFrame 0..419`)**

- Sub-sequence `2A` (`0..210`): `<StyleProvider style="archival-chronicle" renderBackdrop>` + `<VectorSceneStage2D>` mounting `<ComparisonSplit2D focusShiftFrame={92} />` (optical rack focus shifting from flat SVG baseline to multi-plane CoC optics), flanked by an engraved `<StoryCard2D compact />` badge and `<AnnotatedCallout2D elbowMode="auto" />` (`45° -> horizontal` reticle leader) clamped inside `VERTICAL_SAFE_BOX`.
- Sub-sequence `2B` (`210..420`): `<StyleProvider style="minimal-product" renderBackdrop>` + `<DataStoryStage2D>` arranging `<MetricComparisonCard mode="rings" beforeValue={24} afterValue={60} unit=" FPS" />` (`240°` calibrated arc dials + hatched delta), `<AnimatedBarRace maxItems={3} safeBox9x16 />` (`resolveTonalBarFill`), and `<TimelineTrack safeBox9x16 />` (vernier rail shifting optical focus across 3 milestones) in a clean 2-column grid for `16:9` and a single vertical column inside `x ∈ [68, 880], y ∈ [292, 1340]` for `9:16`.

---

### Task 3: Acts 3 & 4 — Live Polymorphic Diagram & Sculptural 2.5D/3D Maquettes (`810..1770`)

**Files:**
- Create: `productions/make-pictures-showreel/compositions/Act3PolymorphicDiagram.tsx`
- Create: `productions/make-pictures-showreel/compositions/Act4DimensionalMaquettes.tsx`

**Interfaces:**
- Consumes: `contracts.ts`, `OpticalHudBadge.tsx`, `VOICEOVER_MANIFEST`, `@remotion/three` (`ThreeCanvas`), `@make-pictures/core` (`StyleProvider`, `StageLightingRig`, `DirectorCamera3D`, `ShotSpec2D`, `ShotSpec3D`, `StageAnchor3D`, `getSmoothPoseWindow`), `@make-pictures/kits` (`MotionDiagramStage2D`, `SystemNode`, `DataFlowEdge`, `CodePayloadToast`, `portRight`, `portLeft`, `portTop`, `portBottom`, `DioramaStage3D`, `PopUpHinge3D`, `PaperCutout3D`, `PaperStageLighting3D`, `IsometricStage3D`, `Stylized3DCharacter`).
- Produces:
  - `Act3PolymorphicDiagram: React.FC<{ lang: ShowreelLanguage; isVertical: boolean; showOpticalHud: boolean }>` (`450` frames)
  - `Act4DimensionalMaquettes: React.FC<{ lang: ShowreelLanguage; isVertical: boolean; showOpticalHud: boolean }>` (`510` frames)

- [ ] **Step 1: Implement `Act3PolymorphicDiagram.tsx` (`localFrame 0..449`)**

- Resolve active style from `ACT3_DIAGRAM_MORPH_SLOTS`:
  - `0..149`: `'minimal-product'` (`studio-macro` + `anodized-pill`)
  - `150..299`: `'cyber-telemetry'` (`darkroom-halation` + `laser-telemetry` + `optical-gate`)
  - `300..449`: `'sketch-notebook'` (`window-gobo` + `drafting-arrow`)
- Wrap `<StageLightingRig />` + `<MotionDiagramStage2D shots={diagramShots}>` inside `<StyleProvider style={activeSlot.styleId} renderBackdrop>`.
- Build deterministic `16:9` horizontal 3-node topology (`Prompt / Kod` → `Silnik Optyczny` → `Render 60 FPS`) and `9:16` vertical cascade topology (`portBottom → portTop`, strictly inside `x ∈ [72, 876], y ∈ [300, 1330]`), connected by `<DataFlowEdge traverseFrames={104} packetCount={2} />` and `<CodePayloadToast>` showing live `optics` JSON tokens, while `MotionDiagramStage2D` shifts topological rack focus smoothly across the 3 nodes!

- [ ] **Step 2: Implement `Act4DimensionalMaquettes.tsx` (`localFrame 0..509`) with strict 1-WebGL-context-per-frame isolation**

- **Sub-sequence `4A` (`<Sequence from={0} durationInFrames={180}>` — `paper-diorama-3d` in `tactile-craft`):**
  - Mount `<StyleProvider style="tactile-craft" renderBackdrop>` + `<ThreeCanvas width={width} height={height}>` + `<DirectorCamera3D anchors={DIORAMA_ANCHORS} shots={DIORAMA_SHOTS} />` + `<PaperStageLighting3D preset="golden-hour" />` + `<DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight">`.
  - Place 3 layered `<PopUpHinge3D>` rows at `z = -1.7`, `z = -0.7`, and `z = +0.2` (`Δz >= 0.9 >= 0.45`, zero Z-fighting), using `anchor="bottom"`, `whiteBorderPx={14}`, `pad >= 32`, explicit `maxWidth` on Polish canvas labels, and `cacheDeps` tracking style palette + language.
- **Sub-sequence `4B` (`<Sequence from={180} durationInFrames={330}>` — `isometric-3d` across 3 maquette finishes):**
  - Cycle `<StyleProvider style={isoStyle} renderBackdrop>` across `editorial-press` (`ceramic-maquette`, `0..109`), `cyber-telemetry` (`anodized-telemetry`, `110..219`), and `sketch-notebook` (`ink-figurine`, `220..329`) with smoothly interpolated `optics.lightAngleDeg` override (`-36° -> +28°`) so directional key light & shadows visibly sweep across the 24-tick `<IsometricStage3D>` plinth!
  - Mount `<DirectorCamera3D anchors={ISO_ANCHORS} shots={ISO_SHOTS} />` (`medium-two-shot` → `medium` — calibrated for `9:16 Safe Box`).
  - Mount two `<Stylized3DCharacter>` figures driven by `computeVoiceoverSpeechEnvelope(VOICEOVER_MANIFEST['act4-pl' | 'act4-en'], localFrame + 180 - 14)`: smooth `speakingWeight` handoff at midpoint, syllable `speechEnergy` driving jaw/nod (`talkBounce = 0`), and `getSmoothPoseWindow` gestures (`0.04 rad/frame` limit).

---

### Task 4: Act 5, Root Composer, `*.props.json` & Unit Tests (`1770..2160`)

**Files:**
- Create: `productions/make-pictures-showreel/compositions/Act5StudioFinale.tsx`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreel.tsx`
- Modify: `productions/make-pictures-showreel/index.ts`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelPL.props.json`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelEN.props.json`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelVerticalPL.props.json`
- Modify: `productions/make-pictures-showreel/compositions/MakePicturesShowreelVerticalEN.props.json`
- Create: `productions/make-pictures-showreel/compositions/__tests__/showreel-v3.test.ts`
- Delete obsolete v2 files: `Act1StudioHero.tsx`, `Act2ThreeShowcase.tsx`, `Act3StyleLabMorph.tsx`, `Act4BrandFinale.tsx`, `ShowreelLayout.ts`, `__tests__/showreel-layout.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 modules, `@make-pictures/core` (`SmartMusicBed`, `VoiceoverTrack`, `SoundCue`, `useMusicBeatPulse`, `StyleProvider`, `OpticalStage2D`, `StageLightingRig`), `@make-pictures/kits` (`BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay`, `VectorSceneStage2D`, `StoryCard2D`, `SceneTransition`).
- Produces:
  - Registered 4 compositions (`MakePicturesShowreelPL`, `MakePicturesShowreelEN`, `MakePicturesShowreelVerticalPL`, `MakePicturesShowreelVerticalEN`) at `2160` frames (`36.0s` @ `60 FPS`).
  - Passing unit test suite `productions/make-pictures-showreel/compositions/__tests__/showreel-v3.test.ts`.

- [ ] **Step 1: Write failing test `productions/make-pictures-showreel/compositions/__tests__/showreel-v3.test.ts`**

Test invariants:
1. `SHOWREEL_FPS === 60`, `SHOWREEL_DURATION_FRAMES === 2160`, 5 contiguous acts covering `0..2160` with zero gaps/overlaps.
2. Complete `7 kits × 7 styles` coverage verified against `BUILT_IN_STYLE_IDS`.
3. `showreelProduction.compositions` registers all 4 compositions (`1920×1080` & `1080×1920`, `usesThree: true`, `durationInFrames: 2160`, `hasMusicScore: true`), and all 4 `*.props.json` validate cleanly against `MakePicturesShowreelSchema`.
4. `production.json` + `VOICEOVER_MANIFEST` + `MUSIC_MANIFEST` + `SFX_MANIFEST` integrity: all 10 voiceovers exist, zero banned acronyms/exclamations/URLs in spoken text, non-overlapping voiceover windows finishing before `win.maxEndFrame`, all 7 SFX audio files present.
5. `9:16 Golden Safe Box` layout geometry bounds strictly inside `x ∈ [40, 910], y ∈ [220, 1380]`.

- [ ] **Step 2: Run test to verify it fails before wiring root composer**

Run:
```bash
npx tsx --test productions/make-pictures-showreel/compositions/__tests__/showreel-v3.test.ts
```
Expected: FAIL (until `Act5StudioFinale.tsx`, `MakePicturesShowreel.tsx`, `index.ts`, and `*.props.json` are updated).

- [ ] **Step 3: Implement `Act5StudioFinale.tsx`, update `MakePicturesShowreel.tsx`, `index.ts`, and all 4 `*.props.json`, and remove obsolete v2 files**

- `Act5StudioFinale.tsx` (`390` frames):
  - `5A` (`0..180`): `<OpticalStage2D>` wrapping `<BrowserFrame width={1240}>` (in `16:9`) or `<PhoneFrame width={500}>` (in `9:16`, centered at `x ∈ [225, 725]` inside `Golden Safe Box`) rendering a crisp deterministic Studio Web **🎨 Style Lab + Props Inspector** workspace with `<ScreenSpotlightOverlay startFrame={16} endFrame={166} />` highlighting the live style grid & optical aperture controls.
  - `5B` (`180..390`): `<VectorSceneStage2D>` brand finale plaque featuring `make.pictures`, `brandHeadline`, `ctaCommand` (`npx create-make-pictures@latest`), `skillsCommand` (`npx skills add make-pictures/make-pictures-studio`), and subtle `beatPulse` halo.
- Update `MakePicturesShowreel.tsx` with `MakePicturesShowreelSchema`, `<SmartMusicBed />`, `<VoiceoverTrack />`, `<SoundCue />`, 5 `<Sequence>` acts, and 4 cross-act `<SceneTransition />` cuts (`390`, `810`, `1260`, `1770`).
- Update `index.ts` subtitles/metadata (`36s • 60 FPS • 7 Kits × 7 Optical Styles`) and all 4 `MakePicturesShowreel*.props.json` files.
- Delete the obsolete v2 files (`Act1StudioHero.tsx`, `Act2ThreeShowcase.tsx`, `Act3StyleLabMorph.tsx`, `Act4BrandFinale.tsx`, `ShowreelLayout.ts`, `__tests__/showreel-layout.test.ts`).

- [ ] **Step 4: Run `showreel-v3.test.ts`, `npm run typecheck`, and `npm test`**

Run:
```bash
npx tsx --test productions/make-pictures-showreel/compositions/__tests__/showreel-v3.test.ts
npm run typecheck
npm test
```
Expected: `100%` PASS with zero TypeScript errors.

---

### Task 5: Contact-Sheet Visual QA (`4 × PNG`) & Mastered `-14 LUFS` Renders (`4 × MP4`)

**Files:**
- Generate & inspect:
  - `out/qa-MakePicturesShowreelPL.png`
  - `out/qa-MakePicturesShowreelEN.png`
  - `out/qa-MakePicturesShowreelVerticalPL.png`
  - `out/qa-MakePicturesShowreelVerticalEN.png`
- Render & master (`-14 LUFS`):
  - `out/make-pictures-showreel-pl.mp4`
  - `out/make-pictures-showreel-en.mp4`
  - `out/make-pictures-showreel-vertical-pl.mp4`
  - `out/make-pictures-showreel-vertical-en.mp4`

- [ ] **Step 1: Run Contact-Sheet QA for all 4 compositions (`AGENTS.md` §4.2)**

Run:
```bash
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelPL
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelVerticalPL
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelEN
npx tsx packages/cli/src/index.ts qa MakePicturesShowreelVerticalEN
```

- [ ] **Step 2: Visually inspect all 4 QA PNG contact sheets via `read_file`**

Verify on every contact sheet:
- `f=0 (0.00s)` is pure clean `palette.bgCanvas` (`#F8FAFC`).
- Polish diacritics (`ą, ć, ę, ł, ń, ó, ś, ź, ż`) render cleanly in *Sentence case* with zero text overflow or clipping.
- Optical lighting (`darkroom-halation`, `window-gobo`, `studio-macro`), rack focus transitions, 3 diagram couplers, 2.5D cutouts (`Δz >= 0.45`, zero Z-fighting), 3D sculptural characters, and `BrowserFrame`/`PhoneFrame` spotlight look sharp and balanced.
- In `VerticalPL` & `VerticalEN` (`9:16`), every card, node, HUD badge, and CTA stays strictly inside **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`**.
- If any visual glitch or margin issue appears, fix it in the corresponding Act component, re-run `typecheck` + `qa`, and re-inspect via `read_file`.

- [ ] **Step 3: Render all 4 mastered `-14 LUFS` MP4 files (`AGENTS.md` §4.3)**

Run:
```bash
npx tsx packages/cli/src/index.ts render MakePicturesShowreelPL
npx tsx packages/cli/src/index.ts render MakePicturesShowreelVerticalPL
npx tsx packages/cli/src/index.ts render MakePicturesShowreelEN
npx tsx packages/cli/src/index.ts render MakePicturesShowreelVerticalEN
```
Verify with `ffprobe` / `ls -lh` that all 4 output files exist in `out/`, are `36.0s` (`2160` frames @ `60 FPS`), `1920×1080` / `1080×1920`, with valid AAC audio tracks mastered to `-14 LUFS`.
