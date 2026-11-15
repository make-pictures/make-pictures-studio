# Specyfikacja Projektowa: Autorskie Media Plastyczne i Silnik Optyczny — Fala 2 (`vector-scene-2d`, `data-storytelling`)

**Data:** 2026-11-15  
**Pakiety docelowe:** `@make-pictures/kits`, `@make-pictures/studio`, `@make-pictures/cli`, `plugins/make-pictures` (`+ skills/`)  
**Status:** Oczekuje na przegląd pisemnej specyfikacji przez użytkownika  

---

## 1. Kontekst, Diagnoza Problemu i Zakres Fali 2

W Fali 1 (`a610307` na `main`) wdrożono wspólny wieloplanowy Silnik Optyczny 2.5D w `@make-pictures/core` (`OpticalStage2D`, `DepthPlane`, `StageLightingRig`, `getTactileSurfaceStyle`, `StylePreset.optics`) oraz przebudowano kity `editorial-collage` i `kinetic-typography`.

Niniejsza specyfikacja obejmuje **Falę 2** z zatwierdzonej mapy 3 fal — pełną przebudowę plastyczną i optyczną kitów **`@make-pictures/kits/vector-scene-2d`** (będącego jednocześnie domyślnym kitem startowym przy `npx make-pictures new <slug>`) oraz **`@make-pictures/kits/data-storytelling`**.

### Diagnoza obecnych symptomów „AI-slop” w kitach Fali 2
1. **`vector-scene-2d`:**
   - `StoryCard2D`: półprzezroczysty zaokrąglony kafelek na ikonę `56×56` (`${accent}1F`), kapsułkowy *pill-badge* (`borderRadius: 999`), jednolity wjazd `translateY(24px) scale(0.96)`, brak cienia kierunkowego i głębi.
   - `AnnotatedCallout2D`: surowa prosta linia `strokeWidth={3}` z pełnym kółkiem `r={8}` oraz wyśrodkowane pudełko tekstu bez precyzji rysunku kreślarskiego/architektonicznego.
   - `ComparisonSplit2D`: dwa identyczne płaskie kafelki flexbox obok siebie (lub pod sobą w `9:16`) bez osi podziału, zróżnicowania wysokości i bez prowadzenia wzroku ostrością (*rack focus*).
2. **`data-storytelling`:**
   - `AnimatedBarRace`: zaszyta na sztywno tęczowa paleta `FALLBACK_BAR_SWATCHES = ['#10B981', '#F59E0B', '#F43F5E', '#A855F7']` kłócąca się ze stylem filmu, świecące pigułki `borderRadius: 9999` (`boxShadow: 0 0 18px`), kolorowe kapsułki na liczby i brak linii odniesienia osi.
   - `TimelineTrack`: oś czasu wystylizowana jak *stepper* koszyka e-commerce — okrągłe węzły `48×48` z ikoną `<Check />` z `lucide-react` oraz pigułkowymi etykietami epok.
   - `MetricComparisonCard`: dwa grube pierścienie smartwatcha fitness (`strokeLinecap="round"`), okrągły przycisk `<ArrowRight />` pośrodku oraz świecąca pigułka `+180%`.

### Decyzja architektoniczna Fali 2 (Podejście 1)
- **Zero zmian w `StylePresetSchema` i plikach `styles/*.style.json`:** istniejąca z Fali 1 macierz `lightingRig` (`window-gobo`, `darkroom-halation`, `studio-macro`) × `typographyGrammar` (`swiss-spatial`, `optical-gate`, `risograph-poster`) wraz z `lightAngleDeg`, `aperture` i `halation` w pełni steruje wszystkimi 3 wariantami polimorficznymi obu kitów.
- **Dwa dedykowane kontenery wieloplanowe w `@make-pictures/kits`:** `<VectorSceneStage2D />` w `vector-scene-2d` oraz `<DataStoryStage2D />` w `data-storytelling`, korzystające bezpośrednio z `@make-pictures/core` bez modyfikacji kodu `@make-pictures/core`.
- **100% kompatybilności wstecznej:** wszystkie 6 istniejących komponentów zachowuje dotychczasowe nazwy eksportów i propsów oraz działa również samodzielnie (bez wymogu owijania w `*Stage2D`).

---

## 2. Przebudowa Kitu 1: `@make-pictures/kits/vector-scene-2d`

Wszystkie dotychczasowe eksporty (`StoryCard2D`, `StoryCard2DProps`, `AnnotatedCallout2D`, `AnnotatedCallout2DProps`, `ComparisonSplit2D`, `ComparisonSplit2DProps`, `ComparisonSideSpec`, `computeSafeSplitBounds`) pozostają zachowane w `packages/kits/src/vector-scene-2d/index.ts` oraz w głównym `packages/kits/src/index.ts`. Dodajemy eksport `VectorSceneStage2D` i `VectorSceneStage2DProps`.

### 2.1. Kontener wieloplanowy `<VectorSceneStage2D />` (`VectorSceneStage2D.tsx`)

```ts
export interface VectorSceneStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Sygnatura arkusza konstrukcyjnego na planie z = -0.60 */
  plateCode?: string;
  /** Opcjonalna podniesiona warstwa odnośników na planie z = +0.42 */
  foregroundCallouts?: React.ReactNode;
  /** Subtelny kątownik kalibracyjny na z = +0.72 poza 9:16 Safe Box (domyślnie true) */
  foregroundAccents?: boolean;
  /** Renderowanie bazowego tła w StageLightingRig (domyślnie true) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}
```

- **Niezmiennik czystej klatki `0`:** dla `frame <= 0` renderuje wyłącznie jednolite `AbsoluteFill` o kolorze `style.palette.bgCanvas` (gdy `renderBaseFill !== false`) lub `null`.
- **Wieloplanowa optyka od `frame >= 1`:** łączy `<StageLightingRig />` z `<OpticalStage2D startFrame={1}>`:
  - **Plan `z = -0.60` (Tablica konstrukcyjna):** modułowe włoskowate osie podziału (pionowa i pozioma oś kompozycji), narożne pasery `+` oraz nagłówek `plateCode` w `monoFont` — naturalnie rozmyte przez `computeCircleOfConfusionPx(-0.60, focalZ, aperture)`.
  - **Plan `z = 0.00` (Plansza główna):** dzieci `children` renderowane w pełnej ostrości (`filter: 'none'`, gdy `focalZ ≈ 0`).
  - **Plan `z = +0.42` (`foregroundCallouts`):** opcjonalny slot na `<AnnotatedCallout2D />`, zapewniający fizyczną paralaksę odnośników nad planszą główną.
  - **Plan `z = +0.72` (`foregroundAccents`):** nienachalny kątownik podziałki w narożniku kadru ściśle poza `9:16 Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`).
- **Domyślna trajektoria kamery (gdy `shots` nie podano):** 3-punktowy *micro-dolly* z wejściowym przeostrzeniem `focalZ: 0.36 -> 0` na pierwszych klatkach ujęcia.

### 2.2. `StoryCard2D` — Tablica Koncepcyjna z Grawerowanym Medalionem

- **Kontrakt propsów (`StoryCard2DProps`):** zachowuje `title`, `subtitle?`, `badge?`, `icon?`, `startFrame = 2`, `accentColor?`, `styleOverrides?` oraz dodaje opcjonalne `plateCode?: string`, `tiltDeg?: number`, `compact?: boolean`.
- **Strażnik startu:** zachowuje dokładny zapis `const effectiveStart = Math.max(2, startFrame); if (frame < effectiveStart) return null;` wymagany przez `narrative-kits.test.ts`.
- **Eliminacja tropów SaaS:**
  - Powierzchnia karty wyliczana jest przez `getTactileSurfaceStyle(style, { elevation: 'lifted', tiltDeg })`.
  - Zamiast pigułki `borderRadius: 999`, `badge` i `plateCode` tworzą tabelaryczną belkę indeksową w `monoFont` z poziomą linią kalibracyjną i pionowym ryglem akcentu.
  - Zamiast półprzezroczystego kwadratu `56×56`, ikona (lub deterministyczny glif geometryczny, gdy `icon` pominięto) osadzona jest w **grawerowanym medalionie SVG (`60×60`)** zależnym od `resolveStyleOptics(style).typographyGrammar`:
    - `swiss-spatial`: zewnętrzny przerywany pierścień azymutu, 4 nacięcia osiowe i cienki wewnętrzny pierścień `accent`,
    - `optical-gate`: ciemna oprawa celownika z narożnymi znacznikami i subtelną poświatą `optics.halation`,
    - `risograph-poster`: kontrastowy stempel z twardym obrysem drukarskim i deterministycznym mikro-obrotem karty (`±0.9°` z `createSeededRandom`, wyzerowanym dla `studio-macro`).
- **Wejście optyczne:** delikatne przeostrzenie z miękkiego rozmycia na pierwszych klatkach wejścia do `filter: 'none'` (z zachowaniem strefy martwej `< 0.25px`).

### 2.3. `AnnotatedCallout2D` — Dwusegmentowy Odnośnik Architektoniczny

- **Kontrakt propsów (`AnnotatedCallout2DProps`):** zachowuje `target: [number, number]`, `labelPosition: [number, number]`, `label: string`, `startFrame = 8`, `accentColor?: string` oraz dodaje opcjonalne `sublabel?: string`, `code?: string`, `elbowMode?: 'auto' | 'straight'` (domyślnie `'auto'`).
- **Strażnik startu:** zachowuje `const effectiveStart = Math.max(2, startFrame); if (frame < effectiveStart) return null;`.
- **Geometria i animacja:**
  - **Celownik w punkcie `target`:** koncentryczny pierścień celowniczy SVG + 4 kreski osiowe + centralny punkt `2.5px` (zamiast pełnej kropki `r={8}`).
  - **Łamana linia odniesienia (`elbowMode === 'auto'`):** z punktu `target` wychodzi odcinek ukośny pod kątem `45°` przechodzący w poziomą półkę dochodzącą do `labelPosition` (`elbowX`, `elbowY` wyliczane deterministycznie z różnicy `(dx, dy)`; gdy `|dx| < 18` lub `|dy| < 18` albo `elbowMode === 'straight'`, płynnie redukuje się do pojedynczego odcinka). Animacja rysowania przebiega po dokładnej sumie długości segmentów (`strokeDasharray` / `strokeDashoffset`).
  - **Chorągiewka w `labelPosition`:** podniesiona karta `getTactileSurfaceStyle(style, { elevation: 'floating' })` z bocznym paskiem akcentu po stronie podejścia linii, opcjonalnym kodem `code` w `monoFont`, głównym `label` i opcjonalnym `sublabel`. W orientacji pionowej `9:16` środek i szerokość chorągiewki są klamrowane tak, aby karta nie przekraczała `x ∈ [40, 910], y ∈ [220, 1380]`.

### 2.4. `ComparisonSplit2D` — Dwuplanowe Porównanie z Rack Focusem

- **Kontrakt propsów (`ComparisonSplit2DProps`):** zachowuje `left: ComparisonSideSpec`, `right: ComparisonSideSpec`, `startFrame = 2`, `rightDelayFrames = 14` oraz funkcję `computeSafeSplitBounds(width, height)` (`9:16`: `left: 54, top: 250, width: 836, height: 1080`). Dodaje opcjonalne:
  - `focusShiftFrame?: number` — klatka kompozycji, w której ostrość optyczna przechodzi ze strony `left` na `right`,
  - `initialFocus?: 'both' | 'left'` — domyślnie `'left'` gdy podano `focusShiftFrame`, w przeciwnym razie `'both'`.
- **Strażnik startu:** zachowuje `const effectiveStart = Math.max(2, startFrame); if (frame < effectiveStart) return null;`.
- **Hierarchia i optyka:**
  - **Plansza `left` (stan bazowy):** `elevation: 'resting'`, stonowana belka nagłówkowa w `monoFont`.
  - **Oś kalibracyjna pośrodku:** linia podziału z centralnym znakiem odniesienia `┼` w `monoFont` (pozioma między kartami w `9:16`, pionowa między kolumnami w `16:9`).
  - **Plansza `right` (teza / docelowy stan):** `elevation: 'floating'`, górna lub boczna belka `accentPrimary` i kierunkowy cień rzucany.
  - **Przeostrzenie (*rack focus*):** gdy aktywne jest `focusShiftFrame`, sprężyna `getStyleSpringConfig(style, 'camera')` płynnie wyostrza `right` (`blur -> 0`, `filter: 'none'`), jednocześnie cofając `left` (`scale(0.982)`, `opacity: 0.80`, `blur = maxBlur * shiftProgress` gdzie `maxBlur = Math.max(1.6, optics.aperture * 7)`). W układzie `9:16` karty używają kompaktowego paddingu i limitu mikro-obrotu `±0.45°`, gwarantując pełne zmieszczenie obu plansz wraz z cieniami wewnątrz `computeSafeSplitBounds`.

---

## 3. Przebudowa Kitu 2: `@make-pictures/kits/data-storytelling`

Wszystkie dotychczasowe eksporty (`AnimatedBarRace`, `AnimatedBarRaceProps`, `BarRaceItem`, `BarRaceKeyframe`, `TimelineTrack`, `TimelineTrackProps`, `TimelineMilestone`, `MetricComparisonCard`, `MetricComparisonCardProps`) pozostają zachowane w `packages/kits/src/data-storytelling/index.ts` oraz `packages/kits/src/index.ts` (wraz z obsługą opcjonalnego nadpisania polaryzacji `variant?: 'dark' | 'light'`, realizowanego w nowej geometrii bez powrotu do pigułek i tęczowych kolorów). Dodajemy eksport `DataStoryStage2D`, `DataStoryStage2DProps` oraz czystych funkcji pomocniczych `getSmoothedRanks` i `resolveTonalBarFill`.

### 3.1. Kontener wieloplanowy `<DataStoryStage2D />` (`DataStoryStage2D.tsx`)

```ts
export interface DataStoryStage2DProps {
  shots?: ReadonlyArray<OpticalShot2D>;
  nodes?: Record<string, StageNode2D>;
  /** Sygnatura zbioru / skali drukowana na arkuszu podkładowym z = -0.58 */
  datasetCode?: string;
  /** Subtelny noniusz kalibracyjny na z = +0.68 poza 9:16 Safe Box (domyślnie true) */
  foregroundAccents?: boolean;
  /** Renderowanie bazowego tła w StageLightingRig (domyślnie true) */
  renderBaseFill?: boolean;
  seed?: number;
  children?: React.ReactNode;
}
```

- **Niezmiennik czystej klatki `0`:** dla `frame <= 0` renderuje wyłącznie jednolite `AbsoluteFill` o kolorze `style.palette.bgCanvas` (gdy `renderBaseFill !== false`) lub `null`.
- **Wieloplanowa optyka od `frame >= 1`:**
  - **Plan `z = -0.58` (Arkusz skali):** włoskowate linie podziałki `0% · 25% · 50% · 75% · 100%`, pasery narożne i nagłówek `datasetCode` w `monoFont` (miękko rozmyte poza `focalZ = 0`).
  - **Plan `z = 0.00` (Płaszczyzna danych):** dzieci `children` w pełnej ostrości (`filter: 'none'`).
  - **Plan `z = +0.68` (`foregroundAccents`):** brzegowa podziałka noniusza ściśle poza `9:16 Golden Safe Box`.

### 3.2. `AnimatedBarRace` — Redakcyjny Wyścig Słupkowy w Hierarchii Tonalnej

- **Strażnik czystej klatki `0`:** `const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2); if (frame < effectiveStart || items.length === 0) return null;`.
- **Zachowanie deterministycznej fizyki:** funkcja `getSmoothedRanks(items, frame)` (jądro podniesionego cosinusa na promieniu `12` klatek bez `useRef`) zostaje zachowana i wyeksportowana do testów jednostkowych.
- **Usunięcie `FALLBACK_BAR_SWATCHES` i pigułek `borderRadius: 9999`:**
  - Funkcja `resolveTonalBarFill(studioStyle, discreteRank, explicitColor)` zwraca:
    1. `explicitColor` gdy podano `item.color`,
    2. `studioStyle.palette.accentPrimary` dla aktualnego lidera (`discreteRank === 0`),
    3. `studioStyle.palette.accentSecondary` dla pozycji `#2` (`discreteRank === 1`),
    4. zdyscyplinowaną gradację tonalną `textPrimary` / `inkBorder` dla pozycji `>= 2`.
  - W tle obszaru wykresu rysowane są pionowe włoskowate linie skali (`25%`, `50%`, `75%`, `100%`) z dyskretnym opisem osi.
  - Wartości liczbowe renderowane są jako czysty tekst tabelaryczny (`fontVariantNumeric: 'tabular-nums'`) w `monoFont` bezpośrednio przy końcu słupka (w orientacji poziomej) lub nad kolumną (w orientacji pionowej) — bez kolorowych kapsułek.
  - **Polimorficzne wykończenie słupków (`typographyGrammar`):**
    - `swiss-spatial`: prostokątne belki o ostrym cięciu z pionowym ryglem końcowym na liderze i numerem `01..0N` w kolumnie indeksowej,
    - `optical-gate`: ciemna prowadnica telemetryczna z subtelną poświatą halacji (`optics.halation`) wyłącznie na liderze `#1`,
    - `risograph-poster`: twardy obrys drukarski `1.5px`, odwrócony stempel `01` dla lidera oraz kreskowany deseń SVG (*hatch pattern*) na słupkach niższych pozycji.

### 3.3. `TimelineTrack` — Szyna Kronikarska z Noniuszem i Rack Focusem

- **Strażnik czystej klatki `0`:** `const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2); if (frame < effectiveStart || milestones.length === 0) return null;`.
- **Całkowite usunięcie `<Check />` z `lucide-react` i kółek `48×48`:**
  - Wzdłuż osi biegnie precyzyjna szyna kronikarska z drobnymi nacięciami noniusza (*vernier ticks*) między kamieniami milowymi oraz ciągłym wskaźnikiem postępu napędzanym sprężyną.
  - **Optyczny *rack focus* aktywnej epoki:**
    - Aktywny kamień milowy (`idx === activeIdx`) osadzony jest na podniesionej karcie `getTactileSurfaceStyle(studioStyle, { elevation: 'floating' })` z pełnym kontrastem i ostrością `filter: 'none'`.
    - Sąsiednie epoki (`idx !== activeIdx`) cofają się optycznie (`scale(0.96)`, obniżona przezroczystość `0.62..0.76`) i otrzymują delikatne rozmycie soczewkowe wyliczone z `optics.aperture` oraz odległości indeksowej `Math.min(2, Math.abs(idx - activeIdx))` (ze strefą martwą `< 0.25px -> filter: 'none'`, gdy `aperture === 0` lub brak wariantu optycznego).
  - **Polimorficzny znacznik `era`:** wskaźnik noniusza `▲` w `swiss-spatial`, celownik `◆` w `optical-gate`, prostokątny stempel z twardym cieniem kierunkowym w `risograph-poster`.
  - W `9:16` zarówno układ poziomy (do 3 epok), jak i pionowa kolumna kronikarska (4+ epok) mieszczą się w `x ∈ [40, 910], y ∈ [220, 1380]`.

### 3.4. `MetricComparisonCard` — Skalibrowana Tarcza `240°` (`'rings'`) i Strefa Delty (`'bars'`)

- **Strażnik czystej klatki `0`:** `const effectiveStart = Math.max(2, startFrame ?? enterFrame ?? 2); if (frame < effectiveStart) return null;`.
- **Usunięcie `<ArrowRight />` w okrągłym przycisku, pigułki `borderRadius: 9999` i grubych pierścieni fitness:**
  - Różnica `resolvedDelta` prezentowana jest w prostokątnej ramce pomiarowej `Δ` w `monoFont` (`tabular-nums`) spójnej z aktywnym `typographyGrammar`.
  - **Tryb `mode === 'rings'` (domyślny):** dwa skalibrowane przyrządy kątowe SVG o rozpiętości `240°` (`-210° .. +30°`):
    - zewnętrzna podziałka kreskowa co `10°` (z dłuższymi kreskami głównymi co `60°`),
    - ostry łuk wartości (`strokeLinecap="butt"`) proporcjonalny do `beforeFrac` / `afterFrac`,
    - centralna oś z obracającą się wskazówką (`needle`) wskazującą bieżącą wartość oraz odczyt `tabular-nums` pod osią,
    - pośrodku między tarczami techniczny mostek odniesienia `BAZA ──┼── WYNIK`.
  - **Tryb `mode === 'bars'`:** dwutorowy komparator o ostrych krawędziach z pionową linią odniesienia `beforeFrac` oraz **zakreskowaną pod kątem `45°` strefą przyrostu/spadku SVG (*hatched delta span*)** pomiędzy `beforeFrac` a `afterFrac`.

---

## 4. Integracja ze `Style Lab`, Szablonami CLI i Skillami

1. **Podglądy `60 FPS` w `Style Lab` (`packages/studio/src/client/components/StyleLabShowcase.tsx`):**
   - W `StyleLabPreviewComposition` flaga `usesOpticalStage` zostaje rozszerzona o `'vector-scene-2d'` oraz `'data-storytelling'`.
   - Bez naruszania granicy pakietów (`@make-pictures/studio` importuje wyłącznie z `@make-pictures/core`), komponenty `VectorScene2DPreview` i `DataStorytellingPreview` zostają przepisane na wieloplanowe `<OpticalStage2D />` + `<DepthPlane />` + `getTactileSurfaceStyle`:
     - `VectorScene2DPreview`: tablica konstrukcyjna `z = -0.60`, karta z grawerowanym medalionem i *rack focusem* porównania na `z = 0`, łamany odnośnik z celownikiem na `z = +0.42`.
     - `DataStorytellingPreview`: arkusz skali `z = -0.58`, wyścig słupkowy w hierarchii tonalnej stylu + skalibrowana tarcza `240°` i szyna noniusza z aktywną epoką w ostrości na `z = 0`.
2. **Szablony CLI (`packages/cli/src/commands/new-production.ts`):**
   - `case 'vector-scene-2d'` / `default`: owija scenę w `<VectorSceneStage2D renderBaseFill={false}>`, osadza `<Sequence from={0} durationInFrames={320}><AnnotatedCallout2D ... /></Sequence>` w slocie `foregroundCallouts` (tak aby odnośnik pojawiał się wyłącznie w akcie 1) i ustawia `focusShiftFrame={150}` w `<ComparisonSplit2D />` w akcie 2.
   - `case 'data-storytelling'`: owija scenę w `<DataStoryStage2D renderBaseFill={false}>` z `<AnimatedBarRace />` (akt 1) oraz `<MetricComparisonCard />` (akt 2).
   - Oba szablony zachowują wymagane przez `styles-cli.test.ts` elementy: `<StyleProvider style={props.styleId} renderBackdrop>`, `<VoiceoverTrack />`, `<SoundCue />` i `<SmartMusicBed />`.
3. **Skille (`plugins/make-pictures/skills/` + `npm run sync:skills`):**
   - Aktualizacja `kit-editorial-and-vector/SKILL.md` oraz `kit-kinetic-and-data/SKILL.md` o nowe kontenery `<VectorSceneStage2D />`, `<DataStoryStage2D />` i wzorce optyczne Fali 2, a następnie pełna synchronizacja do `skills/*`.

---

## 5. Niezmienniki Determinizmu i Plan Weryfikacji

### 5.1. Twarde niezmienniki
1. **Czysta klatka `0` (`frame <= 0`):** wszystkie kontenery i komponenty Fali 2 renderują na klatce `0` wyłącznie czyste `palette.bgCanvas` (lub `null` wewnątrz sceny), a animacje startują od `frame >= 2`.
2. **Determinizm `--concurrency=100%`:** zero `Math.random()`, zero mutacji w `useRef` między klatkami; mikro-obroty i detale bazują wyłącznie na `createSeededRandom(seed)`.
3. **Ostrość tekstu i `9:16 Golden Safe Box`:** strefa martwa `< 0.25px -> filter: 'none'` chroni ostrość rastrowania fontów na płaszczyźnie ostrości, a wszystkie układy pionowe mieszczą się w `x ∈ [40, 910], y ∈ [220, 1380]`.

### 5.2. Plan testów i bramek QA
1. **Testy jednostkowe i statyczne (`packages/cli/tests/`):**
   - Aktualizacja i rozszerzenie `narrative-kits.test.ts`, `kits-style-integration.test.ts` oraz nowego testu `wave2-optical-kits.test.ts`:
     - weryfikacja eksportów `VectorSceneStage2D`, `DataStoryStage2D`, `getSmoothedRanks`, `resolveTonalBarFill`,
     - statyczne potwierdzenie braku `Math.random(`, braku `FALLBACK_BAR_SWATCHES` w `AnimatedBarRace.tsx` oraz braku `lucide-react` `<Check` w `TimelineTrack.tsx`,
     - SSR (`renderToStaticMarkup` w kontekście Remotion lub testy funkcji czystych i strażników) potwierdzające hierarchię tonalną, `computeSafeSplitBounds` oraz zgodność wszystkich 7 wbudowanych stylów i 3 gramatyk typografii,
     - zgodność generatora `npx make-pictures new` dla `--kit=vector-scene-2d`, domyślnego wywołania bez `--kit` oraz `--kit=data-storytelling`.
2. **Budowanie, typy i paczki:** `npm run sync:skills && npm run build:packages && npm run typecheck && npm test && npm run pack:verify`.
3. **Contact-Sheet QA (`16:9` oraz `9:16`):**
   - Wygenerowanie tymczasowych kapsuł testowych dla `vector-scene-2d` i `data-storytelling` w orientacji `16:9` i `9:16`, uruchomienie `npx make-pictures qa`, wizualna inspekcja arkuszy `out/qa-*.png` (`f=0` puste tło, ostrość, *rack focus*, brak przepełnienia `y <= 1380` w `9:16`) oraz usunięcie kapsuł tymczasowych po weryfikacji.
