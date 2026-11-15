# Projekt Flagowego Showreela v3 (`make-pictures-showreel`) — Kino z Kodu po Falach 1–3

**Data:** 2026-11-15  
**Kapsuła docelowa:** `productions/make-pictures-showreel/` (izolowana kapsuła produkcyjna v3 zastępująca przed-optyczną wersję v2)  
**Kompozycje wyjściowe (`60 FPS`, `2160` klatek = `36.0 s`):**
- `MakePicturesShowreelPL` (`1920×1080`, `16:9`, język polski) → `out/make-pictures-showreel-pl.mp4` (`-14 LUFS`)
- `MakePicturesShowreelEN` (`1920×1080`, `16:9`, język angielski) → `out/make-pictures-showreel-en.mp4` (`-14 LUFS`)
- `MakePicturesShowreelVerticalPL` (`1080×1920`, `9:16`, Golden Safe Box, język polski) → `out/make-pictures-showreel-vertical-pl.mp4` (`-14 LUFS`)
- `MakePicturesShowreelVerticalEN` (`1080×1920`, `9:16`, Golden Safe Box, język angielski) → `out/make-pictures-showreel-vertical-en.mp4` (`-14 LUFS`)

---

## 1. Kontekst i Cel

Wersja v2 kapsuły `productions/make-pictures-showreel` (powstała przed Falami 1–3) prezentowała ręcznie narysowane makiety zamknięte wewnątrz okienka interfejsu na jasnym tle `#F8FAFC`. Po zakończeniu wszystkich trzech fal przebudowy optyczno-polimorficznej (`a610307`, `b7963b4`, `b44340c`) silnik `@make-pictures/core` oraz zestaw `@make-pictures/kits` dysponują:
1. **Silnikiem Optycznym 2.5D (`OpticalStage2D`, `DepthPlane`, `StageLightingRig`):** 3 reżimy światła (`studio-macro`, `window-gobo`, `darkroom-halation`), optyczne rozmycie *Circle-of-Confusion* z martwą strefą ostrości tekstu `< 0.25px -> filter: 'none'`, ziarno i faktury powierzchni (`getTactileSurfaceStyle`).
2. **Polimorfizmem wszystkich 7 kitów scenicznych w 7 wbudowanych stylach (`BUILT_IN_STYLES`):**
   - `kinetic-typography` (`swiss-spatial` / `optical-gate` / `risograph-poster`, synchronizacja z timestampami słów TTS),
   - `editorial-collage` (`EditorialDeskStage`, smugi gobo, `HighlightQuoteStage` z odręcznym podkreśleniem SVG, optyczny Ken Burns),
   - `vector-scene-2d` (`VectorSceneStage2D`, grawerowane medaliony `StoryCard2D`, łamana `45°→poziom` z celownikiem `AnnotatedCallout2D`, kalibrowany *rack focus* `ComparisonSplit2D`),
   - `data-storytelling` (`DataStoryStage2D`, tarcze `240°` i zakreskowana delta w `MetricComparisonCard`, tonalny `AnimatedBarRace`, szyna noniusza `TimelineTrack` z ruchomym oknem ostrości),
   - `motion-diagrams-2d` (`MotionDiagramStage2D` z `DirectorCamera2D` i topologicznym *rack focusem*, 3 rodziny łączników `anodized-pill` / `laser-telemetry` / `drafting-arrow`, `SystemNode`, `CodePayloadToast`),
   - `paper-diorama-3d` (`DioramaStage3D`, `PopUpHinge3D`, `PaperCutout3D` z `Δz >= 0.45` i `PaperStageLighting3D`),
   - `isometric-3d` (`IsometricStage3D` z kierunkowym światłem `optics.lightAngleDeg`, 24-podziałkowy postument, `ContactShadowDisc3D`, rzeźbiarski `Stylized3DCharacter` w 3 rodzinach materiałów `ceramic-maquette` / `anodized-telemetry` / `ink-figurine` i kopertą mowy `speakingWeight` / `speechEnergy`),
   - `product-frames` (`BrowserFrame`, `PhoneFrame`, `ScreenSpotlightOverlay` z oddechowym celownikiem optycznym).
3. **Pełnym pipeline'em audio ElevenLabs (`-14 LUFS` EBU R128):** lektor z timestampami słów, muzyka AI (`composition-plan`) z automatycznym sidechain duckingiem (`SmartMusicBed`), puls bitu (`useMusicBeatPulse`) i punktowe efekty Foley (`SoundCue`).

**Cel Showreela v3 („Kino z Kodu”):** Zbudować dynamiczny, `36.0`-sekundowy (`2160` kl. @ `60 FPS`) film pełnoekranowy, w którym **90% czasu ekranowego wypełniają prawdziwe, żywe komponenty `@make-pictures/core` i `@make-pictures/kits`** z dyskretnym znacznikiem wizjera kamery (`OpticalHudBadge`: `kit • style • optics.lightingRig`), domknięty klamrą **Studio Web / Style Lab** i otwartym wezwaniem `npx create-make-pictures@latest`.

---

## 2. Architektura Plików Kapsuły

```text
productions/make-pictures-showreel/
├── production.json                         # Manifest 10 scen (5 PL + 5 EN), score (composition-plan 36s) i 7 efektów SFX
├── index.ts                                # Rejestracja 4 kompozycji w defineProduction()
├── generated/
│   └── audio-manifest.ts                   # Auto-generowany przez CLI (VOICEOVER_MANIFEST, MUSIC_MANIFEST, SFX_MANIFEST)
└── compositions/
    ├── contracts.ts                        # Oś czasu 5 aktów (0..2160), kamera, SFX, koperta mowy 3D, Safe Box 9:16
    ├── OpticalHudBadge.tsx                 # Dyskretny znacznik wizjera (kit • style • lightingRig), bezpieczny dla 9:16
    ├── Act1KineticEditorial.tsx            # Akt 1 (0..390): WordByWordStage + ImpactKeywordCard -> EditorialDeskStage
    ├── Act2VectorDataOptics.tsx            # Akt 2 (390..810): VectorSceneStage2D -> DataStoryStage2D
    ├── Act3PolymorphicDiagram.tsx          # Akt 3 (810..1260): MotionDiagramStage2D przełączany przez 3 style na żywo
    ├── Act4DimensionalMaquettes.tsx        # Akt 4 (1260..1770): DioramaStage3D (0..180) -> IsometricStage3D (180..510)
    ├── Act5StudioFinale.tsx                # Akt 5 (1770..2160): BrowserFrame/PhoneFrame + ScreenSpotlightOverlay -> Finale
    ├── MakePicturesShowreel.tsx            # Główny kompozytor: StyleProvider, Audio (Voiceover/SmartMusicBed/SoundCue), Sequence
    ├── MakePicturesShowreelPL.props.json
    ├── MakePicturesShowreelEN.props.json
    ├── MakePicturesShowreelVerticalPL.props.json
    ├── MakePicturesShowreelVerticalEN.props.json
    └── __tests__/
        └── showreel-v3.test.ts             # Testy kontraktów: 2160 kl., 7 kitów, 7 stylów, Safe Box 9:16, zod <-> props.json
```

*(Przestarzałe pliki wersji v2: `Act1StudioHero.tsx`, `Act2ThreeShowcase.tsx`, `Act3StyleLabMorph.tsx`, `Act4BrandFinale.tsx` zostaną zastąpione czystymi modułami v3).*

---

## 3. Choreografia 5 Aktów (`0..2160` klatek @ `60 FPS`) i Pokrycie `7 Kitów × 7 Stylów`

Każdy akt montowany jest wewnątrz `<Sequence from={act.startFrame} durationInFrames={act.durationInFrames}>`, dzięki czemu `useCurrentFrame()` wewnątrz aktu zwraca lokalną klatkę `0 .. durationInFrames - 1`. Pomiędzy aktami działa deterministyczny `<SceneTransition />` z `@make-pictures/kits`.

### Akt 1 (`0..390`, `0.0 s – 6.5 s`, `390` kl.) — *Od Słowa do Światła*
- **Inwariant Czystej Klatki `0`:** Klatka globalna `0` (oraz `1`) renderuje wyłącznie czyste tło `palette.bgCanvas` wybranego `props.styleId` (`opacity: 0` dla wszystkich warstw pierwszoplanowych i HUD). Wejście sceniczne startuje od `frame >= 2`.
- **Ujęcie 1A (`localFrame 0..186`, `0.0–3.1 s`) — `kinetic-typography` w stylu `brutalist-poster` (`risograph-poster`, `darkroom-halation`, `-38°`):**
  - `<StyleProvider style="brutalist-poster" renderBackdrop>` + `<StageLightingRig />` + `<OpticalStage2D>` z `<WordByWordStage words={act1Words} wordsPerBeat={3} safeBox9x16 />` zsynchronizowanym co do klatki z pierwszymi słowami lektora (`VOICEOVER_MANIFEST['act1-pl' | 'act1-en']`), uzupełnionym o akcent `<ImpactKeywordCard />`.
- **Ujęcie 1B (`localFrame 186..390`, `3.1–6.5 s`) — `editorial-collage` w stylu `editorial-press` (`window-gobo`, `swiss-spatial`, `-28°`):**
  - `<StyleProvider style="editorial-press">` + `<EditorialDeskStage>` z `<SplitStoryLayout>` łączącym `<HighlightQuoteStage>` (z animowanym odręcznym podkreśleniem SVG pod słowami o świetle i papierze) oraz `<EditorialMediaCard>` (z deterministyczną grafiką SVG/canvas i optycznym ruchem Ken Burns).

### Akt 2 (`390..810`, `6.5 s – 13.5 s`, `420` kl.) — *Optyczna Ostrość i Narracja Danych*
- **Ujęcie 2A (`localFrame 0..210`, `6.5–10.0 s`) — `vector-scene-2d` w stylu `archival-chronicle` (`window-gobo`, `aperture: 0.54`):**
  - `<StyleProvider style="archival-chronicle">` + `<VectorSceneStage2D>` prezentujący `<ComparisonSplit2D>` z kalibrowaną osią podziału i przełączeniem optycznego *rack focusu* (`activeSide` z `'left'` na `'right'` w `localFrame = 96`) oraz grawerowanym `<StoryCard2D>` i celownikiem `<AnnotatedCallout2D>` (`45° → poziom`).
- **Ujęcie 2B (`localFrame 210..420`, `10.0–13.5 s`) — `data-storytelling` w stylu `minimal-product` (`studio-macro`, `swiss-spatial`):**
  - `<StyleProvider style="minimal-product">` + `<DataStoryStage2D>` łączący `<MetricComparisonCard>` (tarcze `240°` i zakreskowana pigułka delty), tonalny `<AnimatedBarRace>` (`resolveTonalBarFill`) oraz `<TimelineTrack>` z szyną noniusza i przesuwającym się oknem ostrości *rack focus*.

### Akt 3 (`810..1260`, `13.5 s – 21.0 s`, `450` kl.) — *Nieskończone Płótno i Polimorfizm Stylów na Żywo*
- **Ciągły graf `motion-diagrams-2d` (`3 × 150` kl. = `3 × 2.5 s`):**
  - Jedna spójna topologia 4 węzłów `<SystemNode>` spiętych portami `NodeBox` (`portRight/Left` w `16:9`, `portBottom/Top` w kaskadzie `9:16`), krawędziami `<FlowCurve>` (kadencja pakietów `108` klatek) i dymkiem `<CodePayloadToast>`, prowadzona kamerą `<MotionDiagramStage2D shots={...}>` z topologicznym *rack focusem* podążającym za aktywnym węzłem.
  - Co `150` klatek (`localFrame = 0`, `150`, `300`) zewnętrzny `<StyleProvider style={activeDiagramStyle}>` przełącza styl na żywo bez resetowania przepływu pakietów:
    1. `0..150` (`13.5–16.0 s`): **`minimal-product`** (`studio-macro` + anodyzowana kapsuła `anodized-pill`),
    2. `150..300` (`16.0–18.5 s`): **`cyber-telemetry`** (`darkroom-halation` + telemetria laserowa `laser-telemetry` + `optical-gate`),
    3. `300..450` (`18.5–21.0 s`): **`sketch-notebook`** (`window-gobo` + kreślarski grot `drafting-arrow` na siatce notatnika).

### Akt 4 (`1260..1770`, `21.0 s – 29.5 s`, `510` kl.) — *Taktylne Makiety 2.5D i Rzeźbiarskie Studio 3D*
- **Budżet i izolacja WebGL:** `<ThreeCanvas>` montowany jest wyłącznie w Akcie 4, rozbity na dwie rozłączne pod-sekwencje `<Sequence>` (`0..180` oraz `180..510`), dzięki czemu w dowolnej klatce całego filmu istnieje **maksymalnie 1 aktywny kontekst WebGL** (`gl: 'angle'`-safe).
- **Ujęcie 4A (`localFrame 0..180`, `21.0–24.0 s`) — `paper-diorama-3d` w stylu `tactile-craft` (`window-gobo`):**
  - `<StyleProvider style="tactile-craft" renderBackdrop>` + `<DirectorCamera3D shots={dioramaShots}>` + `<PaperStageLighting3D>` + `<DioramaStage3D variant="minimal-plinth" surfacePattern="spotlight">` z trzema planami `<PopUpHinge3D>` i `<PaperCutout3D>` zachowującymi separację `Δz >= 0.55` (zero Z-fightingu) i białą obwódkę wycinanki `whiteBorderPx`.
- **Ujęcie 4B (`localFrame 180..510`, `24.0–29.5 s`) — `isometric-3d` przez 3 rodziny materiałów makiety (`3 × 110` kl.):**
  - `<DirectorCamera3D shots={isometricShots}>` (używający skalibrowanych w Fali 3 presetów `medium-two-shot` → `medium` bezpiecznych dla `9:16`) + `<IsometricStage3D>` z 24-podziałkowym postumentem i `<ContactShadowDisc3D>`.
  - Dwie postacie `<Stylized3DCharacter>` (Reżyserka i Architekt) napędzane prawdziwą kopertą mowy z `VOICEOVER_MANIFEST['act4-pl' | 'act4-en']`: rozdzielone `speakingWeight` (wolna sprężyna postawy) oraz `speechEnergy` (mikro-kiwanie głowy z obwiedni słów, `talkBounce = 0`, częstotliwość gestów `0.038..0.048 rad/kl.`).
  - Płynna ewolucja stylu i kąta światła `optics.lightAngleDeg` (obracająca kierunkowe cienie na postumencie):
    1. `180..290`: **`editorial-press`** (`ceramic-maquette`),
    2. `290..400`: **`cyber-telemetry`** (`anodized-telemetry`),
    3. `400..510`: **`sketch-notebook`** (`ink-figurine`).

### Akt 5 (`1770..2160`, `29.5 s – 36.0 s`, `390` kl.) — *Klamra Studio Web, Style Lab i Open-Source Finale*
- **Ujęcie 5A (`localFrame 0..180`, `29.5–32.5 s`) — `product-frames` w stylu `props.styleId` (domyślnie `minimal-product`):**
  - `<OpticalStage2D>` z `<BrowserFrame>` (w `16:9`) lub `<PhoneFrame>` (w `9:16`) prezentującym deterministyczny widok **Style Lab (`60 FPS`) + Props Inspector** oraz `<ScreenSpotlightOverlay>` podświetlający przełącznik stylów i suwak przysłony `optics.aperture`.
- **Ujęcie 5B (`localFrame 180..390`, `32.5–36.0 s`) — Karta finałowa `make.pictures` (`vector-scene-2d`):**
  - `<VectorSceneStage2D>` z grawerowanym medalionem marki `make.pictures`, nagłówkiem otwartego studia, kartami CLI (`npx create-make-pictures@latest` oraz `npx skills add make-pictures/make-pictures-studio`) i subtelnym oddechem świetlnym napędzanym przez `useMusicBeatPulse`.

---

## 4. Architektura Audio ElevenLabs (`PL` + `EN`, Muzyka AI, Foley SFX, `-14 LUFS`)

### 4.1. Scenariusz lektorski (`Daniel` — `onwK4e9ZLuTAKqWW03F9`, `eleven_multilingual_v2`)
Parametry głosu: `stability: 0.58`, `similarityBoost: 0.84`, `style: 0.24`, `speed: 1.12`, `useSpeakerBoost: true`, `voiceEffect: 'clean'`. Wszystkie kwestie połączone są polami `previousText` i `nextText` oraz wolne od surowych skrótów, cyfr i adresów URL.

| Scena (`id`) | Okno aktu (start VO) | Tekst `PL` (`act*-pl`) | Tekst `EN` (`act*-en`) |
| :--- | :--- | :--- | :--- |
| `act1-*` | `0..390` (`fromFrame: 12`) | `Jedno zdanie w kodzie budzi żywe światło, szlachetny papier i rytm słów.` | `One prompt in code awakens living light, tactile paper, and kinetic words.` |
| `act2-*` | `390..810` (`fromFrame: 404`) | `Optyczna głębia ostrości prowadzi wzrok od grawerowanych detali po precyzyjne tarcze danych.` | `Optical depth of field guides the eye from engraved callouts to calibrated data dials.` |
| `act3-*` | `810..1260` (`fromFrame: 824`) | `Ten sam układ połączeń zmienia w locie materiał, światło i rysunek jednym parametrem stylu.` | `A single flow diagram morphs its material, lighting, and geometry with one style switch.` |
| `act4-*` | `1260..1770` (`fromFrame: 1274`) | `Papierowe wycinanki i rzeźbiarskie makiety rzucają kierunkowe cienie i ożywają w rytmie mowy.` | `Layered paper cutouts and sculpted studio figures cast directional shadows and move with every spoken word.` |
| `act5-*` | `1770..2160` (`fromFrame: 1784`) | `Dopracuj każdy kadr w wizualnym studiu. Otwarte narzędzie czeka na mejk kropka pikczers.` | `Refine every frame visually in the browser. Explore the open toolkit at make dot pictures.` |

### 4.2. Ścieżka muzyczna AI (`score` — `composition-plan`, `36 s`)
- `id`: `"optical-showreel-score"`, `mode`: `"composition-plan"`, `moodPreset`: `"upbeat-launch"`, `forceInstrumental: true`, `durationSeconds: 36`, `baseVolume: 0.28`, `duckedVolume: 0.09`.
- **3 sekcje `compositionPlan` (`13000 ms` + `15000 ms` + `8000 ms` = `36000 ms`):**
  1. `Warm Optical Spark` (`13000 ms`): ciepłe elektryczne pianino Rhodes, taktylna marimba i miękki puls analogowy pod typografię, kolaż i tarcze danych.
  2. `Polymorphic Studio Groove` (`15000 ms`): sprężysty rytm indie-electronic z krystalicznym arpeggio i głębokim sub-basem pod żywy diagram i makiety 3D.
  3. `Open Studio Horizon` (`8000 ms`): jasny, szeroki akord finałowy z czystym wybrzmieniem do końca `36.0 s`.
- Montaż przez `<SmartMusicBed />` (sidechain auto-ducking na bazie `sceneTimeline` aktywnego języka) z `fadeInFrames={24}` i `fadeOutFrames={66}`.

### 4.3. Punktowe efekty Foley (`sfx` + `<SoundCue />`)
7 dyskretnych plików SFX (`volume: 0.20..0.28`, zawsze z bezpiecznym oknem `<Sequence>` wewnątrz `<SoundCue />`):
1. `shutter-gate` (`f=10`, `0.9 s`): mechaniczna migawka aparatu średnioformatowego na starcie Aktu 1A.
2. `paper-slide` (`f=186`, `1.1 s`): szlachetny szelest ciężkiego arkusza papieru przy wejściu `EditorialDeskStage` (Akt 1B).
3. `aperture-focus` (`f=486` oraz `f=600`, `0.9 s`): ciche kliknięcie pierścienia przysłony obiektywu na przeskokach *rack focusu* w Akcie 2.
4. `prism-morph` (`f=814`, `f=960`, `f=1110`, `1.0 s`): krystaliczny przełącznik optyczny przy 3 zmianach stylu w Akcie 3.
5. `popup-unfold` (`f=1268`, `1.3 s`): sprężyste rozłożenie kartonowej makiety `PopUpHinge3D` w Akcie 4A.
6. `orbital-whip` (`f=1440`, `1.1 s`): miękki kinowy szwenk powietrza przy przejściu w `IsometricStage3D` (Akt 4B).
7. `finale-bloom` (`f=1950`, `2.4 s`): ciepły, świetlisty akord harmoniczny na odsłonięciu karty finałowej `make.pictures` (Akt 5B).

---

## 5. Kontrakt `zod` ↔ `*.props.json`, Geometria `9:16` i Determinizm

### 5.1. Schemat `MakePicturesShowreelSchema` dla Studio Web (`Props Inspector`)
```ts
export const MakePicturesShowreelSchema = z.object({
  styleId: z.string().describe('Kolory & Styl :: Styl klamry i finału (Style ID)'),
  lang: z.enum(['pl', 'en']).describe('Teksty & Napisy :: Język narracji (pl / en)'),
  brandHeadline: z.string().describe('Teksty & Napisy :: Nagłówek finałowy'),
  ctaCommand: z.string().describe('Teksty & Napisy :: Główna komenda CLI'),
  skillsCommand: z.string().describe('Teksty & Napisy :: Komenda instalacji skilli AI'),
  showOpticalHud: z.boolean().describe('Kamera & Optyka :: Wizjer aktualnego kitu i stylu'),
  voiceoverVolume: z.number().min(0).max(1.5).describe('Audio :: Głośność lektora'),
  musicVolume: z.number().min(0).max(1).describe('Audio :: Głośność muzyki bazowej'),
  sfxVolume: z.number().min(0).max(1).describe('Audio :: Głośność efektów SFX'),
});
```

### 5.2. Natywna geometria `9:16` (`1080×1920`) — Golden Safe Box
Wszystkie karty, wykresy, węzły diagramu, znacznik `OpticalHudBadge` i komendy CLI w wariantach `MakePicturesShowreelVerticalPL` / `VerticalEN` muszą mieścić się wewnątrz **Golden Safe Box `x ∈ [40, 910], y ∈ [220, 1380]`** (z zapasem wewnętrznym `x ∈ [64, 884], y ∈ [248, 1344]` kompensującym optyczny *micro-dolly* `zoom <= 1.045`):
- **Akt 1:** `WordByWordStage` z `safeBox9x16`, pionowy stos `HighlightQuoteStage` + `EditorialMediaCard`.
- **Akt 2:** kolumnowy układ `ComparisonSplit2D` + `AnnotatedCallout2D` oraz pionowy stos `MetricComparisonCard` + `AnimatedBarRace` + `TimelineTrack`.
- **Akt 3:** pionowa kaskada 3–4 węzłów `SystemNode` (`portBottom → portTop`) z krzywymi `FlowCurve` wewnątrz `x ∈ [72, 876]`.
- **Akt 4:** kamera `DirectorCamera3D` z poszerzonym frustum pionowym (zweryfikowanym w Fali 3 `b44340c`).
- **Akt 5:** `<PhoneFrame>` ze `<ScreenSpotlightOverlay>` zamiast poziomego `<BrowserFrame>`, po czym pionowa karta finałowa `make.pictures`.

### 5.3. Niezmienniki deterministyczne `60 FPS`
- Czysta klatka `f=0` (`palette.bgCanvas`, wejścia od `frame - 2`).
- Całkowity zakaz `Math.random()` i akumulacji stanu w `useRef` między klatkami (`--concurrency=100%`).
- Ostrość typografii: martwa strefa `< 0.25px -> filter: 'none'`.
- Polska typografia *Sentence case* z pełnym `latin-ext`, zwięzłe etykiety wizualne (*Ikona + 2–3 słowa*), brak napisów dolnych dublujących lektora.

---

## 6. Plan Testów i 4 Obowiązkowe Bramki Weryfikacji

1. **Testy jednostkowe (`showreel-v3.test.ts`):**
   - Ciągłość 5 aktów pokrywających dokładnie `0..2160` klatek bez luk i nakładek.
   - Kompletność matrycy: wszystkie **7 kitów scenicznych** i wszystkie **7 wbudowanych stylów** są jawnie zadeklarowane i użyte w choreografii.
   - Matematyczna walidacja prostokątów układu `9:16` względem `Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]`).
   - Walidacja wszystkich 4 plików `*.props.json` względem `MakePicturesShowreelSchema` oraz poprawności fonetycznej tekstów TTS w `production.json` (brak surowych skrótów i URL-i w polach `text`).
2. **Bramka 1 — Synteza i Odsłuch Audio (`AGENTS.md` §4.1):**
   - Uruchomienie `npx tsx packages/cli/src/index.ts audio --production=make-pictures-showreel` i obowiązkowy odsłuch wygenerowanych plików `.mp3` (`act1..5` PL/EN, muzyka, SFX) narzędziem `read_file`. Dopasowanie ewentualnych okien startowych w `contracts.ts`, jeśli rzeczywisty czas wypowiedzi wymaga korekty oddechu.
3. **Bramka 2 — Contact-Sheet QA (`AGENTS.md` §4.2):**
   - Wygenerowanie 12-klatkowych arkuszy dla wszystkich 4 kompozycji (`MakePicturesShowreelPL`, `MakePicturesShowreelEN`, `MakePicturesShowreelVerticalPL`, `MakePicturesShowreelVerticalEN`) i wizualna kontrola każdego arkusza PNG narzędziem `read_file` (`f=0` czyste tło, polskie znaki, brak Z-fightingu, `9:16 Safe Box`).
4. **Bramka 3 i 4 — Typy, Testy i Render Masterowany (`-14 LUFS`, `AGENTS.md` §4.3):**
   - `npm run typecheck` + `npm test` (`100%` zielone).
   - Finalny render wszystkich 4 plików MP4 komendą `npx tsx packages/cli/src/index.ts render <CompositionId>` z normalizacją głośności EBU R128 `-14 LUFS` i potwierdzeniem parametrów wyjściowych `out/make-pictures-showreel-*.mp4`.
