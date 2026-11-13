# Specyfikacja Projektowa: `@make-pictures/studio` — macOS Tahoe / iOS 18+ „Liquid Glass Stage”

**Data:** 2026-11-13  
**Pakiet docelowy:** `@make-pictures/studio` (+ metadane opisu pola w `@make-pictures/core`)  
**Status:** Zatwierdzona do implementacji  

---

## 1. Cel i Wizja Produktowa

Kompleksowa przebudowa aplikacji webowej `@make-pictures/studio` (`Studio Web` oraz `🎨 Style Lab`) z gęstego, trójkolumnowego interfejsu deweloperskiego (jasny motyw na stałe, stały lewy pasek `296px`, rozbudowany dolny pasek transportu i ograniczony inspektor parametrów) w profesjonalne środowisko reżyserskie klasy **Apple Pro Apps (Final Cut Pro / Screen Studio / macOS Tahoe / iOS 18+ „Liquid Glass Stage”)**.

Główne założenia przeprojektowania:
1. **Scena wideo w centrum uwagi:** Usunięcie stałego lewego panelu `296px` na rzecz lekkiego, półprzezroczystego paska górnego `48px` z paletą projektów i stylów otwieraną w oknie typu Popover (`⌘K`) oraz zwijanego prawego inspektora (`⌘I`).
2. **Adaptacyjny system „Liquid Glass” (`Light` + `Dark` + `System`):** Fizycznie wiarygodne warstwy szkła (`backdrop-filter: blur(28px) saturate(190%)`), subtelne obrysy lustrzane (`hairline specular borders`), głęboko neutralne tło obsydianowe `#0B0C0F` w trybie ciemnym gwarantujące wierną ocenę barw wideo `60 FPS` oraz jasne płótno studyjne `#F2F2F7` w trybie dziennym.
3. **Niezawodne sterowanie odtwarzaczem `60 FPS` (`useRemotionPlayer`):** Całkowita eliminacja błędów przycisku *Odtwarzaj / Pauza* po aktualizacjach Vite HMR, resetach `StageErrorBoundary`, przełączeniach kompozycji/`16:9 ↔ 9:16`, dojściu do ostatniej klatki bez pętli (`ended`) oraz podwójnym wyzwalaniu klawiszem `Space` na aktywnym przycisku.
4. **Pływająca kapsuła transportu i zwijana szuflada osi reżyserskiej:** Minimalistyczna kapsuła w stylu QuickTime Player / Apple TV zawieszona u dołu sceny oraz domyślnie zwinięta dolna szuflada zawierająca `LiveTranscriptBar` i 4-ścieżkowy `DirectorTimelinePanel`.
5. **Pełny 3-zakładkowy Inspektor (`Parametry | Skrypt & Audio | JSON`):** Kompletna introspekcja schematów `zod` (w tym wizualny próbnik `styleId`, kolory z kanałem alfa `RGBA`, tablice tagów, krotki numeryczne `X/Y/Z`, unie/literały oraz fallback bez schematu), edytor scenariusza i parametrów głosu na żywo (`GET/POST /api/studio/scenes` dla `scenes.json` oraz kapsuł `productions/<slug>/production.json`) oraz surowy edytor JSON.
6. **Pełna responsywność Desktop / iPad / iOS (`100dvh`):** Dokowany i zwijany prawy inspektor na ekranach `>= 1100px`, pływająca szklana szuflada na tabletach `768px–1099px` oraz natywny dolny arkusz iOS (*Bottom Sheet* z uchwytem `.mp-sheet-grabber` i `env(safe-area-inset-bottom)`) poniżej `768px`.

---

## 2. Architektura Wizualna i System „Adaptive Liquid Glass” (`styles.css` + `useStudioTheme`)

### 2.1. Zarządzanie motywem (`useStudioTheme`)
Nowy hook `packages/studio/src/client/hooks/useStudioTheme.ts` zarządza trybem kolorystycznym aplikacji bez migotania i z pełnym bezpieczeństwem w SSR (`renderToStaticMarkup`):
- **Typ trybu:** `export type StudioThemeMode = 'system' | 'light' | 'dark';`
- **Trwałość:** klucz `localStorage` o nazwie `'mp-studio-theme'`. Brak klucza lub wartość spoza dozwolonego zbioru skutkuje trybem `'system'`.
- **Rozwiązywanie motywu systemowego:** nasłuchiwanie `window.matchMedia('(prefers-color-scheme: dark)')` (`addEventListener('change', ...)`).
- **Synchronizacja z DOM:** w `useEffect` ustawiane są atrybuty `document.documentElement.dataset.theme = resolvedTheme` (`'light' | 'dark'`) oraz `document.documentElement.style.colorScheme = resolvedTheme`, dzięki czemu natywne paski przewijania, `<select>` i próbniki systemowe dopasowują się do aktywnego motywu.
- **Zwracany interfejs:**
  ```ts
  export interface UseStudioThemeResult {
    themeMode: StudioThemeMode;
    resolvedTheme: 'light' | 'dark';
    setThemeMode: (mode: StudioThemeMode) => void;
    cycleThemeMode: () => void; // 'system' -> 'light' -> 'dark' -> 'system'
  }
  ```

### 2.2. Tokeny CSS (`packages/studio/src/client/styles.css`)
Arkusz stylów definiuje semantyczne zmienne w `:root` (motyw jasny), nadpisuje je dla `[data-theme="dark"]` oraz w `@media (prefers-color-scheme: dark)` dla `:root:not([data-theme="light"])` (natychmiastowa zgodność jeszcze przed hydratacją JS):

| Kategoria tokenu | Zmienna CSS | Tryb Jasny (`Light`) | Tryb Ciemny (`Dark`) |
| :--- | :--- | :--- | :--- |
| Płótno sceny | `--mp-stage-canvas` | `#F2F2F7` + subtelny radialny blask | `#0B0C0F` (głęboki obsydian wideo) |
| Szkło podstawowe | `--mp-glass-bg` | `rgba(255, 255, 255, 0.74)` | `rgba(28, 28, 33, 0.74)` |
| Szkło podniesione | `--mp-glass-elevated` | `rgba(255, 255, 255, 0.88)` | `rgba(40, 40, 48, 0.84)` |
| Filtr optyczny | `--mp-glass-blur` | `blur(28px) saturate(190%)` | `blur(28px) saturate(190%)` |
| Obrys włosowaty | `--mp-border-subtle` | `rgba(15, 23, 42, 0.08)` | `rgba(255, 255, 255, 0.09)` |
| Połysk krawędzi | `--mp-specular-inset` | `inset 0 0.5px 0 rgba(255, 255, 255, 0.85)` | `inset 0 0.5px 0 rgba(255, 255, 255, 0.12)` |
| Akcent systemowy | `--mp-accent` | `#007AFF` (Apple Blue) | `#0A84FF` (Apple Dark Blue) |
| Akcent marki / osi | `--mp-coral` | `#FF2D55` | `#FF375F` |
| Przełącznik aktywny | `--mp-success` | `#34C759` | `#30D158` |
| Tekst główny | `--mp-text-primary` | `#1C1C1E` | `#F5F5F7` |
| Tekst drugorzędny | `--mp-text-secondary` | `#636366` | `#A1A1A6` |
| Tekst wyciszony | `--mp-text-muted` | `#8E8E93` | `#6E6E73` |

### 2.3. Typografia i fizyka przejść
- **Stos fontów UI:** `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Inter', system-ui, sans-serif`.
- **Stos techniczny (`--mp-font-mono`):** `'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace`.
- **Stabilność cyfr (`tabular-nums`):** Wszystkie liczniki klatek (`f:128`), kody czasowe (`00:02.13`), wskaźniki `60 FPS`, odznaki wartości suwaków i pola numeryczne wymuszają `font-variant-numeric: tabular-nums`, eliminując drganie szerokości tekstu podczas odtwarzania w `60 FPS`.
- **Krzywa sprężysta:** `--mp-ease-spring: cubic-bezier(0.22, 1, 0.36, 1)` z pełnym poszanowaniem `@media (prefers-reduced-motion: reduce)`.

### 2.4. Responsywne progi układu (`@media`)
1. **Desktop Pro (`>= 1100px`):**
   - `.mp-shell` zajmuje `height: 100vh; height: 100dvh; overflow: hidden`.
   - `.mp-workspace` używa siatki dwukolumnowej `grid-template-columns: minmax(0, 1fr) 368px` z płynną animacją szerokości kolumny (`transition: grid-template-columns 0.28s var(--mp-ease-spring)`).
   - Po zamknięciu inspektora (`.mp-workspace.is-inspector-closed`) siatka przechodzi do `minmax(0, 1fr) 0px`, oddając 100% powierzchni oknu podglądu `16:9` lub `9:16`.
2. **iPad / Split View (`768px – 1099px`):**
   - `.mp-workspace` przechodzi w układ jednokolumnowy `1fr`.
   - `.mp-sidebar-right` staje się pływającą szklaną szufladą (`position: fixed; top: 56px; right: 10px; bottom: 10px; width: min(384px, calc(100vw - 20px)); border-radius: 20px; z-index: 60`) wysuwaną przez `.is-mobile-open` nad półprzezroczystą przesłoną `.mp-inspector-backdrop`.
3. **iOS Mobile (`< 768px`):**
   - Pasek górny `.mp-topbar` zagęszcza się do `46px` (`padding: 0 10px`), ukrywając drugorzędne podpowiedzi skrótów `⌘K` i etykiety tekstowe przycisków pomocniczych przy zachowaniu wyzwalacza projektu, przełącznika widoku i przycisku inspektora.
   - `ProjectPickerPopover` (`.mp-project-popover`) oraz `PropsInspector` (`.mp-sidebar-right`) przyjmują postać natywnego arkusza dolnego iOS (`position: fixed; left: 0; right: 0; bottom: 0; border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom)`) z widocznym uchwytem `.mp-sheet-grabber` (`max-height: 82dvh` dla selektora projektów, `max-height: 68dvh` dla inspektora) oraz polami dotykowymi `min-height: 38px–44px`.

---

## 3. Minimalistyczna Przestrzeń Robocza i Selektor Projektów / Stylów (`⌘K`)

### 3.1. Pasek górny `Topbar` (`48px`)
`Topbar` zostaje zorganizowany w trzy strefy:
- **Lewa (`.mp-topbar-left`):** sygnet `BrandLogo` oraz przełącznik widoku w stylu iOS Segmented Control (`🎬 Filmy` | `🎨 Style Lab`).
- **Środkowa (`.mp-topbar-center`):** kapsułowy wyzwalacz `.mp-project-trigger` prezentujący tytuł aktywnej kompozycji (lub aktywnego stylu w `Style Lab`), kropkę niezapisanych zmian (`.mp-project-trigger-dot`), kompaktową etykietę formatu (`16:9` / `9:16` lub `built-in` / `custom`), strzałkę rozwijania oraz skrót `⌘K`.
- **Prawa (`.mp-topbar-right`):**
  - pigułka pomiaru płynności `60 FPS` (`tabular-nums` + pulsująca kropka podczas odtwarzania),
  - w widoku `Filmy`: szybki przycisk eksportu `Eksportuj MP4` (lub wskaźnik trwającego renderu),
  - przycisk przełączania motywu (`System` / `Jasny` / `Ciemny` z `useStudioTheme`),
  - przycisk zwijania/rozwijania prawego inspektora (`⌘I` / `Ctrl+I`) ze wskaźnikiem niezapisanych zmian.

### 3.2. `ProjectPickerPopover` (`packages/studio/src/client/components/ProjectPickerPopover.tsx`)
Zastępuje stałe boczne panele `LeftSidebar` oraz `StyleCatalogSidebar` w głównym układzie `StudioApp` (oba dotychczasowe komponenty pozostają eksportowane w `packages/studio/src/client/index.ts` dla pełnej kompatybilności wstecznej testów i konsumentów zewnętrznych):
- **Globalny skrót:** `⌘K` / `Ctrl+K` otwiera lub zamyka popover i automatycznie ustawia fokus w polu wyszukiwania `.mp-popover-search`.
- **Tryb `Filmy`:**
  - Natychmiastowe filtrowanie tekstowe po `title`, `id`, `subtitle`, `group` oraz `kit`.
  - Zakładki źródła (`Wszystkie` / `Produkcje` / `Przykłady` z licznikami).
  - Pełna nawigacja klawiaturą (`ArrowDown`, `ArrowUp`, `Enter` wybiera kompozycję i zamyka popover, `Escape` zamyka).
  - Grupowanie po `comp.group` z odznakami `PROD`, `3D`, `9:16` / `16:9`, czasem trwania w sekundach oraz statusem świeżości ścieżek lektorskich z `studioStatus`.
- **Tryb `Style Lab`:**
  - Wyszukiwanie po nazwie, `slug`, fontach i tagach `recommendedFor`.
  - Podział na sekcje `Twoje style (styles/*.style.json)` oraz `Style wbudowane (7)`.
  - Prezentacja próbek barw (`bgCanvas`, `accentPrimary`, `accentSecondary`), pary fontów (`displayFont + bodyFont`) oraz odznak `WŁASNY` / `DARK`.
  - Wbudowany w stopkę formularz `+ Duplikuj jako własny styl` z walidacją `SLUG_RE` (`/^[a-z0-9][a-z0-9-]{0,62}$/`), blokadą nadpisywania 7 identyfikatorów wbudowanych i przyciskiem odświeżenia plików z dysku.

---

## 4. Naprawa Błędów Odtwarzania (`useRemotionPlayer` + `attachPlayerLifecycle`)

### 4.1. Diagnoza przyczyn źródłowych w dotychczasowym kodzie
Analiza `StageViewport.tsx` oraz `StyleLabShowcase.tsx` wykazała cztery niezależne błędy w obsłudze `@remotion/player`:
1. **Martwa referencja `useRef<PlayerRef>(null)` po przemontowaniu `<Player>`:** `useEffect` rejestrujący nasłuchiwacze `play`/`pause`/`frameupdate` zależał wyłącznie od `[composition.id, retryNonce]`. Gdy `<Player>` przemontowywał się wskutek Vite HMR komponentu sceny, odzyskania kontekstu WebGL, zmiany `key="stylelab:${aspectRatio}"` (`16:9 ↔ 9:16`) lub opóźnionego zamontowania wewnątrz `StageErrorBoundary`, zmiana `playerRef.current` nie wywoływała ponownego uruchomienia `useEffect`. Nasłuchiwacze pozostawały podpięte do odłączonej instancji, a stan `isPlaying` przestawał reagować.
2. **Brak obsługi zdarzenia `'ended'` przy `loop === false`:** Gdy użytkownik wyłączył zapętlanie i film dotarł do klatki `durationInFrames - 1`, `@remotion/player` zatrzymywał odtwarzanie i emitował zdarzenie `'ended'` bez gwarantowanego `'pause'`, pozostawiając przycisk w stanie *Pauza* mimo zatrzymanego obrazu.
3. **Brak synchronizacji stanu na `'seeked'` i `'frameupdate'`:** Zewnętrzne zatrzymanie lub przewinięcie odtwarzacza nie uzgadniało `isPlaying` z rzeczywistym `Boolean(player.isPlaying?.())`.
4. **Podwójne przełączenie klawiszem `Space` na aktywnym przycisku:** Nasłuchiwacz `window.addEventListener('keydown', onKeyDown)` działał w fazie bąbelkowania (*bubble phase*). Gdy użytkownik kliknął przycisk *Odtwarzaj* (ustawiając na nim fokus DOM), a następnie nacisnął `Spację`, przeglądarka wyzwalała zarówno domyślną aktywację `<button>` jak i globalny handler `togglePlay()`, natychmiast wznawiając i pauzując film w tej samej klatce.

### 4.2. Rozwiązanie: `packages/studio/src/client/hooks/useRemotionPlayer.ts`
Wydzielamy deterministyczną maszynę stanów do czystej funkcji pomocniczej `attachPlayerLifecycle` (testowalnej jednostkowo na atrapie `PlayerRef` w Node.js bez przeglądarki) oraz hooka `useRemotionPlayer`:

```ts
export interface UseRemotionPlayerOptions {
  fps: number;
  durationInFrames: number;
  resetKey: string;
  initialFrame?: number;
  onFrameChange?: (frame: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onFpsMeasure?: (fps: number) => void;
}

export interface UseRemotionPlayerResult {
  playerRef: React.MutableRefObject<PlayerRef | null>;
  playerRefCallback: (instance: PlayerRef | null) => void;
  displayFrame: number;
  currentFrameRef: React.MutableRefObject<number>;
  isPlaying: boolean;
  loop: boolean;
  setLoop: React.Dispatch<React.SetStateAction<boolean>>;
  muted: boolean;
  setMuted: React.Dispatch<React.SetStateAction<boolean>>;
  toggleMute: () => void;
  seekToFrame: (target: number) => void;
  togglePlay: () => void;
  pause: () => void;
}
```

Kluczowe gwarancje:
- **Callback-ref (`playerRefCallback`):** Każde podłączenie lub odłączenie `<Player ref={playerRefCallback} />` aktualizuje zarówno `playerRef.current`, jak i stan `playerInstance` (`useState<PlayerRef | null>(null)`). Gdy `playerInstance === null`, hook natychmiast odłącza stare listenery i zeruje `isPlaying = false`; gdy pojawia się nowa instancja, synchronicznie odczytuje `Boolean(instance.isPlaying?.())` i podpina komplet zdarzeń: `'play'`, `'pause'`, `'ended'`, `'seeked'` oraz `'frameupdate'`.
- **Obsługa `'ended'` i uzgadnianie `'frameupdate'`:** Zdarzenie `'ended'` bezwarunkowo ustawia `isPlaying = false`, wywołuje `onPlayingChange?.(false)` i przywraca nominalny wskaźnik `onFpsMeasure?.(fps)`. W `'frameupdate'` oprócz pomiaru FPS w oknie `500 ms` następuje lekka weryfikacja zgodności ze stanem `player.isPlaying()`.
- **Faza przechwytywania klawiatury (`capture: true`):** `window.addEventListener('keydown', onKeyDown, true)` ignoruje elementy edycyjne (`INPUT`, `TEXTAREA`, `SELECT`, `isContentEditable`) oraz skróty z modyfikatorami (`metaKey`, `ctrlKey`, `altKey`). Dla `Space` i `KeyK` wywołuje `e.preventDefault(); e.stopPropagation(); togglePlay();` jeszcze w fazie *capture*, zanim zdarzenie dotrze do sfokusowanego `<button>`. Obsługuje również skróty montażowe JKL i strzałki: `ArrowLeft` (`-1`, z `Shift` `-10`), `ArrowRight` (`+1`, z `Shift` `+10`), `KeyJ` (`-10`), `KeyL` (`+10`) oraz `0` / `Home` (skok do klatki `0`).
- **Zachowanie klatki przy HMR vs reset przy zmianie kompozycji:** Dopóki `resetKey` (np. `composition.id`) pozostaje ten sam, `currentFrameRef.current` zachowuje pozycję na osi czasu podczas edycji kodu. Zmiana `resetKey` zeruje pozycję do `initialFrame ?? 0` i ustawia `isPlaying = false`.

---

## 5. Pływająca Kapsuła Transportu i Zwijana Szuflada Osi Reżyserskiej

### 5.1. Górny pasek sceny i baner renderowania MP4 (`.mp-stage-top-bar` / `.mp-render-banner`)
- W widoku `Style Lab` nad płótnem wyświetlana jest lekka szklana listwa z 7 pigułkami zestawów wizualnych (`STYLE_LAB_KITS`), przełącznikiem proporcji `16:9 | 9:16` oraz przyciskiem kopiowania komendy CLI (`npx make-pictures new moj-film --kit=... --style=...`).
- W widoku `Filmy` pasek postępu lokalnego renderowania MP4 (`POST /api/studio/render` przez SSE) pojawia się wyłącznie wtedy, gdy `renderState.status !== 'idle'`, jako półprzezroczysty baner z procentem postępu, przyciskiem *Anuluj* (`AbortController`) oraz przyciskiem *Pokaż w folderze out/* po zakończeniu.

### 5.2. Pływająca Kapsuła Transportu (`.mp-floating-transport`)
Umieszczona w kontenerze `.mp-floating-dock-wrap` u dołu obszaru sceny:
- Okrągły główny przycisk `38×38 px` `.mp-play-fab` (`Play` / `Pause`).
- Grupa precyzyjnego krokowania `.mp-transport-step-group`: `-10`, `-1`, `+1`, `+10` klatek oraz szybki skok do `f:0` (*Czysta klatka 0*).
- Płynny suwak osi czasu `.mp-timeline-slider` z własnym stylem ścieżki i uchwytu dla WebKit oraz Firefox.
- Pigułka kodu czasowego `.mp-timecode-pill` (`tabular-nums`): `MM:SS.CC` oraz licznik `f:NNN / MAX`.
- Przełączniki `Pętla` (`loop`), `Wycisz` (`muted`), rozwijane szklane menu siatek reżyserskich `.mp-overlays-popover` (`Golden Safe Box 9:16`, `Siatka 3×3`, `Marginesy 16:9`, `Arkusz QA 12 klatek`) oraz w widoku `Filmy` przycisk `.mp-drawer-toggle-btn` otwierający szufladę osi reżyserskiej.

### 5.3. Zwijana Szuflada Osi Reżyserskiej i Transkrypcji (`.mp-bottom-drawer`)
- **Domyślnie zwinięta (`isTimelineOpen = false`):** Maksymalizuje pionową przestrzeń dla kadru wideo (szczególnie istotne dla formatów pionowych `9:16` Shorts / Reels).
- Po rozwinięciu odsłania zsynchronizowany co do klatki pasek `LiveTranscriptBar` (podświetlający aktualnie wymawiane słowo z manifestu lektora i pozwalający kliknąć dowolne słowo, by przewinąć do `startFrame`) oraz 4-ścieżkowy `DirectorTimelinePanel` (`Ujęcia kamery`, `Lektor`, `Efekty SFX`, `Muzyka (Ducking)` z obwiednią SVG i modalem 12-klatkowego arkusza kontrolnego QA).

---

## 6. Pełny 3-Zakładkowy Inspektor i API Edycji Scenariusza

### 6.1. Kontrakt lokalnego serwera API (`packages/studio/src/server/index.ts`)
Serwer Vite (`makePicturesStudioServerPlugin`) zachowuje 100% dotychczasowych punktów końcowych (`/api/studio/status`, `/api/studio/styles`, `/api/studio/qa-sheet`, `/api/studio/props`, `/api/studio/voiceover`, `/api/studio/render`, `/api/studio/qa`, `/api/studio/open-output`) i dodaje dwa nowe endpointy oraz odpowiadające im czyste funkcje eksportowane do testów jednostkowych:

1. **`readStudioScenesFromDisk(rootDir: string, studioDir: string)` → `GET /api/studio/scenes`**
   Zwraca ujednoliconą listę manifestów scen z głównego pliku `<studioDir>/scenes.json` (jeśli istnieje, jako grupa `id: 'root'`, `origin: 'root'`, `manifestFile: 'scenes.json'`) oraz wszystkich kapsuł `<studioDir>/productions/<slug>/production.json` (posortowanych alfabetycznie po `slug`, `id: <slug>`, `origin: 'production'`, `manifestFile: 'productions/<slug>/production.json'`):
   ```ts
   {
     ok: true,
     hasApiKey: boolean,
     groups: Array<{
       id: string;
       title: string;
       origin: 'root' | 'production';
       manifestFile: string;
       fps: number;
       scenes: SceneDefinition[];
     }>,
     audioStatus: Record<string, SceneAudioStatusItem>
   }
   ```

2. **`saveStudioSceneToDisk(rootDir: string, studioDir: string, payload)` → `POST /api/studio/scenes`**
   - Waliduje `targetId`: akceptuje `'__root__'` (oraz `'root'`, o ile nie koliduje z katalogiem `productions/root`) wskazujący na `<studioDir>/scenes.json`, albo poprawny `PROD_SLUG_PATTERN` (`/^[a-z0-9][a-z0-9-]{0,62}$/`) wskazujący wyłącznie na `<studioDir>/productions/<targetId>/production.json` z rygorystyczną weryfikacją zawierania ścieżki (`path.resolve` + `startsWith`). Wszelkie próby `../` zwracają `400`.
   - Waliduje `sceneId`: niepusty ciąg znaków dopasowany do istniejącej sceny w tablicy `manifest.scenes` (`404`, jeśli scena nie istnieje).
   - Waliduje obiekt `patch`:
     - `text`: niepusty ciąg po `trim()` (`>= 1` znak),
     - `title`: ciąg znaków,
     - `speaker`, `voiceId`: ciąg znaków lub `undefined` (pusty ciąg usuwa pole opcjonalne z obiektu sceny),
     - `durationInSeconds`: skończona liczba w przedziale `(0.2, 600]`; przy aktualizacji automatycznie przelicza `durationInFrames = Math.round(durationInSeconds * fps)`, gdy manifest posiada `fps` lub scena definiuje `durationInFrames`,
     - `voiceEffect`: jedna z wartości `'clean' | 'telephone' | 'radio-walkie' | 'cathedral' | 'megaphone' | 'excitement-boost'` lub `undefined` (pusty ciąg usuwa pole),
     - `voiceSettings`: opcjonalny obiekt z polami `stability`, `similarityBoost`, `style` w `[0, 1]`, `speed` w `[0.5, 2.0]` oraz `useSpeakerBoost` (`boolean`).
   - **Gwarancja nienaruszalności danych:** wszystkie pozostałe pola sceny (`component`, `recordingFile`, `windowTitle`, `triggerWords`, `cues`, `previousText`, `nextText`) oraz manifestu (`sfx`, `score`, `project`) pozostają w 100% nietknięte.
   - **Zapis atomowy:** formatowanie `JSON.stringify(manifest, null, 2) + '\n'`, zapis do pliku tymczasowego `<target>.tmp-${process.pid}` i atomowa podmiana `fs.renameSync`. Po zmianie tekstu lektora kolejne wywołanie `collectAudioStatus` automatycznie oznacza `audioStatus[sceneId].isHashCurrent === false`.

### 6.2. Rozszerzona introspekcja schematów (`zodIntrospect.ts`)
Moduł `packages/studio/src/client/schema-form/zodIntrospect.ts` rozszerza `InspectorFieldKind` do pełnego zestawu typów używanych w kompozycjach i presetach stylów:
```ts
export type InspectorFieldKind =
  | 'text'
  | 'textarea'
  | 'color'
  | 'style-id'
  | 'range'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'string-array'
  | 'tuple-number'
  | 'json-value';
```
- **`style-id`:** wykrywany automatycznie dla kluczy `styleId` / `/styleId$/i`; renderuje wizualną siatkę kafelków ze wszystkimi 7 stylami wbudowanymi i własnymi plikami `styles/*.style.json` wraz z próbkami barw.
- **`color` (HEX + RGBA):** obsługuje `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb(...)`, `rgba(...)` oraz `hsl(...)`. Eksportuje czyste funkcje `parseRgbaOrHex(input)` i `formatColorWithAlpha(hex6, alpha, keepAlphaFormat)`, umożliwiając edycję przez natywny próbnik koloru, pole tekstowe oraz suwak krycia (alfa `0%–100%`).
- **`textarea`:** dla wielowierszowych napisów, opisów, cytatów lub ograniczeń `max > 120` znaków.
- **`string-array`:** dla `z.array(z.string())` oraz `z.array(z.enum(...))` (np. `StylePresetSchema.shape.recommendedFor`, które w `@make-pictures/core/src/style/schema.ts` otrzymuje opis `.describe('Informacje :: Polecane zastosowania')`) — renderowane jako interaktywna lista czipów z usuwaniem i dodawaniem tagów.
- **`tuple-number`:** dla `z.tuple([z.number(), ...])` o długości `2..4` (np. wektory pozycji/skali 2D/3D `[x, y, z]`) — renderowane jako wielokolumnowa siatka pól liczbowych `tabular-nums`.
- **`enum` z unii i literałów:** spłaszcza `ZodEnum`, `ZodNativeEnum`, `ZodLiteral` oraz `ZodUnion` / `ZodDiscriminatedUnion` złożone z literałów/enumów do wygodnej listy wyboru `<select>`.
- **Fallback bez schematu (`introspectPropsFallback`) i łączenie nadmiarowych pól (`mergeSchemaWithExtraProps`):** kompozycje bez zdefiniowanego `schema` generują pełny formularz na podstawie typów wartości w `defaultProps`, a dodatkowe klucze obecne w `*.props.json` trafiają do sekcji `'Dodatkowe parametry'`.
- **Pełna zgodność wsteczna z `StylePresetSchema`:** `introspectZodObject(StylePresetSchema, BUILT_IN_STYLES['editorial-press'])` zachowuje dokładny zestaw i kolejność sekcji `['Informacje', 'Paleta kolorów', 'Typografia', 'Powierzchnia & Tło', 'Fizyka ruchu', 'Domyślne Audio']` oraz 8 pól `'color'` w `'Paleta kolorów'`.

### 6.3. Trzy zakładki `PropsInspector` (`Parametry | Skrypt & Audio | JSON`)
1. **Zakładka `Parametry` (`params`):**
   - Pasek synchronizacji z dyskiem (`Zapisz` `⌘S`, `Przywróć`, przełącznik `Auto-zapis` z debounce `450 ms`, ścieżka docelowego pliku `*.props.json` lub `styles/*.style.json`).
   - Wyszukiwarka parametrów po nazwie i sekcji + zwijane karty sekcji `.mp-section-card`.
   - Przycisk przywracania pojedynczego pola `.mp-field-reset-btn` (`↺`), widoczny gdy bieżąca wartość pola różni się od wartości bazowej w `composition.defaultProps`.
   - Karta diagnostyczna kompozycji (rozdzielczość, FPS, czas trwania, kit wizualny oraz telemetria pamięci podręcznej tekstur `VRAM LRU` dla `paper-diorama-3d`).
2. **Zakładka `Skrypt & Audio` (`script` — komponent `SceneScriptEditor`):**
   - Dostępna w widoku `Filmy`; automatycznie dopasowuje grupę scen do aktywnej kapsuły (`activeComposition.productionId` → `productions/<slug>/production.json`, z przełącznikiem grup jeśli w projekcie istnieje wiele manifestów lub `scenes.json`, i podświetleniem scen powiązanych z `activeComposition.sceneTimeline`).
   - Dla każdej sceny umożliwia edycję tytułu, mówcy (`speaker`), treści kwestii lektorskiej (`text`), czasu trwania (`durationInSeconds`), identyfikatora głosu (`voiceId`), efektu akustycznego (`voiceEffect`) oraz ustawień ekspresji (`stability`, `similarityBoost`, `style`, `speed`, `useSpeakerBoost`) z atomowym zapisem przez `POST /api/studio/scenes`.
   - Prezentuje status pliku `.mp3` i zgodność skrótu SHA-256 (`ElevenLabs`, `Zmieniony tekst`, `Tryb próbny`, `Brak pliku`) oraz wbudowany przycisk regeneracji audio przez strumień SSE `POST /api/studio/voiceover` (z opcją `--force`).
3. **Zakładka `JSON` (`json`):**
   - Bezpośredni edytor tekstu JSON z walidacją składni w czasie rzeczywistym (oraz walidacją `composition.schema.safeParse`, jeśli schemat istnieje), przyciskiem formatowania wcięć (`2 spacje`) i kopiowania do schowka.

---

## 7. Bezpieczeństwo, Niezmienniki `AGENTS.md` i Strategia Weryfikacji

- **Ochrona ścieżek plikowych:** Żaden endpoint (`/api/studio/props`, `/api/studio/styles`, `/api/studio/scenes`) nie akceptuje ścieżek bezwzględnych ani sekwencji `..`; wszystkie zapisy są weryfikowane przez `path.resolve(...)` względem dozwolonych katalogów i wykonywane atomowo przez plik tymczasowy `.tmp-${process.pid}` + `fs.renameSync`.
- **Ochrona kluczy tajnych:** Serwer nigdy nie zwraca wartości `ELEVENLABS_API_KEY` do klienta — udostępnia wyłącznie flagę logiczną `hasApiKey: boolean`.
- **Determinizm i higiena `<Audio />`:** Przeprojektowanie UI zachowuje pulę `STUDIO_SHARED_AUDIO_TAGS = 32`, weryfikację czystej klatki `0` (*Klatka 0*), dokładne nakładki SVG `Golden Safe Box` (`x ∈ [40, 910], y ∈ [220, 1380]` dla `9:16`) oraz dwukierunkowy kontrakt z plikami `*.props.json` i `styles/*.style.json`.
- **Pokrycie testami automatycznymi (`node:test` + `tsx`):**
  1. `packages/cli/tests/studio-scenes-api.test.ts` — testy jednostkowe i HTTP dla `readStudioScenesFromDisk`, `saveStudioSceneToDisk`, synchronizacji `durationInFrames`, zachowania nieznanych pól (`cues`, `score`), odrzucania path traversal i wykrywania nieaktualnego skrótu SHA-256 po zmianie tekstu sceny.
  2. `packages/cli/tests/studio-player-and-schema.test.ts` — testy cyklu życia `attachPlayerLifecycle` (przemontowanie, `ended`, `frameupdate`), rozszerzonej introspekcji `zodIntrospect.ts` (`style-id`, `textarea`, `RGBA`, `string-array`, `tuple-number`, `ZodUnion`), `introspectPropsFallback` i `mergeSchemaWithExtraProps`.
  3. `packages/cli/tests/studio-styles-api.test.ts` — pełna regresja dotychczasowych testów stylów, pustego stanu `StudioApp` oraz SSR komponentów Studio.
  4. `npm run typecheck` — bezbłędna kompilacja TypeScript we wszystkich pakietach monorepo (`core`, `kits`, `studio`, `cli`).
