# Matryca `Przestrzeń (2D / 2.5D / 3D) × Styl`, Nowy Silnik `Soft-Clay & IBL 3D` i Showreel Produktowy `Prompt → Efekt` — Specyfikacja Projektowa

**Data:** 2026-11-16  
**Zakres:** Trzy zintegrowane podprojekty:
1. **Podprojekt A (`@make-pictures/core`, `@make-pictures/cli`, `@make-pictures/studio`):** Dwuosiowa architektura `DimensionalSpace ('2d' | '2.5d' | '3d') × StylePreset`, rozszerzenie katalogu o style `retro-pc`, `soft-clay` i `glass-studio` (`10` stylów wbudowanych) oraz pełna swoboda własnych stylów w `styles/*.style.json`.
2. **Podprojekt B (`@make-pictures/kits`):** Przebudowa wizualna przestrzeni `3D` na bazie proceduralnego IBL offline (`Environment` + `Lightformer` + `ContactShadows`), fazowanych brył `RoundedBox`, materiałów `MeshPhysicalMaterial` i ekspresyjnej postaci `<ClayCharacter3D>` (z oczami 3D i mruganiem) + dedykowane scenografie `2D Retro-PC` oraz `2.5D Lunar Cutout`.
3. **Podprojekt C (`productions/make-pictures-showreel/` v5):** Nowy, konkretny Showreel produktowy (`39.0 s` / `2340` kl. @ `60 FPS`) oparty na formule *„Zobacz, jak z jednego zdania tworzysz super animacje”* + **3 rzeczywiste przykłady `Prompt → Rzeczywisty Efekt`** (`2D Retro-PC`, `2.5D Wycinanka Apollo 11`, `3D Soft-Clay Podcast Studio`).

---

## 1. Podprojekt A — Dwuosiowa Matryca `Przestrzeń (2D | 2.5D | 3D) × Styl` i Własne Style

### 1.1. Model Danych w `StylePresetSchema` (`packages/core/src/style/schema.ts`)
Zachowujemy dokładne 7 polskich sekcji inspektora Studio Web (`Informacje`, `Paleta kolorów`, `Typografia`, `Powierzchnia & Tło`, `Fizyka ruchu`, `Optyka & Światło`, `Domyślne Audio`):
- `DimensionalSpaceSchema = z.enum(['2d', '2.5d', '3d'])` (`export type DimensionalSpace = '2d' | '2.5d' | '3d'`).
- W sekcji **`Informacje`:**
  - `preferredSpace?: DimensionalSpace` (`.describe('Informacje :: Domyślna przestrzeń (2D / 2.5D / 3D)')`),
  - `spaces?: DimensionalSpace[]` (`.describe('Informacje :: Obsługiwane przestrzenie')`).
- W sekcji **`Powierzchnia & Tło`** (`material3d?: StyleMaterial3DSchema.optional()`):
  - `finish`: `'soft-clay' | 'frosted-glass' | 'retro-voxel' | 'matte-ceramic'` (`.describe('Powierzchnia & Tło :: Materiał brył 3D')`),
  - `bevelRadius`: `number` (`0..0.25`, `.describe('Powierzchnia & Tło :: Zaokrąglenie krawędzi 3D')`),
  - `studioHdr`: `'warm-softbox' | 'clean-atelier' | 'neon-grid'` (`.describe('Powierzchnia & Tło :: Oświetlenie studyjne HDR 3D')`).
- Funkcje pomocnicze eksportowane z `@make-pictures/core`:
  - `resolveStyleSpaces(style: StylePreset): { preferredSpace: DimensionalSpace; spaces: DimensionalSpace[] }`,
  - `resolveStyleMaterial3D(style: StylePreset): StyleMaterial3D`,
  - `filterStylesBySpace(styles: ReadonlyArray<StylePreset>, space: DimensionalSpace): StylePreset[]`.
- **Pełna otwartość na własne style (`styles/*.style.json`):** Użytkownik może stworzyć własny styl przypisany tylko do jednej przestrzeni (np. `spaces: ['3d']`) albo styl marki działający przekrojowo we wszystkich trzech (`spaces: ['2d', '2.5d', '3d']`), z własną paletą, typografią, optyką i profilem `material3d`.

### 1.2. Katalog 10 Wbudowanych Stylów (`BUILT_IN_STYLES`)
| ID stylu | Czytelna rola plastyczna | `preferredSpace` | `spaces` | `material3d.finish` |
| :--- | :--- | :---: | :---: | :---: |
| `minimal-product` | Nowoczesny / Czysty produkt | `2d` | `['2d', '2.5d']` | `frosted-glass` |
| `sketch-notebook` | Rysunek odręczny / Szkicownik | `2d` | `['2d', '2.5d']` | `soft-clay` |
| `retro-pc` *(NOWY)* | Retro-PC / Klasyczny CRT OS | `2d` | `['2d', '3d']` | `retro-voxel` |
| `brutalist-poster` | Plakat neo-brutalistyczny | `2d` | `['2d']` | `matte-ceramic` |
| `cyber-telemetry` | Ciemna telemetria / Hi-Tech | `2d` | `['2d', '3d']` | `frosted-glass` |
| `tactile-craft` | Wycinankowy Pop-Up | `2.5d` | `['2.5d']` | `soft-clay` |
| `editorial-press` | Kolaż prasowy / Magazyn | `2.5d` | `['2.5d', '2d']` | `matte-ceramic` |
| `archival-chronicle` | Kronika historyczna | `2.5d` | `['2.5d', '2d']` | `matte-ceramic` |
| `soft-clay` *(NOWY)* | Modelina / Soft-Clay 3D | `3d` | `['3d']` | `soft-clay` |
| `glass-studio` *(NOWY)* | Szkło i Metal / Spatial 3D | `3d` | `['3d', '2d']` | `frosted-glass` |

### 1.3. Nawigacja `2D | 2.5D | 3D` w Studio Web i CLI
- **Studio Web (`StyleLabShowcase.tsx` + `Topbar.tsx`):** Na górze panelu stylów pojawia się trójdzielny przełącznik przestrzeni **`[ 2D ]  [ 2.5D ]  [ 3D ]`**. Kliknięcie przestrzeni:
  1. Filtruje presety wbudowane do tych wspierających wybraną przestrzeń (zawsze zachowując sekcję *„Własne style (`styles/`)"* oraz przycisk utworzenia własnego stylu),
  2. Automatycznie przełącza zakładkę sceny podglądu na reprezentatywny widok `2D`, `2.5D` lub `3D`.
- **CLI (`@make-pictures/cli`):**
  - `npx make-pictures styles [--space=2d|2.5d|3d]` grupuje i filtruje style po przestrzeni,
  - `npx make-pictures new <slug> [--space=2d|2.5d|3d] [--style=<id>] [--kit=<id>]` automatycznie dobiera domyślny kit i styl dla wybranej przestrzeni (np. `--space=3d` → `isometric-3d` + `soft-clay`; `--space=2.5d` → `paper-diorama-3d` + `tactile-craft`; `--space=2d` → `motion-diagrams-2d` + `minimal-product` lub `retro-pc`).

---

## 2. Podprojekt B — Nowa Jakość Wizualna `3D` oraz Scenografie `2D Retro-PC` i `2.5D Apollo`

### 2.1. Proceduralny Rig Studyjny IBL Offline (`packages/kits/src/isometric-3d/StudioHdrRig3D.tsx`)
- Oparty na `<Environment resolution={256} frames={1}>` + `<Lightformer />` oraz `<ContactShadows />` z `@react-three/drei` — **zero zewnętrznych pobrań sieciowych `.hdr`** (100% deterministyczne i bezpieczne offline).
- 3 presety świetlne dopasowane do `material3d.studioHdr`:
  - `'warm-softbox'` (`soft-clay`): duży, ciepły górno-boczny softbox (`#FFF3E0`), kremowe światło dopełniające i miękki obrys krawędziowy (*rim*) dający plastyczne bliki na zaokrąglonej modelinie.
  - `'clean-atelier'` (`glass-studio`): chłodno-białe pasy studyjne o wysokim kontraście dające krystaliczne refleksy na szkle akrylowym i anodyzowanym metalu.
  - `'neon-grid'` (`retro-voxel`): bursztynowo-cyjanowe panele świetlne podkreślające fasetowane krawędzie wokseli.

### 2.2. Ekspresyjna Postać `<ClayCharacter3D>` i Diorama Studia Podcastowego (`PodcastStudioSet3D.tsx`)
- **`<ClayCharacter3D>` (`packages/kits/src/isometric-3d/ClayCharacter3D.tsx`):**
  - Zastępuje surowe „roboty z walców i kreski na oczach” ekspresyjną figurką w estetyce *Blender Soft-Clay / Vinyl Toy*:
    - Zaokrąglona głowa o miękkim profilu z delikatnymi rumieńcami policzków,
    - **Prawdziwe trójwymiarowe oczy:** wypukłe białka, barwne tęczówki, ciemne źrenice z jasnym punktem świetlnym (*catchlight*), **deterministyczne mruganie powiekami** (co ~`3.2 s` z przesunięciem fazowym `seed`) oraz ekspresyjne brwi unoszące się wraz z energią głosu `speechEnergy`,
    - Animowane usta reagujące miękko na sylabową obwiednię `speechEnergy` (`talkBounce = 0`),
    - Fazowany sweter/bluza (`RoundedBox` / `Capsule`), miękkie zaokrąglone dłonie i buciki oraz opcjonalne akcesoria: `accessory?: 'headphones' | 'glasses' | 'beanie' | 'none'`.
  - Obsługuje wszystkie 3 wykończenia `MeshPhysicalMaterial` (`soft-clay`, `frosted-glass`, `retro-voxel`).
- **`<PodcastStudioSet3D>` (`packages/kits/src/isometric-3d/PodcastStudioSet3D.tsx`):**
  - Przekrój przytulnego studia (*cutaway room*) zbudowany w całości z fazowanych brył `RoundedBox` (zero ostrych krawędzi `90°`!):
    - Grube, zaokrąglone ściany narożne z ciepłymi drewnianymi lamelami akustycznymi,
    - Podświetlany szyld studyjny `ON AIR` rzucający ciepłą poświatę, półka z winylami/książkami i doniczkową rośliną z miękkich liści,
    - Zaokrąglony dębowy stół podcastowy z dwoma ceramicznymi kubkami i **dwoma studyjnymi mikrofonami pojemnościowymi na przegubowych ramionach** skierowanymi ku rozmówcom.

### 2.3. Scenografia `2D • Retro-PC` i `2.5D • Kosmiczna Wycinanka`
- **`RetroPcWindowStage2D` (`packages/kits/src/motion-diagrams-2d/RetroPcWindowStage2D.tsx`):**
  - Komponent sceniczny dla stylu `retro-pc`: obramowanie klasycznego monitora/okna OS z lat 80./90. (pasek tytułowy z pikselowymi przyciskami, delikatna krzywizna i przeplot scanlines CRT, siatka pikseli, czytelne karty węzłów i animowany pasek transferu pakietów z licznikiem opóźnienia `ms`).
- **Kosmiczne motywy wycinankowe w `ScenicCutoutMotifs.tsx` (`packages/kits/src/paper-diorama-3d/ScenicCutoutMotifs.tsx`):**
  - `StarryCosmosBackdropCutout3D` + `EarthriseCutout3D` (błękitna Ziemia z kontynentami i chmurami wschodząca nad horyzontem),
  - `LunarCraterRidgeCutout3D` (wieloplanowe pasma księżycowych kraterów ze sztancowym obrysem),
  - `LunarLanderCutout3D` (wielowarstwowy lądownik *Apollo* ze złotą folią termiczną, rozstawionymi podporami i miękkim płomieniem hamującym).

---

## 3. Podprojekt C — Showreel Produktowy `Prompt → Rzeczywisty Efekt` (`productions/make-pictures-showreel/` v5)

### 3.1. Parametry Kompozycji i Ciągłości
- **Czas trwania:** `39.0 s` (`2340` klatek @ `60 FPS`), 4 kompozycje wyjściowe (`MakePicturesShowreelPL`, `MakePicturesShowreelEN`, `MakePicturesShowreelVerticalPL`, `MakePicturesShowreelVerticalEN`) masterowane do `-14 LUFS`.
- **Ciągłość (`<ContinuousSceneFlow crossDissolveFrames={42} />`):** 5 płynnie przenikających się scen (`300 + 570 + 570 + 570 + 330 = 2340` kl. — każda `>= 300f > 270f` wymogu bramki reżyserskiej `qa`!), z gwarancją `<= 1` aktywnego kontekstu `<ThreeCanvas>` w każdej klatce.

### 3.2. Dokładna Choreografia 5 Scen
1. **Scena 1 (`0..300`, `0.0–5.0 s`) — *Otwarcie Produktowe*:**
   - Czysta klatka `f=0`, po czym wyłania się konkretny nagłówek produktowy (*„Zobacz, jak z jednego zdania tworzysz super animacje.”* / *„See how one prompt becomes a finished animation.”*) oraz 3 wyraźne karty wyboru przestrzeni **`2D` • `2.5D` • `3D`**.
2. **Scena 2 (`300..870`, `5.0–14.5 s`) — *Przykład 1: `2D • Retro-PC`*:**
   - `localFrame 0..138` (`2.3 s`): Czytelna karta **`PromptCard`** z plakietką `2D • Styl: Retro-PC` i tekstem: *„Wyjaśnij jak działa zapytanie w sieci w stylu retro-pc”* / *„Explain how a web request works in retro-pc style”*.
   - `localFrame 138..570` (`7.2 s`): Karta płynnie otwiera pełnoekranowy `RetroPcWindowStage2D` w stylu `retro-pc`, gdzie animowany pakiet biegnie od `Twoja przeglądarka` przez `Serwer nazw` i `Serwer strony` do potwierdzenia `200 OK • Strona gotowa w 18 ms` (w `16:9` układ poziomy, w `9:16` pionowy terminal w `Golden Safe Box`).
3. **Scena 3 (`870..1440`, `14.5–24.0 s`, `usesThree: true`) — *Przykład 2: `2.5D • Wycinankowy`*:**
   - `localFrame 0..138` (`2.3 s`): Karta **`PromptCard`** z plakietką `2.5D • Styl: Wycinankowy` i tekstem: *„Opowiedz lądowanie Apollo 11 jako papierową wycinankę 2.5D”* / *„Tell the Apollo 11 landing as a 2.5D paper cutout”*.
   - `localFrame 138..570` (`7.2 s`): Nad księżycowym horyzontem rozkładają się wycinanki `StarryCosmosBackdropCutout3D`, `EarthriseCutout3D` i `LunarCraterRidgeCutout3D` (`Δz >= 0.55`), a `LunarLanderCutout3D` płynnie wyhamowuje i osiada na powierzchni Księżyca z miękkim cieniem PCF.
4. **Scena 4 (`1440..2010`, `24.0–33.5 s`, `usesThree: true`) — *Przykład 3: `3D • Modelina (Soft-Clay)`*:**
   - `localFrame 0..138` (`2.3 s`): Karta **`PromptCard`** z plakietką `3D • Styl: Modelina (Soft-Clay)` i tekstem: *„Pokaż rozmowę w studiu podcastowym jako animację z modeliny 3D”* / *„Show a podcast studio conversation in 3D soft clay”*.
   - `localFrame 138..570` (`7.2 s`): Kamera orbitalna `DirectorCamera3D` wchodzi do ciepłego `PodcastStudioSet3D` oświetlonego przez `StudioHdrRig3D` (`warm-softbox`), gdzie dwie figurki `<ClayCharacter3D accessory="headphones">` siedzą/stoją przy mikrofonach studyjnych, mrugają oczami 3D i gestykulują w rytmie mowy.
5. **Scena 5 (`2010..2340`, `33.5–39.0 s`) — *Własne Style i Finał*:**
   - Widok przełącznika `[ 2D ] [ 2.5D ] [ 3D ] + Własne style (styles/*.style.json)` przechodzący w czystą kartę finałową `make.pictures` z `npx create-make-pictures@latest`.

### 3.3. Warstwa Audio ElevenLabs (`39.0 s`, `-14 LUFS`)
- Lektor `Daniel` (`onwK4e9ZLuTAKqWW03F9`, `speed: 1.08`, czysta fonetyka bez skrótów i cyfr w `text`; nazwa marki wymawiana naturalnie jako `mejk pikczers` / `make pictures`, aktualizacja również w `sound-and-music-design/SKILL.md`):
  1. `scene1`: PL *„Zobacz, jak w mejk pikczers z jednego zdania powstają gotowe animacje.”* / EN *„See how make pictures turns a single sentence into a finished animation.”*
  2. `scene2`: PL *„Wybierz przestrzeń dwa de oraz styl retro pi si, by prosto wyjaśnić działanie sieci.”* / EN *„Pick two dee space in retro pee see style to explain a live network request.”*
  3. `scene3`: PL *„Przełącz na wycinankę dwa i pół de i opowiedz historię lądowania Apollo jedenaście.”* / EN *„Switch to two point five dee paper cutouts to bring the Apollo eleven landing to life.”*
  4. `scene4`: PL *„Albo wejdź w pełne trzy de z miękkiej modeliny i ożyw rozmowę w studiu podcastowym.”* / EN *„Or step into sculpted three dee soft clay for an expressive podcast studio scene.”*
  5. `scene5`: PL *„Twórz też własne style. Zacznij w mejk pikczers.”* / EN *„Or craft your own custom style. Start with make pictures.”*
- Dynamiczna, ciepła ścieżka muzyczna AI (`39 s` `composition-plan` z `SmartMusicBed` auto-duckingiem) oraz 5 dopasowanych efektów Foley (`prompt-key`, `retro-beep`, `lunar-thruster`, `mic-warm`, `finale-chime`).

---

## 4. Plan Weryfikacji
1. Testy jednostkowe i integracyjne dla `DimensionalSpace`, 10 `BUILT_IN_STYLES`, `StudioHdrRig3D` / `ClayCharacter3D`, `RetroPcWindowStage2D`, `LunarLanderCutout3D`, selektora `2D/2.5D/3D` w Studio Web oraz flag `--space` w CLI + `npm run pack:verify`.
2. Pełna kontrola wizualna nowych scen `3D` (`ClayCharacter3D` + `PodcastStudioSet3D`), `2.5D` (`Apollo 11`) i `2D` (`Retro-PC`) na zrzutach pełnej rozdzielczości `1080p` przez `read_file` przed renderem końcowym.
3. Synteza i odsłuch wszystkich plików `.mp3` przez `read_file`, twarda bramka `npx make-pictures qa` (bez `--allow-fast-cuts`) na wszystkich 4 kompozycjach (`16:9` + `9:16` w `PL` i `EN`) oraz mastering 4 plików MP4 do `-14 LUFS`.
