# Przebudowa DNA Reżyserskiego, 3 Światów Artystycznych i Showreela v4 — Specyfikacja Projektowa

**Data:** 2026-11-16  
**Zakres:** 3-etapowa przebudowa u źródła (`@make-pictures/core` + `@make-pictures/cli` → `@make-pictures/kits` + `@make-pictures/studio` + szablony CLI → flagowy `productions/make-pictures-showreel` v4)

---

## 1. Diagnoza Problemów Źródłowych

Analiza wyrenderowanego Showreela v3 oraz kodu `@make-pictures/core` i `@make-pictures/kits` wykazała trzy błędy systemowe:

1. **Usterki geometrii CSS/SVG i brak separacji planów:**
   - W `packages/kits/src/motion-diagrams-2d/SystemNode.tsx` kontener węzła ma zaokrąglone rogi (`borderRadius`) oraz `overflow: 'visible'` (dla bocznych pinów `-5px`), a wewnętrzny pasek nagłówkowy (`position: 'absolute', top: 0, left: 0, right: 0, height: 3`) nie posiada maski przycinającej ani `borderRadius`, przez co jego proste rogi wystają poza obrys karty.
   - Etykiety na krzywych `DataFlowEdge.tsx` wiszą zbyt blisko szczytu łuku Béziera, a na jasnych tłach (`#F8FAFC`) nieaktywne węzły poddane *rack focusowi* rozpadają się w wyblakłe, nieczytelne „pola formularza” o kontraście `~1.03:1`.
2. **Brak zaszytej w DNA aplikacji płynności reżyserskiej i budżetu percepcji:**
   - Wciśnięcie 11 pod-ujęć w `36 s` (`~3.2 s` na pełną zmianę świata wizualnego), łączenie w pierwszych `2.9 s` migających trójek słów `WordByWordStage` z kartą `ImpactKeywordCard` i odznaką `OpticalHudBadge` oraz sklejanie osobnych `<Sequence>` ostrymi wycierkami (`paper-curtain`, `iris-wipe`, `flash-cut`) i jednoklatkowymi przeskokami `styleId` tworzy nerwowy, nieczytelny pokaz slajdów.
   - Narzędzie `npx make-pictures qa` sprawdzało dotąd wyłącznie statyczną siatkę 12 klatek, nie blokując zbyt krótkich cięć, nadmiaru słów na sekundę ani konkurencyjnych animacji wejścia.
3. **Surowy, „biurowo-wireframe'owy” wygląd kitów i szablonów:**
   - Style różniły się głównie kolorem i czcionką na tych samych prostokątnych ramkach CSS pełnych technicznego żargonu (`MOD 01`, `SLOT 01/03`, `F/2.0`), na pustych tłach pozbawionych scenografii malarskiej, a sceny 2.5D/3D używały płaskich podpisanych tabliczek albo ciemnej pustej siatki zamiast pełnej architektury i ilustracji.

---

## 2. Etap 1 — DNA Reżyserskie w `@make-pictures/core` i Twarda Bramka w `@make-pictures/cli` (`qa`)

### 2.1. Taksonomia 3 Światów Artystycznych (`ArtWorld`) i Płynna Interpolacja Stylów
- Rozszerzenie `StylePresetSchema` (`packages/core/src/style/schema.ts`) o pole opcjonalne `artWorld?: 'atelier' | 'illustrative' | 'editorial-gallery'` wraz z funkcją `resolveArtWorld(style: StylePreset): ArtWorld`:
  - **`'atelier'`** (klimat Apple / Linear — szkło akrylowe, anodyzowany metal, cyklorama studyjna): `minimal-product`, `cyber-telemetry`.
  - **`'illustrative'`** (klimat Kurzgesagt / Buck — nasycone plamy barwne, wieloplanowe krajobrazy i ilustracje): `tactile-craft`, `sketch-notebook`.
  - **`'editorial-gallery'`** (klimat Pentagram / NYT Magazine / Vox — monumentalna typografia, passe-partout, papier bawełniany i ciemnia): `editorial-press`, `archival-chronicle`, `brutalist-poster`.
- Nowy moduł `packages/core/src/style/interpolate.ts`:
  - `interpolateStylePresets(fromStyle: StylePreset, toStyle: StylePreset, progress: number): StylePreset` — ciągła interpolacja `60 FPS` wszystkich kolorów `palette` (`interpolateColors`), parametrów `surface` (`radiusScale`, `grainOpacity`) oraz `optics` (`lightAngleDeg`, `aperture`, `halation`) po krzywej kubicznej *smoothstep*. Pozwala płynnie przeistaczać cały świat wizualny przez `48–72` klatki bez żadnego cięcia ani błysku.

### 2.2. Kompozytor Ciągłości `<ContinuousSceneFlow>` i Kinowe Krzywe Ruchu (`packages/core/src/director/`)
- **`DIRECTOR_PACING_BUDGET`:**
  - `minSceneDurationFrames: 270` (`4.5 s` @ `60 FPS`),
  - `minSettleHoldFrames: 45` (`0.75 s` spokojnego oddechu po wejściu / zakończeniu kwestii),
  - `maxWordsPerSecond: 2.8`,
  - `defaultCrossDissolveFrames: 54` (`0.9 s`).
- **`CINEMATIC_SPRINGS` oraz `useFocalStagger`:**
  - Krzywe o wyższej masie i krytycznym tłumieniu (`entrance: { mass: 1.45, damping: 200, stiffness: 58 }`, `drift: { mass: 1.8, damping: 200, stiffness: 34 }`, `emphasis: { mass: 1.25, damping: 200, stiffness: 72 }`), które miękko osadzają główny obiekt w `~0.85 s`.
  - `useFocalStagger(frame, fps, options)` egzekwuje **Prawo Jednego Punktu Skupienia**: najpierw wchodzi główny bohater kadru (`lead`), dopiero po `+22` klatkach warstwa wspierająca (`support`), a po niej następuje spokojny *hold*.
- **`<ContinuousSceneFlow scenes={...} crossDissolveFrames={54} />` i `<OpticalCrossDissolve />`:**
  - Zastępuje sztywne sklejanie `<Sequence>` + `SceneTransition`. Sąsiadujące sceny nakładają się w oknie `crossDissolveFrames` z miękkim przenikaniem optycznym (`smoothstep`), subtelnym *focus-pullem* soczewki (`0 px → 4.5 px → 0 px`, z zachowaniem ostrości `< 0.25px -> filter: 'none'` poza oknem przenikania) i ciągłym mikro-dryfem skali (`0.986 → 1.0 → 1.018`).
  - **Bezpieczeństwo budżetu WebGL:** Jeśli przejście zachodzi między dwiema scenami oznaczonymi `usesThree: true`, `<ContinuousSceneFlow>` automatycznie wykonuje miękkie rozpuszczenie przez zasłonę świetlną `palette.bgCanvas`, odmontowując pierwszy `<ThreeCanvas>` dokładnie w szczycie zasłony przed zamontowaniem drugiego — w każdej klatce działa maksymalnie **1 kontekst WebGL**.

### 2.3. Twardy Audytor Reżyserski w `npx make-pictures qa` (`packages/cli/src/director/audit-direction.ts`)
Podczas każdego wywołania `npx make-pictures qa <CompositionId>` uruchamiany jest walidator `auditCompositionDirection` (domyślnie **twardy błąd blokujący QA**, z flagą awaryjną `--allow-fast-cuts` tylko dla świadomych wyjątków):
1. **Minimalny czas trwania sceny wizualnej (`>= 4.5 s` / `270` kl. dla produkcji `origin: 'production'`):** Sprawdza rozpiętość okien wizualnych w `sceneTimeline` oraz wizualnych bloków `<Sequence durationInFrames={N}>` (pomijając ścieżki audio `layout="none"`). Zbyt krótkie pod-ujęcia (jak dawne `174` kl. = `2.9 s`) przerywają `qa` z konkretną diagnozą.
2. **Prawo Jednego Punktu Skupienia i Budżet Czytania:**
   - Blokuje montowanie `<WordByWordStage` w tym samym komponencie/sekwencji co karty `<ImpactKeywordCard`, `<StoryCard2D`, `<MetricComparisonCard` czy `<SystemNode`.
   - Weryfikuje w `production.json`, że tempo słów w oknie sceny nie przekracza `2.8 słowa/s` i pozostawia minimum `36–45` klatek spokojnego oddechu przed końcem sceny.
3. **Blokada szarpanych wycierek:** Blokuje użycie `<SceneTransition` z `type="flash-cut"`, `"paper-curtain"`, `"iris-wipe"` lub `durationInFrames < 30` na rzecz `<ContinuousSceneFlow>` / `<OpticalCrossDissolve>`.
4. **Higiena geometrii rogów i czystości klatki `f=0`:** Wykrywa w kodzie nieprzycięte paski absolutne wewnątrz kontenerów `overflow: 'visible'` oraz weryfikuje jednorodność pikseli wyrenderowanej klatki `f=0` (`100%` czystego `bgCanvas`).

---

## 3. Etap 2 — Precyzja Geometryczna i Przebudowa Artystyczna `@make-pictures/kits`, `StyleLab` i Szablonów CLI

### 3.1. Precyzja Geometryczna i Kontrast Planów
- **Wewnętrzna maska `ClippedSurfaceChrome`:** W `SystemNode.tsx`, `NodeBox.tsx`, `CodePayloadToast.tsx`, `StoryCard2D.tsx`, `MetricComparisonCard.tsx`, `AnimatedBarRace.tsx` i `ImpactKeywordCard.tsx` cała wewnętrzna dekoracja karty (górny pasek akcentowy, wewnętrzny połysk krawędziowy *specular rim*, subtelny gradient powierzchni) trafia do wewnętrznego kontenera `position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden'`, natomiast zewnętrzne piny portów w `SystemNode` leżą w osobnym rodzeństwie poza maską. **Żaden element wewnętrzny nie może wystawać poza zaokrąglone narożniki.**
- **Szlachetna separacja karty od tła (`getTactileSurfaceStyle` + `StageLightingRig`):**
  - Zastąpienie płaskiej bieli `#FFFFFF` na `#F8FAFC` wielowarstwowym cieniem *ambient-occlusion*, delikatnym wewnętrznym refleksem górnej krawędzi i subtelną winietą/cykloramą na płótnie.
  - Korekta *rack focusu* w `MotionDiagramStage2D` i `ComparisonSplit2D`: na jasnych tłach drugi plan zachowuje czytelny obrys i miękkie rozmycie `~1.6 px` zamiast wyblakłego `opacity: 0.55` przypominającego nieaktywny formularz.
- **Geometria `DataFlowEdge.tsx`:** Gładkie styczne wejścia/wyjścia do portów, świetlisty ślad przepływu (*flow trail*) oraz minimalny prześwit pionowy `>= 26 px` między wierzchołkiem krzywej a opcjonalną etykietą.

### 3.2. Scenografia 3 Światów Artystycznych (`ScenicBackdropLayers` + odnowione Kity 2D i 3D)
- **Usunięcie inżynieryjnego szumu:** Domyślne komponenty kitów nie renderują technicznych etykietek typu `MOD 01`, `SLOT 01/03`, `PLATE 02`, `CoC < 0.25 PX` — wszystkie pola pomocnicze stają się opcjonalne i domyślnie wyłączone na rzecz czystej, odważnej typografii i grafiki.
- **Nowy komponent `ScenicBackdropLayers` (w `@make-pictures/core` / używany przez sceny 2D kitów):**
  - W świecie **`atelier`** (`minimal-product`, `cyber-telemetry`): architektoniczna cyklorama studyjna z miękkim refleksem podłogowym, subtelnymi soczewkowymi łukami świetlnymi i głębią przestrzeni.
  - W świecie **`illustrative`** (`tactile-craft`, `sketch-notebook`): wieloplanowa, malarska ilustracja wektorowa w paralaksie (łagodne pasma wzgórz, organiczne obłoki, tarcza słoneczna, detale botaniczne/geometryczne).
  - W świecie **`editorial-gallery`** (`editorial-press`, `archival-chronicle`, `brutalist-poster`): galeryjne passe-partout, monumentalne znaki wodne numeracji rozdziałów w tle i wyraźne światło okienne na papierze bawełnianym.
- **Gotowe motywy ilustracyjne w `paper-diorama-3d` (`ScenicCutoutMotifs.tsx`):**
  - Zestaw bogatych, wielowarstwowych rysunków Canvas2D do `PaperCutout3D` (`MountainRangeCutout3D`, `CloudCanopyCutout3D`, `PineGroveCutout3D`, `AtelierDeskCutout3D`, `SunburstArchCutout3D`) z pełnym światłocieniem malarskim i sztancowym białym obrysem — zastępujący surowe prostokątne tabliczki.
- **Pełna architektura pokoju w `isometric-3d` (`IsometricScenicSet3D.tsx` wbudowany w `IsometricStage3D`):**
  - Zamiast ciemnej pustki z cienką siatką `IsometricStage3D` renderuje pełną, stylową przestrzeń architektoniczną dopasowaną do `artWorld`: narożne ściany z wysokim oknem i snopem światła kierunkowego, niszę regałową z detalami rzeźbiarskimi, centralny stół studyjny z kinetycznym rekwizytem oraz ciepłą posadzkę (skalibrowaną tak, by w `9:16` cała akcja postaci mieściła się czysto w `Golden Safe Box`).

### 3.3. Szablony CLI (`new-production.ts`) i `StyleLabShowcase.tsx`
- Wszystkie 7 szablonów generowanych przez `npx make-pictures new <slug> --kit=...` przechodzi na `12.0 s` (`720` klatek = dwie spokojne sceny po `360` klatek / `6.0 s`) spięte przez `<ContinuousSceneFlow crossDissolveFrames={48} />`, używa bogatych motywów 3 Światów i przechodzi rygorystyczny audyt `auditCompositionDirection`.
- Podglądy `StyleLabShowcase.tsx` w Studio Web odzwierciedlają 3 Światy Artystyczne (Atelier / Ilustracyjny / Galeryjny) w `60 FPS`.

---

## 4. Etap 3 — Nowy, Płynny Showreel v4 (`productions/make-pictures-showreel/`, `44.0 s` / `2640` kl. @ `60 FPS`)

### 4.1. Filozofia Reżyserska
- **4 długie, spokojne sceny po `10.5–11.5 s`** (`630 + 690 + 690 + 630 = 2640` kl. = `44.0 s`), połączone wyłącznie miękkim, `54`-klatkowym (`0.9 s`) przenikaniem optycznym `<ContinuousSceneFlow crossDissolveFrames={54} />`.
- **Zero ostrych wycierek (`SceneTransition` usunięte), zero technicznego `OpticalHudBadge` w rogu, maksymalnie 1 główny punkt skupienia wzroku w każdej chwili.**

### 4.2. Przebieg 4 Scen
1. **Scena 1 (`0..630`, `0.0–10.5 s`) — *Świat Galeryjno-Redakcyjny (`editorial-press`)*:**
   - `0.0–4.6 s`: Na ciepłym papierze w świetle okiennym wyłania się wyłącznie jeden monumentalny tytuł `ChapterTitleCard` (*„Jedna opowieść. Trzy światy sztuki.”* / *„One story. Three worlds of craft.”*) z ponad `2.2 s` spokojnego oddechu.
   - `4.6–10.5 s`: Płynne przenikanie na tym samym stole redakcyjnym do kadrowanej w passe-partout autorskiej ilustracji malarskiej (`EditorialMediaCard`) i zwięzłej sentencji (`HighlightQuoteStage`).
2. **Scena 2 (`630..1320`, `10.5–22.0 s`) — *Świat Atelier i Płynna Metamorfoza Stylu (`minimal-product` → `cyber-telemetry`)*:**
   - Na przestrzennej cykloramie studyjnej pojawia się harmonijny układ 3 akrylowych węzłów `SystemNode` ze świetlistymi łukami `DataFlowEdge` oraz tarczą `MetricComparisonCard` (`60 FPS`).
   - Między `localFrame 270..342` (`1.2 s`), bez żadnego cięcia, cała scena płynnie przeistacza się przez `interpolateStylePresets` z jasnego szkła `minimal-product` w głęboki obsydian `cyber-telemetry`.
3. **Scena 3 (`1320..2010`, `22.0–33.5 s`) — *Świat Ilustracyjny 2.5D i Pełna Przestrzeń 3D (`tactile-craft` → `IsometricStage3D`)*:**
   - `22.0–27.5 s` (`330` kl.): Barwny, wieloplanowy krajobraz wycinankowy `DioramaStage3D` (`SunburstArchCutout3D`, `MountainRangeCutout3D`, `CloudCanopyCutout3D`, `PineGroveCutout3D`, `AtelierDeskCutout3D`).
   - `27.5–33.5 s` (`360` kl.): Miękkie przejście świetlne (z zachowaniem `<= 1` kontekstu WebGL) do pełnego, ciepło oświetlonego pokoju 3D (`IsometricStage3D` + `IsometricScenicSet3D`), gdzie dwie postacie prowadzą spokojną rozmowę zsynchronizowaną z głosem lektora.
4. **Scena 4 (`2010..2640`, `33.5–44.0 s`) — *Żywe Studio Web i Spokojny Finał (`minimal-product`)*:**
   - `33.5–38.5 s` (`300` kl.): Czysty kadr `BrowserFrame` (`16:9`) / `PhoneFrame` (`9:16`) ze `ScreenSpotlightOverlay` pokazującym wybór pomiędzy 3 Światami Artystycznymi w **🎨 Style Lab**.
   - `38.5–44.0 s` (`330` kl.): Monumentalna, spokojna karta finałowa `make.pictures` z komendą `npx create-make-pictures@latest` i długim, `3`-sekundowym wybrzmieniem muzyki.

### 4.3. Warstwa Dźwiękowa ElevenLabs (`44.0 s`, `speed: 1.04`, `-14 LUFS`)
- Lektor `Daniel` (`onwK4e9ZLuTAKqWW03F9`, `speed: 1.04`, spokojna, filmowa dykcja, zero skrótów i cyfr w `text`):
  - **Scena 1 (`PL` / `EN`):** *„Z jednego opisu rodzi się obraz pełen światła, faktury i spokoju.”* / *„From a single prompt, living light, texture, and calm motion unfold.”* (~`4.8 s` w oknie `10.5 s` → `5.7 s` oddechu).
  - **Scena 2 (`PL` / `EN`):** *„Każdy układ płynnie zmienia swój charakter od jasnego szkła po głęboki obsydian.”* / *„Every composition transforms seamlessly from sunlit glass into deep studio obsidian.”* (~`5.2 s` w oknie `11.5 s` → `6.3 s` oddechu).
  - **Scena 3 (`PL` / `EN`):** *„Barwne ilustracje i przestrzenne pracownie budują świat wokół twojej historii.”* / *„Layered illustrations and sculpted rooms build an entire world around your story.”* (~`5.2 s` w oknie `11.5 s` → `6.3 s` oddechu).
  - **Scena 4 (`PL` / `EN`):** *„Wybierz własny kierunek sztuki w przeglądarce na mejk kropka pikczers.”* / *„Shape your own artistic direction in the browser at make dot pictures.”* (~`4.6 s` w oknie `10.5 s` → `5.9 s` oddechu).
- **Muzyka AI (`44 s` `composition-plan`):** płynna, ciepła partytura filmowo-studyjna (fortepian filcowy, smyczki kameralne, miękki puls analogowy i szerokie wybrzmienie finałowe) z `SmartMusicBed` auto-duckingiem i 4 dyskretnymi akcentami dźwiękowymi `SoundCue`.

---

## 5. Weryfikacja Końcowa Każdego Etapu
- **Etap 1:** testy jednostkowe `director` + `interpolateStylePresets` + `auditCompositionDirection` (w tym testy pozytywne i negatywne odrzucające szybkie cięcia `< 4.5 s` i konkurencyjne karty), `npm run typecheck`, `npm test`.
- **Etap 2:** testy integracyjne 3 Światów i geometrii kitów, `StyleLabShowcase`, przebudowane szablony `npx make-pictures new` przepuszczone przez twarde `npx make-pictures qa` (`16:9` + `9:16` obejrzane przez `read_file`), `sync:skills` oraz `npm run pack:verify`.
- **Etap 3:** synteza i obowiązkowy odsłuch wszystkich plików `.mp3` przez `read_file`, twarde `npx make-pictures qa` wszystkich 4 kompozycji (`PL`, `EN`, `VerticalPL`, `VerticalEN`) obejrzane przez `read_file`, oraz finalny render 4 plików MP4 z masteringiem EBU R128 `-14 LUFS`.
