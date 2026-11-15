# Specyfikacja Projektowa: Autorskie Media Plastyczne i Silnik Optyczny — Fala 1 (`OpticalStage2D`, `editorial-collage`, `kinetic-typography`)

**Data:** 2026-11-15  
**Pakiety docelowe:** `@make-pictures/core`, `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`, `plugins/make-pictures` (`+ skills/`)  
**Status:** Oczekuje na przegląd pisemnej specyfikacji przez użytkownika  

---

## 1. Kontekst, Diagnoza Problemu i Mapa Drogowa 3 Fal

Obecnie spośród 7 kitów scenicznych w `make.pictures` jedynie `paper-diorama-3d` posiada pełną fizyczność materiału (20-krotna dylatacja wycinanki, krawędź kartonu `#573B26`, włókna papieru, cienie sylwetkowe `MeshDepthMaterial`, zawiasy `PopUpHinge3D` oraz oświetlenie `ACESFilmicToneMapping`). Pozostałe kity wykazują cechy typowe dla generycznych interfejsów „AI-slop”:

1. **Estetyka pudełek SaaS zamiast medium plastycznego:** Zaokrąglone karty CSS z *pill-badge'ami*, gradientowymi kafelkami na ikony Lucide (`<Sparkles />`), paskami ładowania `5px` i jednolitym wjazdem `translateY(24px)`.
2. **Brak kamery i paralaksy w większości scen:** Szablony w `new-production.ts` oraz `StyleLabShowcase.tsx` dla `editorial-collage`, `vector-scene-2d`, `kinetic-typography` i `data-storytelling` osadzają elementy w zablokowanym `AbsoluteFill` bez pracy kamery, a `DirectorCamera2D` operuje wyłącznie na jednej płaskiej warstwie `z = 0`.
3. **Martwa telemetria ostrości (`focusDistance`):** `DirectorCamera3D` i `DirectorCamera2D` publikują co klatkę `focusDistance` i `velocity`, ale żaden komponent sceniczny nie wylicza głębi ostrości (Circle of Confusion / *rack focus*), przez co przedplan, bohater i tło są cyfrowo ostre w tym samym stopniu.
4. **Płaskie światło:** `StyleBackdrop` rysuje statyczne gradienty CSS pozbawione spójnego kąta padania światła, cieni stykowych/rzucanych, cieni *gobo* (okno/żaluzje), halacji kliszy czy przesuwającego się refleksu (*specular*).

### Podział przedsięwzięcia na 3 fale (osobne cykle Specyfikacja → Plan → Wdrożenie)

- **Fala 1 (niniejsza specyfikacja):**
  1. Wspólny **Silnik Optyczny 2.5D** w `@make-pictures/core` (`OpticalStage2D`, `<DepthPlane z={...} />`, `<StageLightingRig />`, `getTactileSurfaceStyle`) oraz rozszerzenie `StylePresetSchema` o sekcję `optics` (3 reżimy oświetlenia × 3 gramatyki typografii).
  2. Przebudowa kitu **`editorial-collage`** w wieloplanowy *Analogowy Stół Redakcyjny / Lightbox*.
  3. Przebudowa kitu **`kinetic-typography`** w polimorficzną *Typografię Filmową* (bez pigułek karaoke, `<Sparkles />` i pasków ładowania).
  4. Integracja ze `Style Lab`, generatorami `make-pictures new` oraz synchronizacja skilli.
- **Fala 2 (kolejna specyfikacja):** Przebudowa `vector-scene-2d` (warstwowa ilustracja plakatowo-risograficzna) oraz `data-storytelling` (redakcyjna kartografia danych i fizyczne wykresy) na bazie `OpticalStage2D`.
- **Fala 3 (ostatnia specyfikacja):** Przebudowa `motion-diagrams-2d` (podświetlany stół kreślarski / oscyloskop z głębią ostrości) oraz `isometric-3d` (filmowa makieta studyjna *clay/porcelain* w `<ThreeCanvas>` z ACES, miękkimi cieniami PCF i 3D DoF) wraz z domknięciem pozostałych szablonów CLI.

---

## 2. Kontrakt `StylePreset.optics` (`@make-pictures/core/style`)

### 2.1. Rozszerzenie schematu `packages/core/src/style/schema.ts`

Dodajemy typy i schemat `StyleOpticsSchema` z opisami `.describe('Optyka & Światło :: ...')`, automatycznie rozpoznawanymi przez `introspectZodObject` w `Studio Web`:

```ts
export const StyleLightingRigSchema = z.enum([
  'window-gobo',
  'darkroom-halation',
  'studio-macro',
]);
export type StyleLightingRig = z.infer<typeof StyleLightingRigSchema>;

export const StyleTypographyGrammarSchema = z.enum([
  'swiss-spatial',
  'optical-gate',
  'risograph-poster',
]);
export type StyleTypographyGrammar = z.infer<typeof StyleTypographyGrammarSchema>;

export const StyleOpticsSchema = z.object({
  lightingRig: StyleLightingRigSchema.describe(
    'Optyka & Światło :: Reżim oświetlenia sceny'
  ),
  typographyGrammar: StyleTypographyGrammarSchema.describe(
    'Optyka & Światło :: Gramatyka typografii kinetycznej'
  ),
  lightAngleDeg: z
    .number()
    .min(-60)
    .max(60)
    .describe('Optyka & Światło :: Kąt głównego światła (°)'),
  aperture: z
    .number()
    .min(0)
    .max(1)
    .describe('Optyka & Światło :: Przysłona / płytkość ostrości (0–1)'),
  halation: z
    .number()
    .min(0)
    .max(1)
    .describe('Optyka & Światło :: Halacja i rozproszenie świateł (0–1)'),
});
export type StyleOptics = z.infer<typeof StyleOpticsSchema>;
```

### 2.2. Bezpieczna migracja istniejących plików `styles/*.style.json`

Aby 100% istniejących plików `styles/*.style.json` (nieposiadających klucza `optics`) przechodziło walidację `StylePresetSchema.parse(...)` bez błędów i otrzymywało profil optyczny spójny z ich powierzchnią (a nie jeden sztywny fallback), dodajemy czystą funkcję `deriveDefaultOpticsForSurface(surface)`:

- Gdy `surface.isDark === true` → `{ lightingRig: 'darkroom-halation', typographyGrammar: 'optical-gate', lightAngleDeg: -24, aperture: 0.48, halation: 0.52 }`.
- Gdy `surface.backdropType === 'halftone-dots'` lub `surface.cardTreatment === 'brutalist-hard'` lub `surface.cardTreatment === 'tactile-cutout'` → `{ lightingRig: 'window-gobo', typographyGrammar: 'risograph-poster', lightAngleDeg: -32, aperture: 0.38, halation: 0.16 }`.
- Gdy `surface.backdropType === 'editorial-paper'` lub `surface.cardTreatment === 'editorial-ink'` → `{ lightingRig: 'window-gobo', typographyGrammar: 'swiss-spatial', lightAngleDeg: -28, aperture: 0.46, halation: 0.18 }`.
- W pozostałych przypadkach (`solid`, `minimal-clean`) → `{ lightingRig: 'studio-macro', typographyGrammar: 'swiss-spatial', lightAngleDeg: -22, aperture: 0.36, halation: 0.08 }`.

W `StylePresetSchema` (będącym czystym `z.object`, aby zachować statyczną zgodność z `AnyZodObject` w `introspectZodObject`) pole `optics: StyleOpticsSchema.optional()` jest opcjonalne dla pełnej kompatybilności wstecznej z literałami TypeScript oraz istniejącymi plikami `styles/*.style.json`. Wszystkie miejsca odczytujące optykę w silniku i kitach korzystają z jawnej funkcji `resolveStyleOptics(style: StylePreset): StyleOptics` (`return style.optics ?? deriveDefaultOpticsForSurface(style.surface)`), a funkcje ładujące/rejestrujące style (`resolveStudioStyle`, `registerCustomStyles`, `loadWorkspaceCustomStyles`) automatycznie uzupełniają brakujące `optics` wartością z `deriveDefaultOpticsForSurface(style.surface)`. Dzięki temu również suwaki w `Style Lab` od pierwszej klatki mają zainicjalizowane wartości `optics`.

### 2.3. Przypisanie `optics` w `BUILT_IN_STYLES` (`packages/core/src/style/presets.ts`)

| `BuiltInStyleId` | `lightingRig` | `typographyGrammar` | `lightAngleDeg` | `aperture` | `halation` |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `minimal-product` | `studio-macro` | `swiss-spatial` | `-20` | `0.36` | `0.08` |
| `editorial-press` | `window-gobo` | `swiss-spatial` | `-28` | `0.45` | `0.16` |
| `archival-chronicle` | `window-gobo` | `swiss-spatial` | `-34` | `0.54` | `0.26` |
| `cyber-telemetry` | `darkroom-halation` | `optical-gate` | `-24` | `0.50` | `0.58` |
| `brutalist-poster` | `darkroom-halation` | `risograph-poster` | `-38` | `0.32` | `0.28` |
| `sketch-notebook` | `window-gobo` | `risograph-poster` | `-26` | `0.38` | `0.12` |
| `tactile-craft` | `window-gobo` | `risograph-poster` | `-30` | `0.48` | `0.20` |

---

## 3. Wieloplanowy Silnik Optyczny (`packages/core/src/optics/`)

Nowy podmoduł `packages/core/src/optics/` jest eksportowany z `@make-pictures/core` (oraz re-eksportowany pomocniczo z `@make-pictures/kits/vfx`). Nie posiada zależności od `three` ani `@react-three/fiber`.

### 3.1. Rozszerzenie `DirectorCameraTelemetry` (`packages/core/src/camera/shotTypes.ts`)

```ts
export interface DirectorCameraTelemetry {
  velocity: number;
  focusDistance: number;
  activeShotIndex: number;
  activeShotLabel?: string;
  /** Aktywna płaszczyzna ostrości Z w przestrzeni 2.5D (domyślnie 0) */
  focalZ?: number;
  /** Aktywna przysłona [0..1] sterująca promieniem rozmycia poza focalZ */
  aperture?: number;
}
```

`publishFrameCameraTelemetry` uwzględnia zmiany `focalZ` i `aperture` (z tolerancją `1e-3`).

### 3.2. Matematyka `OpticalStage2D` i `DepthPlane` (`packages/core/src/optics/OpticalStage2D.tsx`)

1. **Deklaratywne ujęcia `OpticalShot2D`:**
   ```ts
   export interface OpticalShot2D {
     fromFrame: number;
     /** Cel z mapy nodes lub bezpośredni środek [x, y] */
     target?: string | string[];
     x?: number;
     y?: number;
     zoom?: number;
     rotateZ?: number;
     /** Docelowa płaszczyzna ostrości Z dla tego ujęcia (domyślnie 0) */
     focalZ?: number;
     /** Opcjonalne nadpisanie przysłony dla danego ujęcia */
     aperture?: number;
     transition?: 'cut' | 'glide' | 'whip';
     padding?: number;
     label?: string;
   }
   ```
2. **Deterministyczny solver `evaluateOpticalCamera2D(params)`:**
   - Rozwiązuje `(x, y, zoom, rotateZ)` z wykorzystaniem `evaluateDirectorCamera2D` (dziedzicząc pełną kompensację `9:16 Golden Safe Box` `x ∈ [40, 910], y ∈ [220, 1380]`, deterministyczny szum `cameraHandheld` z `style.motion.cameraHandheld` oraz impulsy wstrząsów).
   - Interpoluje `focalZ` oraz `aperture` pomiędzy kolejnymi ujęciami na sprężynie `getStyleSpringConfig(style, 'camera')` (lub skokowo dla `transition === 'cut'`), co daje płynny, fizyczny *rack focus* przy każdym ruchu kamery.
3. **Fizyka `<DepthPlane z={number}>` (`z ∈ [-2.0, +1.5]`):**
   - **Paralaksa (`computeParallaxFactor(z)`):**
     - `parallax = clamp(1 / (1 - z * 0.28), 0.52, 1.72)`.
     - Przesunięcie kamery względem środka kadru `(dx, dy)` jest mnożone przez `parallax`, a skala przez `1 + (zoom - 1) * parallax`, dzięki czemu przedplan (`z > 0`) przesuwa się wyraźnie szybciej niż tło (`z < 0`).
   - **Krążek rozproszenia (`computeCircleOfConfusionPx(z, focalZ, aperture)`):**
     - `rawBlur = Math.abs(z - focalZ) * clamp(aperture, 0, 1) * 14`.
     - **Strefa martwa ostrości:** jeżeli `rawBlur < 0.25`, zwracamy `0` i ustawiamy `filter: 'none'`. Gwarantuje to stuprocentową ostrość rastrowania fontów wektorowych na płaszczyźnie `z ≈ focalZ` w Chromium bez rozmycia podpikselowego warstw GPU.
     - Dla `rawBlur >= 0.25`: `blurPx = clamp(rawBlur, 0.25, 18)` oraz delikatne wygaszenie atmosferyczne dalszych planów (`opacity` skalowane łagodnie do `>= 0.72` dla `z < focalZ - 0.5`).

### 3.3. Światło kierunkowe i powierzchnie (`StageLightingRig.tsx` i `tactileSurface.ts`)

1. **`<StageLightingRig />`:**
   - **Niezmiennik czystej klatki `0`:** Dla `frame <= 0` renderuje wyłącznie jednolity `AbsoluteFill` o kolorze `style.palette.bgCanvas` (zero wzorów, cieni, ziarna czy poświaty).
   - Od `frame >= 1` renderuje podkład stołu/sceny oraz kierunkową warstwę świetlną wyznaczoną przez `style.optics.lightingRig` i `style.optics.lightAngleDeg`:
     - **`window-gobo`:** ciepły gradient kierunkowy ze źródła pod kątem `lightAngleDeg`, powoli dryfujący miękki cień żaluzji/ramy okiennej (`mixBlendMode: 'multiply'` na jasnym tle, subtelny chłodny cień na ciemnym) z rozmyciem półcienia (*penumbra*) oraz delikatna winieta optyczna.
     - **`darkroom-halation`:** podświetlenie stołu montażowego (*lightbox* od środka kadru), ciemniejsza winieta brzegowa, smuga anamorficzna reagująca na `telemetry.velocity` oraz poświata halacji (`style.optics.halation`).
     - **`studio-macro`:** czyste studyjne oświetlenie *softbox* z delikatnym gradientem kierunkowym oraz wąską smugą refleksu (*specular sweep*) przesuwającą się po powierzchni proporcjonalnie do ruchu kamery `(cam.x, cam.y)`.
   - Deterministyczne ziarno kliszy (`style.surface.grainOpacity`) ze zmiennym co klatkę ziarnem deterministycznym PRNG (`seed + frame`).

2. **`getTactileSurfaceStyle(style, options)` (`packages/core/src/optics/tactileSurface.ts`):**
   - Parametry: `{ elevation?: 'flat' | 'resting' | 'lifted' | 'floating'; tiltDeg?: number; lightAngleDeg?: number; overrides?: React.CSSProperties }`.
   - Wylicza wektor cienia rzucanego wprost z `lightAngleDeg` (`rad = (lightAngleDeg * Math.PI) / 180`): światło padające z lewej góry (`lightAngleDeg = -28°`) rzuca cień w prawo-dół (`shadowDx > 0, shadowDy > 0`).
   - Zwraca dwustopniowy `boxShadow`:
     1. Ciasny cień stykowy (*contact shadow* `0 1.5px 2.5px`) kotwiczący obiekt na powierzchni stołu,
     2. Kierunkowy cień rzucany (`${dx}px ${dy}px ${blur}px`) skalowany przez `elevation`,
     oraz obramowanie, fakturę papieru/szkła i kolor powierzchni właściwe dla `style.surface.cardTreatment` + `style.optics.lightingRig`.

---

## 4. Przebudowa Kitu 1: `@make-pictures/kits/editorial-collage`

Wszystkie dotychczasowe eksporty i sygnatury propsów (`ChapterTitleCard`, `EditorialMediaCard`, `HighlightQuoteStage`, `SplitStoryLayout`, `SplitStorySlotContext`, `computeSplitStoryVerticalBounds`, `resolveHighlightStartFrame`) pozostają w 100% kompatybilne wstecznie. Dodajemy nowy kontener sceniczny `<EditorialDeskStage />` i przebudowujemy warstwę wizualną komponentów:

### 4.1. `<EditorialDeskStage />` (`EditorialDeskStage.tsx`)
- Kontener łączący `OpticalStage2D` oraz `StageLightingRig`:
  - **Plan `z = -0.65` (Arkusz roboczy):** subtelne drukarskie znaczniki cięcia (*crop marks*), linie bazowe szpalt i sygnatura arkusza w `monoFont` (automatycznie rozmyte, gdy ostrość spoczywa na `z = 0`).
  - **Plan `z = 0.0` (Plan główny):** dzieci przekazane w `children`.
  - **Plan `z = +0.75` (Przedplan optyczny, opcjonalny `foregroundAccents = true`):** nienachalne detale na skraju kadru poza `9:16 Safe Box` (np. fragment stempla archiwalnego lub podziałki milimetrowej w miękkim bokehu), budujące wieloplanową głębię bez zasłaniania treści.
- Przyjmuje opcjonalne `shots?: OpticalShot2D[]` i `nodes?: Record<string, StageNode2D>`; w razie ich braku wykonuje płynny, organiczny najazd kamery (*micro-dolly*) z delikatnym przeostrzeniem wejściowym (`focalZ: 0.35 -> 0` na pierwszych 24 klatkach od `frame = 2`).

### 4.2. `EditorialMediaCard` — Odbitka Barytowa / Ramka Slajdu
- Zamiast zaokrąglonego kontenera z gradientem:
  - Asymetryczna ramka odbitki fotograficznej (cieńsze boki i góra, szersza dolna stopka z podpisem `caption` w `bodyFont` i numerem archiwalnym `sourceTag` w `monoFont`) albo ciemna ramka slajdu 35mm z perforacją/kodem kliszy dla `lightingRig === 'darkroom-halation'`.
  - Nowy opcjonalny prop `mountType?: 'auto' | 'archival-tape' | 'photo-corners' | 'slide-mount' | 'none'` (domyślnie `'auto'`: taśma archiwalna dla `editorial-press`/`sketch-notebook`/`tactile-craft`, narożniki fotograficzne dla `archival-chronicle`, ramka slajdu dla `darkroom-halation`, czysta odbitka dla `studio-macro`).
  - Nowy opcjonalny prop `tiltDeg?: number` (domyślnie deterministyczny kąt z `caption` w przedziale `[-1.2°, +1.2°]`, lub `0°` dla `studio-macro`).
  - Gdy `src` nie jest podane: zamiast pustego gradientu CSS renderowana jest kompozycja stykówki redakcyjnej (siatka kadrowania, delikatny raster grawiury i sygnatura dokumentu).

### 4.3. `HighlightQuoteStage` — Wycinek Prasowy z Pociągnięciem Atramentu
- Karta wycinka prasowego z kierunkowym cieniem `getTactileSurfaceStyle` i subtelną linią marginesową szpalty.
- Zakreślenie `highlightPhrase` realizowane jest przez deterministyczny podkład SVG o lekko organicznym kształcie pociągnięcia pędzla/pisaka (`scaleX(markSweep)`):
  - na jasnych tłach z `mixBlendMode: 'multiply'` (atrament wsiąkający w papier pod tekstem, niezasłaniający liter),
  - na ciemnych tłach (`isDark: true`) z miękką poświatą halacji (`style.optics.halation`).

### 4.4. `ChapterTitleCard` i `SplitStoryLayout`
- **`ChapterTitleCard`:** Asymetryczny układ magazynowy (w `16:9` oraz wewnątrz `9:16 Safe Box`), indeks rozdziału ze znacznikiem cięcia, linia krajalnicy rosnąca ze sprężyną oraz optyczne wejście ostrości (`focus pull` z delikatnego rozmycia `5px -> 0px` w ciągu pierwszych ~18 klatek wejścia) sprzężone z minimalnym ruchem skali `1.04 -> 1.0`.
- **`SplitStoryLayout`:** Nowe opcjonalne propsy `focusShiftFrame?: number` oraz `initialFocus?: 'both' | 'primary'`:
  - Domyślnie obie karty leżą na subtelnie zróżnicowanych wysokościach stołu (`resting` vs `lifted`), a gdy podano `focusShiftFrame`, ostrość (`blurPx`) i akcent ekspozycji przechodzą płynnie na sprężynie z `primary` na `secondary`, prowadząc wzrok widza bez wykraczania poza `computeSplitStoryVerticalBounds`.

---

## 5. Przebudowa Kitu 2: `@make-pictures/kits/kinetic-typography`

Zachowujemy wszystkie istniejące eksporty i propsy (`WordByWordStage`, `groupWordsIntoBeats`, `ImpactKeywordCard`, `AnimatedMetricCounter`, `formatTabularMetric`). Usuwamy domyślną ikonę `<Sparkles />`, świecące pigułki karaoke oraz paski postępu `5px`. Dodajemy we wszystkich 3 komponentach opcjonalny prop `grammar?: StyleTypographyGrammar` (domyślnie `studioStyle.optics.typographyGrammar`).

### 5.1. `WordByWordStage` — 3 Gramatyki Choreografii Słów
Komponent grupuje słowa przez `groupWordsIntoBeats` i renderuje nie tylko aktywny takt (`activeBeat`), ale również kontekst sąsiednich taktów (`prevBeat`, `nextBeat`) rozłożony w przestrzeni i ostrości:

1. **`swiss-spatial` (Szpalta Szwajcarska + Rack Focus):**
   - Pionowa linia podziału redakcyjnego z numerem taktu (`01`, `02`...) w `monoFont`.
   - Poprzedni takt przesuwa się ku górze i przechodzi w miękkie rozmycie soczewkowe (`blur ~4px`, niższy kontrast), a aktywny takt wyostrza się do `filter: 'none'` z płynnym ruchem kamery.
   - Aktywnie wypowiadane słowo (`activeWordIdx`) otrzymuje dynamiczne podkreślenie atramentowe rosnące od lewej oraz kontrast barwny tekstu (`accentPrimary`), bez pudełkowego tła-pigułki.
2. **`optical-gate` (Bramka Optyczna / Projektor 35mm):**
   - Subtelne narożniki celownika optycznego (*reticle marks*) i kod czasowy/indeks klatki w `monoFont`.
   - Pionowy skok bębna fraz na sprężynie z maską soczewkową rozmywającą sąsiednie wersy u góry i u dołu.
   - W ułamku sekundy zmiany taktu pojawia się krótki, deterministyczny impuls dyspersji chromatycznej i halacji (`textShadow` zgodny z `style.optics.halation`), wygasający do czystego, ostrego tekstu po ustabilizowaniu sprężyny.
3. **`risograph-poster` (Plakat Cięty / Druk Risograficzny):**
   - Kompozycja plakatowa z deterministycznym kątem nachylenia kamery (`rotateZ: ±1.6°` zmienianym między taktami).
   - Aktywne słowo otrzymuje cięty, prostokątny blok inwersyjny (lub kontrastowy stempel bez okrągłych pigułek) z subtelnym przesunięciem pasowania drugiej farby drukarskiej (*ink misregistration* `2px 1.5px 0 accentSecondary`).

### 5.2. `ImpactKeywordCard` — Statement Typograficzny
- `icon` domyślnie wynosi `null` (brak `<Sparkles />`; przekazany jawnie `icon` renderuje się jako czysty znak typograficzny bez gradientowego kafelka).
- Renderuje się odpowiednio jako:
  - **`swiss-spatial`:** arkusz papieru z kierunkowym cieniem `getTactileSurfaceStyle`, górną linią rejestrową i indeksem `eyebrow`/`badge` w układzie tabelarycznym,
  - **`optical-gate`:** ciemna/podświetlona ramka kadru ze znacznikami narożnymi `+`, poświatą halacji na nagłówku i technicznym stemplem `badge`,
  - **`risograph-poster`:** kontrastowy wycięty plakat z twardym offsetem farby i ukośną belką akcentową.

### 5.3. `AnimatedMetricCounter` — Licznik z Podziałką Noniusza
- Tryb `variant === 'inline'` pozostaje lekkim `<span>` z `tabular-nums`.
- W trybie pełnym usuwamy zaokrąglony pasek postępu `5px` i zastępujemy go:
  - precyzyjną podziałką kreskową / skalą noniusza (*vernier ticks* w SVG, podświetlaną proporcjonalnie do `countProgress`) dla `swiss-spatial` oraz `optical-gate`,
  - tłoczonym blokiem plakatowym z twardym cieniem kierunkowym i licznikiem skokowym dla `risograph-poster`.

---

## 6. Integracja ze `Style Lab`, CLI i Zestawem Skilli

1. **Studio Web (`packages/studio/src/client/components/StyleLabShowcase.tsx`):**
   - Sceny `EditorialCollagePreview` oraz `KineticTypographyPreview` zostają przepisane na nowe komponenty (`EditorialDeskStage`, nowe `EditorialMediaCard`, `HighlightQuoteStage`, `WordByWordStage` i `AnimatedMetricCounter`), dzięki czemu zmiana `lightingRig`, `typographyGrammar`, `aperture`, `lightAngleDeg` lub `halation` w prawym inspektorze `PropsInspector` daje natychmiastowy podgląd w `60 FPS` zarówno w `16:9`, jak i `9:16`.
2. **Generator CLI (`packages/cli/src/commands/new-production.ts`):**
   - Szablon `editorial-collage` owija akty w `<EditorialDeskStage />` ze zdefiniowanymi ujęciami `OpticalShot2D[]` (płynne przejścia ostrości między kartą rozdziałową, dwuplanowym `SplitStoryLayout` z `focusShiftFrame` oraz końcowym `HighlightQuoteStage`).
   - Szablon `kinetic-typography` łączy `<StageLightingRig />` z wieloplanowym `WordByWordStage` i `ImpactKeywordCard` + `AnimatedMetricCounter` bez żadnych „pigułek karaoke”.
3. **Dokumentacja skilli (`plugins/make-pictures/skills/` → `npm run sync:skills`):**
   - Aktualizacja `style-and-art-direction/SKILL.md`, `kit-editorial-and-vector/SKILL.md`, `kit-kinetic-and-data/SKILL.md` oraz `cinematography-and-vfx/SKILL.md` o sekcję `optics`, `OpticalStage2D`, `DepthPlane` i nowe wzorce plastyczne, a następnie uruchomienie `npm run sync:skills` oraz `npm run build:packages` w celu zachowania stuprocentowej zgodności z `root-skills-sync.test.ts` i paczkami CLI.

---

## 7. Niezmienniki Determinizmu, Bezpieczeństwa i Plan Weryfikacji

### 7.1. Rygorystyczne niezmienniki
1. **Czysta klatka `0` (`frame === 0`):** Każda nowa scena, warstwa światła i komponent zwraca na klatce `0` wyłącznie czyste tło `palette.bgCanvas` (animacje wejścia startują od `frame >= 2`).
2. **Determinizm `--concurrency=100%`:** Całkowity zakaz `Math.random()` i mutacji stanu między klatkami w `useRef`; wszystkie ziarna szumu, kąty kart (`tiltDeg`) i fazy *gobo* wynikają wyłącznie z `createSeededRandom(seed)` oraz numeru `frame`.
3. **Ochrona `9:16 Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`):** Maksymalny mikro-obrót kart w układzie pionowym jest ograniczony do `±1.2°` z wewnętrznym zapasem marginesu `>= 16px`, aby obrócone narożniki i tekst nigdy nie naruszały strefy interfejsu Shorts/Reels/TikTok.

### 7.2. Plan testów i bramek QA
1. **Testy jednostkowe (`packages/cli/tests/optical-stage.test.ts` — nowy plik):**
   - Weryfikacja `deriveDefaultOpticsForSurface` i parsowania legacy `styles/*.style.json` bez pola `optics`.
   - Weryfikacja `computeCircleOfConfusionPx` (strefa martwa `< 0.25px` → `0`, monotoniczny wzrost z `|z - focalZ|` i `aperture`) oraz `computeParallaxFactor`.
   - Weryfikacja `getTactileSurfaceStyle` (zgodność znaku wektora cienia `(dx, dy)` ze znakiem `lightAngleDeg`).
   - Weryfikacja czystej klatki `0` w SSR (`renderToStaticMarkup`) dla `StageLightingRig`, `EditorialDeskStage` i `WordByWordStage`.
2. **Testy integracyjne kitów i Style Lab (`kits-style-integration.test.ts`, `narrative-kits.test.ts`, `style-core.test.ts`, `studio-styles-api.test.ts`):**
   - Renderowanie SSR wszystkich kombinacji `3 lightingRig × 3 typographyGrammar` w `16:9` oraz `9:16` bez błędów i z obecnością polskich znaków diakrytycznych.
3. **Kompilacja i paczki:** `npm run typecheck`, `npm run build:packages`, `npm test`.
4. **Wizualna inspekcja Contact-Sheet QA (`npx make-pictures qa`):**
   - Wygenerowanie tymczasowych kapsuł testowych dla `editorial-collage` i `kinetic-typography` (w różnych presetach stylów, `16:9` i `9:16`), wyrenderowanie 12-klatkowych arkuszy stykowych PNG i ich wizualna weryfikacja (`f=0` puste tło, widoczna praca światłem/gobo/halacją, brak pigułek UI, czytelna ostrość i poprawne kadrowanie `9:16`), a następnie posprzątanie tymczasowych plików w `productions/` i `out/`.
