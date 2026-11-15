# Specyfikacja Projektowa: Autorskie Media Plastyczne i Silnik Optyczny — Fala 3 (`motion-diagrams-2d`, `isometric-3d`)

**Data:** 2026-11-15  
**Pakiety docelowe:** `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`, `plugins/make-pictures` (`+ skills/`)  
**Status:** Oczekuje na przegląd pisemnej specyfikacji przez użytkownika  

---

## 1. Kontekst, Diagnoza Problemu i Zakres Fali 3

Po wdrożeniu Fali 1 (`a610307` — silnik optyczny 2.5D w `@make-pictures/core`, `editorial-collage`, `kinetic-typography`) oraz Fali 2 (`b7963b4` — `vector-scene-2d`, `data-storytelling`), Fala 3 zamyka przebudowę wszystkich nie-dioramowych zestawów wizualnych studia **make.pictures**, obejmując dwa ostatnie kity:

1. **`@make-pictures/kits/motion-diagrams-2d`** wraz ze wspólną warstwą kamery nieskończonego płótna 2D (`DirectorCamera2D` w `@make-pictures/core` oraz `CameraRig` w `motion-diagrams-2d`, plus drobna higiena etykiety w `ScreenSpotlightOverlay`).
2. **`@make-pictures/kits/isometric-3d`** (scena studyjna 3D `IsometricStage3D`, postacie `Stylized3DCharacter`, choreografia kamery `DirectorCamera3D` w szablonach CLI oraz podgląd `60 FPS` w `Style Lab`).

### Diagnoza obecnych symptomów „AI-slop” i luk architektonicznych w Fali 3
1. **Kamera 2D (`DirectorCamera2D.tsx`, `CameraRig.tsx`) i `motion-diagrams-2d`:**
   - `DirectorCamera2D` i `CameraRig` malują na sztywno ciemne tło `#080C16` / `#F8FAFC` oraz cyjanowo-fioletowo-szmaragdowe plamy `radial-gradient` (`rgba(0, 240, 255, 0.14)`, `rgba(165, 180, 252, 0.35)`), ignorując `<StyleProvider>`, kierunkowe oświetlenie `StageLightingRig` oraz czystą klatkę `0`.
   - `SystemNode` ma domyślne `enterFrame = 0` (naruszenie czystej klatki `0`), półprzezroczysty zaokrąglony kafelek ikony `44×44` z neonowym `boxShadow: 0 0 22px`, pigułkowy badge `THEME.radii.pill` (`9999px`), świecącą kropkę statusu (`0 0 24px`) i brak optycznego przeostrzenia (*rack focus*) między węzłami.
   - `FlowCurve` i `DataFlowEdge` rysują rozmyte wielokółkowe kulki neonowe (`r={16}`, `r={12}`, komety z 5 kółek), `DataFlowEdge` zaszywa sztywny `viewBox="0 0 1920 1080"` i pigułkę `9999px`, a `CodePayloadToast` zaszywa kolory składni Tailwind (`#93C5FD`, `#6EE7B7`, `#FCD34D`).
2. **`isometric-3d`, szablon CLI i `Style Lab`:**
   - `IsometricStage3D` renderuje pojedynczy surowy cylinder z płaskim `gridHelper` i statycznym światłem `[7, 12, 8]`, ignorując `resolveStyleOptics(style)` (`lightAngleDeg`, `lightingRig`), nie posiadając strażnika czystej klatki `0` ani warstw podziałki architektonicznej.
   - `Stylized3DCharacter` zaszywa na sztywno biały połyskliwy plastik `#FFFFFF` na głowie i dłoniach, granatowe kończyny `#1E293B`/`#334155` oraz czarny bąbelkowy wizjer `#090D16` niezależnie od stylu filmu, bez uziemienia `ContactShadowDisc3D` pod stopami.
   - Szablon `new-production.ts` (`case 'isometric-3d'`) używa statycznej kamery `<ThreeCanvas>` bez `DirectorCamera3D` oraz niedozwolonej częstotliwości `Math.sin(frame * 0.16)` (powyżej limitu `0.03..0.055 rad/kl.`), natomiast `Isometric3DPreview` w `StyleLabShowcase.tsx` animuje płaskie kółka pionowym podskakiwaniem `Math.sin(frame * 0.22)`.

### Decyzja architektoniczna Fali 3 (Podejście 1)
- **Zero zmian w `StylePresetSchema` i plikach `styles/*.style.json`:** istniejące pola `optics` (`lightAngleDeg`, `aperture`, `halation`, `lightingRig`, `typographyGrammar`) oraz `surface` i `palette` sterują obiema warstwami (2D i 3D).
- **Wspólna higiena kamery 2D + lekki kontekst skupienia `<MotionDiagramStage2D />`:** modernizujemy `DirectorCamera2D` i `CameraRig` z pełną kompatybilnością wsteczną i dodajemy kontekst optycznego *rack focusu* dla `SystemNode` i `WorldBox` oparty o `computeDepthPlaneBlur` z `@make-pictures/core`.
- **Czysty resolver materiałowo-świetlny 3D (`isometricMaterials.ts`):** deterministyczne funkcje bez zależności od kontekstu WebGL wyliczają tokeny materiałów (`ceramic-maquette`, `anodized-telemetry`, `ink-figurine`) i trójwymiarowy rig świateł z `StylePreset`, zapewniając `100%` testowalności w `node:test` i brak importu `three` w `@make-pictures/studio`.

---

## 2. Kamera 2D oraz Przebudowa `@make-pictures/kits/motion-diagrams-2d`

Wszystkie dotychczasowe eksporty w `@make-pictures/core` (`DirectorCamera2D`, `DirectorCamera2DProps`, `evaluateDirectorCamera2D`, `resolveShotsToKeyframes2D`) oraz w `@make-pictures/kits/motion-diagrams-2d` (`CameraRig`, `CameraRigProps`, `CameraKeyframe`, `evaluateCameraState`, `NodeBox`, `portTop`, `portBottom`, `portLeft`, `portRight`, `WorldBox`, `WorldBoxProps`, `FlowCurve`, `FlowCurveProps`, `SystemNode`, `SystemNodeProps`, `DataFlowEdge`, `DataFlowEdgeProps`, `Point2D`, `evaluateCubicBezier`, `CodePayloadToast`, `CodePayloadToastProps`) zostają w `100%` zachowane. Dodajemy eksport `MotionDiagramStage2D`, `MotionDiagramStage2DProps`, `MotionDiagramFocusState`, `useMotionDiagramFocus` oraz `resolvePayloadTokenColors`.

### 2.1. Oczyszczenie `DirectorCamera2D` (`@make-pictures/core`) i `CameraRig` (`motion-diagrams-2d`)

- **Niezmiennik czystej klatki `0` (`frame <= 0`):** oba komponenty zwracają wyłącznie jednolite tło `<AbsoluteFill style={{ backgroundColor: resolvedBgCanvas }} />` (lub `null`, gdy w `DirectorCamera2D` przekazano `renderBaseFill={false}`). Żadna siatka, światło ani dziecko nie renderuje się w klatce `0`.
- **Dziedziczenie palety stylu:** prop `variant?: 'light' | 'dark'` staje się prawdziwie opcjonalny (`undefined` domyślnie). Gdy `variant` nie jest przekazany, kolor płótna (`palette.bgCanvas`), polaryzacja (`surface.isDark`), linie siatki (`palette.inkBorder`) oraz punkty kalibracyjne (`palette.accentPrimary`) pochodzą z `useStudioStyle()`. Jawne przekazanie `variant="dark"` lub `variant="light"` nadal wymusza odpowiednią polaryzację tonalną (bez powrotu do cyjanowo-fioletowych blobów).
- **Światło zamiast blobów:** w `DirectorCamera2D` (gdy `renderLighting !== false`, domyślnie `true`) oraz w `CameraRig` miejsce usuniętych gradientów `rgba(0, 240, 255, ...)` zajmuje kierunkowy `<StageLightingRig renderBaseFill={false} />` z `@make-pictures/core`, zsynchronizowany z `style.optics`. Bezklipowa matematyka przesuwu siatki `gridOffsetX / gridOffsetY` pozostaje bez zmian.

### 2.2. Kontener sceniczny `<MotionDiagramStage2D />` (`MotionDiagramStage2D.tsx`)

```ts
export type MotionDiagramFocusState = 'auto' | 'sharp' | 'recessed';

export interface MotionDiagramStage2DProps extends Omit<DirectorCamera2DProps, 'children'> {
  /** Jawna lista ID węzłów w pełnej ostrości (gdy pominięta, dziedziczy cele aktywnego ujęcia `shots`) */
  focusedNodeIds?: ReadonlyArray<string>;
  /** Sygnatura arkusza schematu przypięta do kadru (wewnątrz 9:16 Safe Box) */
  diagramCode?: string;
  renderBaseFill?: boolean;
  renderLighting?: boolean;
  children: React.ReactNode;
}
```

- **Automatyczny i jawny *rack focus*:** `<MotionDiagramStage2D />` udostępnia kontekst `MotionDiagramFocusContext` z listą aktywnych identyfikatorów węzłów:
  1. jeśli przekazano `focusedNodeIds`, używa tego zbioru,
  2. w przeciwnym razie, jeśli przekazano `shots`, wyznacza aktywne ujęcie z `evaluateDirectorCamera2D` (`activeShotIndex`) i pobiera `shots[activeShotIndex].target` (jako jedno ID lub tablicę ID),
  3. gdy żaden zbiór nie jest zdefiniowany, wszystkie węzły pozostają w stanie `'sharp'`.
- **Metryczka `diagramCode`:** gdy podano `diagramCode` i `frame >= 2`, renderuje w przypiętej warstwie kadru dyskretną belkę indeksową w `monoFont` w bezpiecznych współrzędnych (`16:9`: `left: 64, top: 44`; `9:16`: `left: 76, top: 236`, ściśle wewnątrz `x ∈ [40, 910], y ∈ [220, 1380]`).

### 2.3. `WorldBox` i `FlowCurve` (`NodeBox.tsx`)

- **`WorldBox`:**
  - Zachowuje bez zmian `NodeBox` oraz funkcje portów `portRight`, `portLeft`, `portTop`, `portBottom`.
  - Rozszerza `WorldBoxProps` o `nodeId?: string`, `focusState?: MotionDiagramFocusState` (domyślnie `'auto'`) oraz `elevation?: TactileElevation` (domyślnie `'resting'`).
  - Dla domyślnego wariantu karty (`variant === undefined || variant === 'card'`) stosuje cień kierunkowy z `getTactileSurfaceStyle(studioStyle, { elevation })`, przy czym dla `surface.cardTreatment === 'brutalist-hard'` w stanie `'resting'` zachowuje dokładny cień `6px 6px 0px ${palette.inkBorder}`, `border-radius: 0` i font `bodyFont`, gwarantując pełną zgodność z testem `kits-style-integration.test.ts`.
  - Gdy wyliczony stan skupienia to `'recessed'`, płynnie przechodzi sprężyną `getStyleSpringConfig(studioStyle, 'camera')` do `z = -0.28`, nakładając `computeDepthPlaneBlur(-0.28, optics)` (ze strefą martwą `< 0.25px -> filter: 'none'`) oraz subtelne wygaszenie kontrastu (`opacity * 0.68`, `scale * 0.98`). Dla `'sharp'` gwarantuje `filter: 'none'`.
- **`FlowCurve`:**
  - Strażnik czystej klatki `0`: `const effectiveStart = Math.max(2, activeFromFrame); if (frame < effectiveStart) return null;`.
  - Usuwa rozmyte halo `strokeWidth + 6` i podwójne kulki `r={12}` na rzecz precyzyjnej szyny sygnałowej oraz kierunkowego wektora sygnału obracanego stycznie do krzywej Béziera (`atan2(dy, dx)` z pochodnej krzywej `evalBezierTangent(t)`), dopasowanego do `resolveStyleOptics(studioStyle).typographyGrammar`:
    - `swiss-spatial`: kwadratowy styk źródłowy `8×8`, kołowy styk docelowy `r=4.5` oraz ostry wektorowy grot kierunkowy (`polygon`),
    - `optical-gate`: pierścienie celownicze na portach oraz prostokątny impuls szczelinowy ze świetlnym rdzeniem,
    - `risograph-poster`: pełne kostki styków i kontrastowy trójkątny stempel sygnału z obrysem `inkBorder`.

### 2.4. `SystemNode`, `DataFlowEdge`, `CodePayloadToast` oraz `ScreenSpotlightOverlay`

- **`SystemNode` (`SystemNode.tsx`):**
  - Naprawia domyślny start: `enterFrame = 2` oraz `const effectiveEnter = Math.max(2, enterFrame); if (frame < effectiveEnter) return null;`.
  - Zachowuje istniejące `id: string` i wykorzystuje `nodeId ?? id` do automatycznego odczytu stanu z `MotionDiagramFocusContext`, czyni `icon?: LucideIcon` opcjonalnym (gdy pominięto `icon`, renderuje deterministyczny geometryczny glif modułu SVG) oraz dodaje opcjonalne `nodeId?: string`, `focusState?: MotionDiagramFocusState` (domyślnie `'auto'`) i `moduleCode?: string`.
  - Usuwa kafelek ikony `44×44` (`${resolvedAccent}28`), pigułkę `THEME.radii.pill`, górny `radial-gradient` i świecącą kropkę statusu (`0 0 24px`). Zastępuje je architektoniczną głowicą modułu: górną/boczną belką akcentu, prostokątną tabliczką `badge` / `moduleCode` w `monoFont`, grawerowaną ramką wektorową `36×36` na ikonę (lub geometryczny glif modułu), fizycznymi stykami portów na lewej i prawej krawędzi oraz taktylną powierzchnią `getTactileSurfaceStyle(studioStyle, { elevation: active ? 'lifted' : 'resting' })` (z zachowaniem twardego cienia `brutalist-hard`). Obsługuje optyczny *rack focus* identycznie jak `WorldBox` (`filter: 'none'` w ostrości, `computeDepthPlaneBlur(-0.28, optics)` w wycofaniu).
- **`DataFlowEdge` (`DataFlowEdge.tsx`):**
  - Strażnik czystej klatki `0`: `drawStartFrame = 2` oraz `const effectiveDrawStart = Math.max(2, drawStartFrame); if (frame < effectiveDrawStart) return null;` (zachowując wyeksportowaną funkcję `evaluateCubicBezier` i typ `Point2D`).
  - Usuwa sztywny `viewBox="0 0 1920 1080"` na rzecz bezwymiarowego kontenera SVG (`width: 1, height: 1, overflow: 'visible'`) działającego w dowolnych współrzędnych świata 2D.
  - Zastępuje 5-kółkowe neonowe komety stycznymi wektorami kierunkowymi (spójnymi z `FlowCurve`), a kapsułkową pigułkę `label` (`9999px`) zastępuje prostokątną tabliczką protokołu w `monoFont` z obrysem `inkBorder` / `resolvedColor`.
- **`CodePayloadToast` (`CodePayloadToast.tsx`):**
  - Strażnik czystej klatki `0`: `const effectiveStart = Math.max(2, startFrame); if (frame < effectiveStart || frame > endFrame + 24) return null;`.
  - Czysta funkcja `resolvePayloadTokenColors(style)` zastępuje zahardkodowane kolory Tailwind (`#93C5FD`, `#1D4ED8`, `#6EE7B7`, `#059669`, `#FCD34D`, `#B45309`) spójnymi tokenami z `style.palette` (`keyColor: accentPrimary`, `stringColor: accentSecondary`, `numberColor: textPrimary`, `punctColor: textSecondary`).
  - Karta otrzymuje fizyczną oprawę `getTactileSurfaceStyle(studioStyle, { elevation: 'floating' })` z kalibrowanym paskiem tytułowym w `monoFont` i numeracją wierszy `tabular-nums`.
- **`ScreenSpotlightOverlay` (`product-frames/ScreenSpotlightOverlay.tsx`):**
  - Etykieta `label` rezygnuje z `borderRadius: 9999` na rzecz `Math.max(0, Math.round(6 * studioStyle.surface.radiusScale))` oraz obrysu `1px solid ${studioStyle.palette.inkBorder}`, eliminując ostatnią pigułkę w warstwie produktowej powiązanej z `motion-diagrams-2d`.

---

## 3. Przebudowa `@make-pictures/kits/isometric-3d`

Wszystkie dotychczasowe eksporty (`IsometricStage3D`, `IsometricStage3DProps`, `Stylized3DCharacter`, `Stylized3DCharacterProps`, `CharacterGestureWeights` oraz oznaczony `@deprecated` `IsometricStudioEnvironment`) zostają w `100%` zachowane w `packages/kits/src/isometric-3d/index.ts` oraz `packages/kits/src/index.ts`. Dodajemy czysty moduł `isometricMaterials.ts` eksportujący `IsometricMaterialPreset`, `IsometricMaterialTokens`, `IsometricLightRigSpec`, `resolveIsometricMaterialPreset`, `resolveIsometricMaterialTokens` oraz `computeIsometricLightRig`.

### 3.1. Czyste Resolvery Materiałów i Świateł 3D (`isometricMaterials.ts`)

Moduł nie importuje `three` ani `@react-three/fiber` w czasie wykonania — operuje wyłącznie na `StylePreset` z `@make-pictures/core`:

```ts
export type IsometricMaterialPreset =
  | 'ceramic-maquette'
  | 'anodized-telemetry'
  | 'ink-figurine';

export interface IsometricMaterialTokens {
  preset: IsometricMaterialPreset;
  headColor: string;
  torsoColorFallback: string;
  limbColor: string;
  jointColor: string;
  shoeColor: string;
  visorColor: string;
  collarColor: string;
  roughness: number;
  metalness: number;
  limbRoughness: number;
  limbMetalness: number;
  visorStyle: 'sculpted-band' | 'slit-visor' | 'ink-mask';
  outlineRingOpacity: number;
}

export interface IsometricLightRigSpec {
  ambientIntensity: number;
  keyPosition: [number, number, number];
  keyIntensity: number;
  keyColor: string;
  rimPosition: [number, number, number];
  rimIntensity: number;
  rimColor: string;
  fillPosition: [number, number, number];
  fillIntensity: number;
  contactShadowOpacity: number;
  contactShadowColor: string;
  enableBeamsByDefault: boolean;
  beamOrigin: [number, number, number];
  beamColor: string;
  beamOpacity: number;
}
```

- **Mapowanie `resolveIsometricMaterialPreset(style, override?)`:**
  1. `override` jeśli przekazano jawnie,
  2. `'ink-figurine'` gdy `style.surface.cardTreatment === 'brutalist-hard'` lub `style.id === 'sketch-notebook'` lub `style.id === 'tactile-craft'`,
  3. `'anodized-telemetry'` gdy `style.surface.isDark` lub `resolveStyleOptics(style).lightingRig === 'darkroom-halation'`,
  4. `'ceramic-maquette'` dla pozostałych jasnych stylów redakcyjnych i produktowych (`minimal-product`, `editorial-press`, `archival-chronicle`).
- **Parametry fizyczne materiałów (`resolveIsometricMaterialTokens`):**
  - `ceramic-maquette`: matowa ceramika architektoniczna (`roughness: 0.78, metalness: 0.04`), głowa w tonie `palette.bgElevated`, kończyny z ciepłego grafitu/kamienia `palette.textSecondary`, kołnierz `palette.inkBorder`, subtelna rzeźbiarska opaska `visorStyle: 'sculpted-band'`.
  - `anodized-telemetry`: szczotkowany ciemny stop (`roughness: 0.34, metalness: 0.32`), głowa `palette.bgElevated`, kończyny `palette.bgSurface`, precyzyjny wizjer szczelinowy `visorStyle: 'slit-visor'` z akcentem halacji.
  - `ink-figurine`: głęboki mat gwaszu i kartonu (`roughness: 0.92, metalness: 0.02`), głowa `palette.bgSurface`, kończyny i buty `palette.textPrimary`, kontrastowa opaska tuszu `visorStyle: 'ink-mask'` z pierścieniem podstawy o wysokim kontraście.
- **Geometria światła (`computeIsometricLightRig(style)`):**
  - Konwertuje `optics.lightAngleDeg` (`[-60, +60]`) na azymut w przestrzeni 3D (`rad = lightAngleDeg * Math.PI / 180`):
    - `keyPosition = [Math.sin(rad) * 9.2, 11.4, Math.cos(rad) * 8.4]` (ciepła barwa `#FFF7ED` dla `window-gobo`, chłodna `#E0F2FE` dla `darkroom-halation`, neutralna `#FFFFFF` dla `studio-macro` / `flat-press`),
    - `rimPosition = [-Math.sin(rad) * 6.8, 5.2, -Math.cos(rad) * 6.2]` w kolorze `palette.accentSecondary` (separacja sylwetki od tła),
    - `beamOrigin` zsynchronizowany z kierunkiem `keyPosition`; `enableBeamsByDefault` aktywne dla `window-gobo` oraz `darkroom-halation`, wyłączone dla `flat-press` i `studio-macro`.

### 3.2. `IsometricStage3D` — Dwustopniowy Cokół Architektoniczny ze Światłem Reżyserskim

- **Strażnik czystej klatki `0`:** odczytuje `const frame = useCurrentFrame(); if (frame <= 0) return null;`.
- **Rozszerzone propsy (`IsometricStage3DProps`):** zachowuje `radius = 5.4`, `showGrid = true`, `accentColor?`, `surfaceColor?`, `children?` oraz dodaje opcjonalne `atmosphericBeams?: boolean` i `seed?: number`.
- **Architektura cokołu bez Z-fightingu:**
  - Dolny cokół nośny (`y = -0.24`, wysokość `0.28`, promień `radius * 1.05`) w kolorze `palette.bgElevated` oraz górna tarcza sceny (`y = -0.06`, wysokość `0.12`, promień `radius`) w kolorze `resolvedSurface` (`receiveShadow`).
  - Rozseparowane w osi `Y` pierścienie i znaczniki kalibracyjne: zewnętrzny pierścień akcentu (`y = 0.004`), wewnętrzny pierścień podziałki (`y = 0.006`), `24` promieniste nacięcia kątowe co `15°` (`y = 0.009`, co `90°` dłuższe nacięcia kardynalne) oraz opcjonalny subtelny `gridHelper` (`y = 0.002`).
  - Światła (`ambientLight`, `directionalLight` z `castShadow`, `pointLight` kontry i wypełnienia) zasilane bezpośrednio z `computeIsometricLightRig(style)`, plus warunkowy `<StagePostProcessing3D />` z pakietu `kits/vfx` (`fogDensity: 0`, subtelne snopy `spotlightBeams={2}` z `beamOrigin`).

### 3.3. `Stylized3DCharacter` — Polimorficzna Makieta Postaci z Uziemieniem Optycznym

- **Strażnik czystej klatki `0`:** `if (frame <= 0) return null;` oraz `const effectiveEnter = Math.max(2, enterFrame);`.
- **Rozszerzone propsy (`Stylized3DCharacterProps`):** zachowuje wszystkie dotychczasowe pola (`position`, `rotationY`, `primaryColor`, `accentColor`, `speechEnergy`, `speakingWeight`, `gestureWeights`, `enterFrame = 2`, `headYawOffset = 0`) i dodaje opcjonalne `materialPreset?: IsometricMaterialPreset`.
- **Materiały i anatomia głowy/wizjera:**
  - Wszystkie zahardkodowane kolory (`#FFFFFF`, `#F8FAFC`, `#1E293B`, `#334155`, `#E2E8F0`, `#090D16`) zostają zastąpione tokenami z `resolveIsometricMaterialTokens(style, materialPreset)`.
  - Zamiast jednolitego czarnego bąbla wizjera `#090D16` i kapsułkowych oczu zabawki:
    - w `ceramic-maquette` (`sculpted-band`): matowa rzeźbiarska głowa z wklęsłą opaską czołową w kolorze kołnierza, subtelnymi punktami skupienia oraz pojedynczą wyważoną szczeliną akustyczną modulowaną przez `speechEnergy`,
    - w `anodized-telemetry` (`slit-visor`): precyzyjny ciemny pas optyczny z poziomą soczewką telemetryczną i trzema słupkami korektora mowy,
    - w `ink-figurine` (`ink-mask`): graficzna płaszczyzna czołowa z kontrastowym obrysem `inkBorder`, kołnierzem u nasady szyi i geometrycznym wskaźnikiem artykulacji.
- **Uziemienie i skupienie uwagi:**
  - Pod stopami montowany jest `<ContactShadowDisc3D position={[0, 0.012, 0]} radius={0.62} opacity={lightRig.contactShadowOpacity} color={lightRig.contactShadowColor} />` (`polygonOffset`, `depthWrite={false}` — zero Z-fightingu), a koncentryczny pierścień mówcy spoczywa wyżej na `y = 0.018`.
  - Aktywny mówca (`speakingWeight -> 1`) zyskuje pełne nasycenie pierścienia i delikatne pochylenie zaangażowania, podczas gdy słuchacz (`speakingWeight -> 0`) naturalnie wycisza emisję świetlną pierścienia i szczeliny ust, oddając prowadzenie kadru.
- **Niezmienniki ruchu (`kit-isometric-3d`):** wszystkie częstotliwości oscylacji (`0.036..0.055 rad/kl.`), brak pionowego podskakiwania tułowia oraz rozdział `speakingWeight` od `speechEnergy` pozostają nienaruszone.

---

## 4. Integracja ze `Style Lab`, Szablonami CLI i Skillami

1. **Podglądy `60 FPS` w `Style Lab` (`packages/studio/src/client/components/StyleLabShowcase.tsx`):**
   - `@make-pictures/studio` nadal nie importuje `three` ani `@make-pictures/kits` (zachowanie czystości bundla klienta).
   - Flaga `usesOpticalStage` w `StyleLabPreviewComposition` zostaje rozszerzona o `'motion-diagrams-2d'` oraz `'isometric-3d'` — wszystkie 6 nie-dioramowych kitów korzysta teraz z żywego `<StageLightingRig />`.
   - `MotionDiagrams2DPreview`: przepisany na wieloplanowy `<OpticalStage2D />` + `<DepthPlane />` z kreślarską siatką tła (`z = -0.56`), trzema kalibrowanymi modułami ze stykami portów i stycznym wektorem sygnału na `z = 0` (z cyklicznym *rack focusem* przeostrzającym aktywny moduł) oraz taktylną tabliczką kodu na `z = +0.28` — bezpiecznie wewnątrz `9:16 Safe Box`.
   - `Isometric3DPreview`: całkowite usunięcie `Math.sin(frame * 0.22)` i pionowego podskakiwania kafelków. Zastąpiony wieloplanowym podglądem 2.5D/SVG cokołu architektonicznego z podziałką kątową, kierunkowym snopem światła z `optics.lightAngleDeg`, miękkimi cieniami stykowymi oraz dwiema sylwetkami makiety oddającymi wykończenie (`ceramic-maquette` / `anodized-telemetry` / `ink-figurine`), spokojny oddech `0.038..0.048 rad/kl.` i optyczne przeostrzenie między mówiącym a słuchaczem.
2. **Szablony CLI (`packages/cli/src/commands/new-production.ts`):**
   - `case 'motion-diagrams-2d'`: owija scenę w `<MotionDiagramStage2D renderBaseFill={false}>` z dwoma ujęciami (`fromFrame: 0` na `['source', 'target']` oraz `fromFrame: 320` najazd `'glide'` na `'target'`, automatycznie uruchamiający optyczny *rack focus* na węźle docelowym), używając `<SystemNode nodeId="source" />`, `<SystemNode nodeId="target" />`, `<FlowCurve />` oraz `<CodePayloadToast />` w bezpiecznych granicach `16:9` i `9:16 Safe Box`.
   - `case 'isometric-3d'`:
     - usuwa niedozwolone `Math.sin(frame * 0.16)`, zastępując je wieloskładową, łagodną obwiednią sylabową w dozwolonym paśmie częstotliwości (`0.038` i `0.052 rad/kl.`),
     - dodaje pełną choreografię `<DirectorCamera3D />` z dwoma ujęciami dopasowanymi osobno do `16:9` i `9:16` (`isVertical`): plan dwójkowy otwarcia (`fromFrame: 0`) oraz płynny półzbliżeniowy najazd (`fromFrame: 320`, `transition: 'glide'`) na drugiego rozmówcę,
     - dodaje dyskretną, taktylną tabliczkę tytułową rozmowy (`props.badgeLabel`, `props.headline`, `props.subheadline`) osadzoną ściśle wewnątrz `9:16 Golden Safe Box` (`left: 76, width: 788, top: 256` w `9:16`), tak aby propsy z `Studio Web` były widoczne na ekranie.
   - Oba szablony zachowują `<StyleProvider style={props.styleId} renderBackdrop>`, `<VoiceoverTrack />`, `<SoundCue />` i `<SmartMusicBed />`.
3. **Skille (`plugins/make-pictures/skills/` + `npm run sync:skills`):**
   - Aktualizacja kanonicznych skilli `kit-motion-diagrams-2d/SKILL.md`, `kit-isometric-3d/SKILL.md` oraz wzmianki o `DirectorCamera2D` w `cinematography-and-vfx/SKILL.md` w katalogu źródłowym `plugins/make-pictures/skills/` (podlinkowanym przez `.agents/plugins/make-pictures`), a następnie pełna synchronizacja do `skills/*` przez `npm run sync:skills`.

---

## 5. Niezmienniki Determinizmu i Plan Weryfikacji

### 5.1. Twarde niezmienniki
1. **Czysta klatka `0` (`frame <= 0`):** `DirectorCamera2D`, `CameraRig`, `MotionDiagramStage2D`, wszystkie komponenty `motion-diagrams-2d`, `IsometricStage3D`, `Stylized3DCharacter` oraz szablony CLI renderują w klatce `0` wyłącznie czyste `palette.bgCanvas` (lub `null` wewnątrz sceny).
2. **Determinizm `--concurrency=100%`:** zero `Math.random()`, zero akumulacji stanu w `useRef` między klatkami.
3. **Ostrość wektorowa i `9:16 Golden Safe Box`:** martwa strefa `< 0.25px -> filter: 'none'` dla wszystkich aktywnych węzłów i tekstów; w `1080×1920` wszystkie karty, metryczki i sylwetki rozmówców mieszczą się w `x ∈ [40, 910], y ∈ [220, 1380]` (z marginesem bezpieczeństwa `x ∈ [76, 864]` na ruch kamery).
4. **Fizyka postaci 3D i czystość bundla:** oscylacje `isometric-3d` ściśle w paśmie `0.03..0.055 rad/kl.`, zero pionowego podskakiwania, zero importów `three` w `@make-pictures/core` i `@make-pictures/studio`.

### 5.2. Plan testów i bramek QA
1. **Testy jednostkowe i integracyjne (`packages/cli/tests/`):**
   - Zachowanie istniejących testów w `kits-style-integration.test.ts` (w tym `WorldBox` `6px 6px 0px` dla `brutalist-poster` oraz `1.5px solid` dla `editorial-press`, eksport `IsometricStudioEnvironment` `@deprecated`).
   - Nowy kompleksowy plik testowy `packages/cli/tests/wave3-optical-kits.test.ts`:
     - czysta klatka `0` i brak `rgba(0, 240, 255` / `rgba(165, 180, 252` w `DirectorCamera2D` i `CameraRig`,
     - optyczny *rack focus* w `MotionDiagramStage2D` + `SystemNode` / `WorldBox` (aktywny węzeł `filter:none`, wycofany `filter:blur(...)`, martwa strefa `aperture: 0 -> filter:none`),
     - brak `9999`, `Math.random(`, `useRef` i kolorów Tailwind `#93C5FD|#6EE7B7|#FCD34D` w `motion-diagrams-2d` oraz brak `borderRadius: 9999` w `ScreenSpotlightOverlay`,
     - testy czystych funkcji `resolveIsometricMaterialPreset`, `resolveIsometricMaterialTokens` i `computeIsometricLightRig` dla wszystkich `7` `BUILT_IN_STYLE_IDS` (weryfikacja 3 rodzin materiałów, reakcji `keyPosition` i `rimPosition` na zmianę znaku `lightAngleDeg`, wyłączania snopów na `flat-press`),
     - statyczne sprawdzenie `IsometricStage3D.tsx`, `Stylized3DCharacter.tsx`, `StyleLabShowcase.tsx` i `new-production.ts` (brak `#FFFFFF` plastiku w `Stylized3DCharacter`, brak `frame * 0.16` i `frame * 0.22`, obecność `ContactShadowDisc3D` oraz `DirectorCamera3D` w szablonie `isometric-3d`, brak importu `three` w `packages/studio`).
2. **Budowanie, typy i paczki:** `npm run sync:skills && npm run build:packages && npm run typecheck && npm test && npm run pack:verify`.
3. **Wizualne Contact-Sheet QA (`16:9` oraz `9:16`):**
   - Wygenerowanie tymczasowych kapsuł QA dla `motion-diagrams-2d` (`16:9` + `9:16`) oraz `isometric-3d` (`16:9` + `9:16`, renderowanych z obsługą WebGL `--gl=angle`), wykonanie `npx make-pictures qa`, wizualna inspekcja arkuszy `out/qa-*.png` przez `read_file` (`f=0` puste tło, `latin-ext`, *rack focus*, materiały 3D, `ContactShadowDisc3D`, brak Z-fightingu, `9:16 Safe Box`) i usunięcie kapsuł tymczasowych po archiwizacji arkuszy w `scratch/`.
