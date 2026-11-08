# AGENTS.md — Universal Video-as-Code Production Guide (`make.pictures`)

Ten plik jest automatycznie ładowany przez agenta **Google Antigravity** (oraz inne środowiska agentowe obsługujące `AGENTS.md`) w repozytorium `make-pictures-studio` ([https://make.pictures](https://make.pictures)). Definiuje kompletny proces twórczy **od pomysłu do gotowego filmu 60 FPS** oraz bezwzględne reguły techniczne, wizualne i lektorskie.

---

## 0. Interaktywny Workflow Agenta: Konfiguracja Studia i Produkcja Animacji (`60 FPS`)

### Krok 0: Pierwsze uruchomienie i konfiguracja studia (`npm run onboard`)
Gdy użytkownik otwiera repozytorium po raz pierwszy lub wkleja prompt `Skonfiguruj studio make.pictures: uruchom npm run onboard i wykonuj to, co wypisze`:
1. Uruchom `npm run onboard` (`scripts/onboard.mjs`) i ściśle wykonuj kolejne kroki zwracane w JSON (`next`, `instruction`, `run`, `say`).
2. Skrypt sam zweryfikuje obecność `node_modules` i `ffmpeg`, a następnie wywoła oficjalny przepływ autoryzacji `@elevenlabs/cli@latest onboard connect --env-path .env.local`, który otwiera przeglądarkę i zapisuje klucz `ELEVENLABS_API_KEY` prosto do `.env.local` (nigdy nie proś o wklejenie klucza API na czacie ani nie wypisuj zawartości `.env.local`).
3. Po zakończeniu `npm run onboard -- check` zapytaj użytkownika o temat pierwszego filmu `60 FPS` lub zaproponuj uruchomienie podglądu `npm run studio`.

Gdy użytkownik prosi o stworzenie nowego filmu, animacji lub odcinka, prowadź go krok po kroku przez poniższy 6-etapowy proces produkcyjny:

### Krok 1: Krótki wywiad kreatywny i wybór stylu (`Visual Kit`)
Ustal z użytkownikiem (lub zaproponuj domyślnie, jeśli dał wolną rękę):
1. **Temat, cel i grupa docelowa** (np. historia naukowa, edukacyjny explainer, prezentacja produktu/architektury, opowieść fabularna).
2. **Język i obsada głosowa** (PL / EN, jeden narrator czy dialog wielu postaci z różnymi głosami ElevenLabs).
3. **Format docelowy:** poziomy `16:9` (`1920×1080`), pionowy Shorts/Reels `9:16` (`1080×1920`) lub oba naraz.
4. **Styl wizualny (`src/kits/`):**
   - `paper-diorama-3d` — teatrzyk 2.5D Paper Pop-Up Book z wycinankami z kartonu i rzucaniem cieni 3D (`PaperCutout3D`, `PopUpHinge3D`, `PaperBookPageTurn3D`, `PaperStageLighting3D`),
   - `isometric-3d` — izometryczne studio 3D z postaciami prowadzącymi dialog (`Stylized3DCharacter`, `IsometricStudioEnvironment`),
   - `motion-diagrams-2d` — dynamiczne diagramy 2D, prezentacje systemów i kamera „One-Shot” na nieskończonym płótnie (`CameraRig`, `NodeBox`, `portTop/Bottom/Left/Right`, `FlowCurve`, `DataFlowEdge`),
   - **Nowy, dedykowany Visual Kit (`src/kits/<nazwa-kitu>/`)** — jeśli użytkownik życzy sobie zupełnie innego stylu (np. *Flat Vector 2D*, *Kinetic Typography*, *Low-Poly 3D*, *Retro Pixel*, *Data Storytelling*), wygeneruj dla niego nowy modularny kit w `src/kits/`.

### Krok 2: Scenariusz i definicja scen w `scenes.json`
1. Rozpisz angażujący scenariusz podzielony na sceny lub zwięzłe kwestie dialogowe w pliku `scenes.json`.
2. Przypisz każdej scenie unikalne `id`, `voiceId`, opcjonalnie `speaker` oraz `voiceSettings`.
3. Zastosuj **zapis fonetyczny** dla trudnych skrótowców, liczb lub obcojęzycznych nazw własnych (szczegóły w Sekcji 5), aby model `eleven_multilingual_v2` wymówił je perfekcyjnie.

### Krok 3: Generowanie lektora (`npm run voiceover`) i obowiązkowy odsłuch `.mp3`
1. Uruchom `npm run doctor` (jeśli to pierwsza sesja), aby upewnić się, że klucz `ELEVENLABS_API_KEY` w `.env.local` oraz `ffmpeg` są gotowe.
2. Uruchom `npm run voiceover` (`scripts/generate-voiceover.ts`). Skrypt wygeneruje pliki `/public/voiceovers/{sceneId}.mp3`, dokładne timestampy słów `.json` (z cache SHA-256) oraz zaktualizuje `src/generated/voiceover-data.ts`.
3. **OBOWIĄZKOWY ODSŁUCH:** Odczytaj każdy nowo wygenerowany plik `/public/voiceovers/{sceneId}.mp3` za pomocą narzędzia `read_file`, aby osobiście zweryfikować wymowę, intonację i brak uciętych końcówek słów.

### Krok 4: Implementacja animacji `60 FPS` i synchronizacja z głosem
1. Zbuduj kompozycję w `src/compositions/` i zarejestruj ją w `src/Root.tsx` (`fps={60}`).
2. Synchronizuj ruch kamery, wejścia kart i gesty postaci z dokładnymi klatkami wypowiadanych słów za pomocą `getWordTriggerFrame(sceneId, word, fallbackFrame)` (`src/utils/timestamps.ts`) oraz `getSpeechStateAtFrame(sceneId, localFrame)` (`src/utils/dialogue.ts`).

### Krok 5: Weryfikacja klatek kontrolnych (`npx remotion still`)
1. Przed uruchomieniem pełnego renderu wideo wygeneruj klatki kontrolne PNG (`npx remotion still src/index.ts <CompositionId> out/check.png --frame=<N>`) dla klatki `0`, przejść między scenami oraz kluczowych momentów każdej sceny.
2. Obejrzyj wygenerowane pliki PNG narzędziem `read_file` i napraw wszelkie kolizje tekstów, ucięte nagłówki lub błędy głębi `Z`.

### Krok 6: Renderowanie finalnego MP4 (`16:9` oraz `9:16`)
1. Uruchom `npm run typecheck` (`tsc --noEmit`), aby potwierdzić brak błędów typów.
2. Wyrenderuj gotowy film MP4 w `60 FPS` (dla scen 3D zawsze z flagą `--gl=angle --concurrency=100%`).

---

## 1. Jedno Źródło Prawdy dla Współrzędnych i Portów (`NodeBox` w `motion-diagrams-2d`)

- **Zakaz ręcznego zgadywania współrzędnych linii:** Nigdy nie wpisuj osobnych, przybliżonych liczb `(x, y)` dla kart HTML i osobnych dla krzywych SVG.
- **Słownik węzłów (`WORLD_NODES` / `VERTICAL_WORLD_NODES`):** Każdy blok na płótnie 2D musi być zdefiniowany w jednym słowniku jako `NodeBox` (`{ cx, cy, w, h }` z `src/kits/motion-diagrams-2d/NodeBox.tsx`).
- **Funkcje portów:** Wszystkie linie łączące bloki (`FlowCurve` / `DataFlowEdge`) muszą zaczynać się i kończyć wyłącznie na matematycznych portach krawędziowych wyliczanych z `NodeBox`:
  - `portTop(node, dx)` — górna krawędź bloku
  - `portBottom(node, dx)` — dolna krawędź bloku
  - `portLeft(node, dy)` — lewa krawędź bloku
  - `portRight(node, dy)` — prawa krawędź bloku
- **Zakaz przecinania nagłówków przez linie:**
  - Nigdy nie prowadź pionowej linii przez środek tytułu sekcji ani wzdłuż bocznej krawędzi karty.
  - Linia prowadząca do kolejnej sekcji poniżej powinna wychodzić z dolnej krawędzi (`portBottom`) bloku źródłowego i — jeśli po drodze znajduje się nagłówek — omijać go szerokim, płynnym łukiem bocznym za pomocą parametru `curveX` (np. `curveX={-240}`).

---

## 2. Kamera „One-Shot” i Nieskończone Tło (`src/kits/motion-diagrams-2d/CameraRig.tsx`)

- **Zakaz umieszczania skończonego tła wewnątrz transformowanego kontenera 3D:**
  - Tworzenie dużego `div` z siatką wewnątrz kontenera z `perspective` i `rotateX` powoduje obcinanie tekstury przez bufor GPU Chromium przy oddaleniu kamery (`zoom ~ 0.5x`), co skutkuje pustymi pasami na brzegach ekranu.
- **Nieskończona siatka przypięta do viewportu:**
  - Tło i siatka techniczna (`backgroundImage` w `CameraRig.tsx`) muszą być przypięte bezpośrednio do `AbsoluteFill` viewportu, a ich pozycja i gęstość wyliczane matematycznie z pozycji kamery:
    - `gridSpacing = Math.max(24, 80 * cam.zoom)`
    - `gridOffsetX = (stageWidth / 2) - cam.x * cam.zoom`
    - `gridOffsetY = (stageHeight / 2) - cam.y * cam.zoom`
- **Czysta transformacja 2D kontenera świata:**
  - Kontener świata używa `width: 0; height: 0; transformOrigin: '0 0'` oraz transformacji `translate3d(centerX, centerY, 0) scale(zoom) rotate(rotateZ) translate3d(-cam.x, -cam.y, 0)`.
- **Pusta plansza w klatce `0` (`frame = 0`):**
  - Pierwsza klatka filmu (`frame = 0`) musi przedstawiać czystą planszę tła bez częściowo wyrenderowanych bloków. Animacja wejścia pierwszej sekcji powinna startować od `frame - 2` (`spring({ frame: frame - 2 })`), co gwarantuje `opacity: 0` w klatce `0`.

---

## 3. Minimalizm Wizualny i Typografia (Krótkie Formy 30–60 s)

- **Zakaz ścian tekstu:** W dynamicznych filmach 30–60 s widz nie jest w stanie przeczytać wielozdaniowych opisów, tabel ani długich bloków kodu.
- **Zasada „Ikona + 2–3 słowa + wizualny wskaźnik”:**
  - Zastępuj długie opisy wyrazistymi ikonami (`lucide-react`), krótkimi hasłami (2–3 słowa) oraz wizualnymi elementami stanu (paski postępu, kafelki graficzne, odznaki statusu).
- **Brak napisów (subtitles) na dole ekranu:**
  - Domyślnie **nie dodawaj** paska napisów lektora na dole ekranu — wystarcza czysty głos lektora i czytelna grafika. Napisy (`VoiceoverCaptionBar`) dodawaj wyłącznie na wyraźne życzenie użytkownika.
- **Polskie reguły wielkich i małych liter (Sentence case):**
  - W polskojęzycznych materiałach nigdy nie używaj anglosaskiego `Title Case` (wielkiej litery w każdym słowie).
  - Wielką literę stosuj wyłącznie na początku wyrażenia oraz w skrótowcach i nazwach własnych.
- **Perspektywa odbiorcy w hasłach:**
  - Nagłówki i hasła podsumowujące formułuj z perspektywy korzyści lub ciekawości odbiorcy, a nie suchej cechy technicznej.

---

## 4. Tempo Animacji i Przepływu (`60 FPS`)

- **Fizyka sprężyn (`SPRING_PRESETS` w `src/theme/tokens.ts`):** Zawsze używaj wysokiego tłumienia (`damping: 200`), aby ruch kamery, kart i postaci był płynny i pozbawiony gumowego odbijania.
- **Naturalna prędkość impulsów/kropek na liniach:**
  - Przy `60 FPS` nigdy nie ustawiaj przelotu pakietu poniżej `60` klatek (wygląda to zbyt nerwowo).
  - Optymalny czas przelotu (`packetSpeedFrames`) wynosi **`92–120` klatek (1,5–2,0 s)** przy `packetCount={2}` (maksymalnie `3` na najdłuższych połączeniach).

---

## 5. Lektor ElevenLabs i Fonetyka (`scripts/generate-voiceover.ts`)

- **Zapis fonetyczny skrótowców i domen w `scenes.json` (model `eleven_multilingual_v2`):**
  - Model wielojęzyczny potrafi przeczytać skrótowce i domeny z obcym akcentem, jeśli są zapisane standardowo. W polu `text` w `scenes.json` stosuj zapis fonetyczny:
    - Skrótowce literowane po polsku zapisuj rozdzielnie ze spacjami zgodnie z polską wymową poszczególnych liter (np. `e er p` zamiast `ERP`).
    - Domeny internetowe zapisuj słownie (np. `mejk kropka pikczers` w PL lub `make dot pictures` w EN).
- **Sprawdzone profile głosów:**
  1. **Głos dynamiczny (domyślny narrator / młody bohater):** `TX3LPaxmHKxFdv7VOQHJ` (*Liam*)
     - Ustawienia: `stability: 0.35`, `similarityBoost: 0.78`, `style: 0.55`, `speed: 1.1`, `useSpeakerBoost: true`.
     - Lubi wykrzykniki (`!`) na końcach kluczowych zdań, co nadaje nagraniu energię.
  2. **Głos spokojniejszy / analityczny:** `CLuTGacrAhcIhaJslbXt`
     - Ustawienia: `stability: 0.58`, `similarityBoost: 0.80`, `style: 0.18`, `speed: 1.0`, `useSpeakerBoost: true`.
     - Wymaga kropek (`.`) zamiast wykrzykników i wyższego `stability`, aby nie ucinać końcówek słów.
  3. **Dodatkowe głosy charakterne do dialogów wieloosobowych:**
     - `nPczCjzI2devNBz1zQrb` (*Brian* — starszy autorytet / pułkownik)
     - `pNInz6obpgDQGcFmaJgB` (*Adam* — dyrektor / narrator dokumentalny)
     - `N2lVS1w4EtoT3dr4eOWO` (*Callum* — asystent / rachmistrz)
     - `pqHfZKP75CvOlQylNhV4` (*Bill* — sędziwy arystokrata)
- **Obowiązkowy odsłuch pliku `.mp3` przed renderowaniem wideo:**
  - Po każdym wygenerowaniu lektora (`npm run voiceover`) agent **musi** odczytać plik `/public/voiceovers/{sceneId}.mp3` narzędziem `read_file`, aby zweryfikować wymowę wszystkich skrótowców, nazw własnych i końcówki nagrania przed uruchomieniem renderowania MP4.

---

## 6. Dedykowana Wersja Pionowa `9:16` (`1080×1920`) na Telefon (Shorts / Reels / TikTok)

- **Zakaz prostego pomniejszania wersji `16:9`:** Wersja pionowa na social media (`1080×1920`) musi korzystać z dedykowanego układu pionowego (`VERTICAL_WORLD_NODES` w 2D lub dedykowanych trajektorii kamery `ShotKeyframe` o wyższym `fov` i większym dystansie `Z` w 3D).
- **Zasady kompozycji `9:16` w 2D:**
  - Karty wewnątrz każdej sekcji układamy kaskadowo **góra–dół** (lub w zwartych rzędach o szerokości do `900 px`), dzięki czemu przy `zoom: 1.0` są duże i czytelne na ekranie telefonu.
  - Środek kamery (`cam.y`) dla każdej sekcji musi być wyliczony dokładnie jako środek pionowego zakresu `[topNagłówka, bottomDolnejKarty]`, aby przy lekkich ruchach kamery górny nagłówek nigdy nie wyszedł poza górną krawędź ekranu.
- **Zasady kompozycji `9:16` w 3D:**
  - Używaj górnego banera HUD z pytaniem otwierającym (Hook) oraz dolnego paska postępu lub karty mówcy, utrzymując główną akcję 3D w bezpiecznym centralnym oknie pionowego kadru.

---

## 7. Obowiązkowa Weryfikacja Klatek Kontrolnych (`remotion still`)

Zanim uruchomisz pełny, kilkuminutowy render wideo (`npm run render` lub `npx remotion render`):
1. Wygeneruj szybkie klatki kontrolne PNG (`npx remotion still src/index.ts <CompositionId> out/check.png --frame=<klatka> --gl=angle`) dla:
   - klatki `0` (weryfikacja pustej planszy startowej),
   - klatki przejścia między sekcjami,
   - każdej z głównych sekcji.
2. Obejrzyj wygenerowane pliki PNG za pomocą `read_file` i upewnij się, że żaden nagłówek nie jest ucięty, żadna linia nie przecina tekstu, a elementy 3D nie nachodzą na siebie.
3. Dopiero po pozytywnej weryfikacji klatek uruchom pełny render `60 FPS`.

---

## 8. Naturalna Animacja Postaci 3D i Dialogów (`src/kits/isometric-3d/` & `@remotion/three`)

- **Rozdzielenie obwiedni zdania (`speakingWeight`) od energii sylab (`speechEnergy`):**
  - Nigdy nie podpinaj surowej energii pojedynczych słów (`speechEnergy`, która spada do `0` między wyrazami) bezpośrednio do stawów ramion, łokci, tułowia, głowy ani skali kart HUD — powoduje to nerwowe drganie postaci na każdym słowie.
  - Postawa ciała, gestykulacja, poświata w podłodze oraz aktywacja karty rozmówcy muszą być sterowane ciągłą obwiednią całej wypowiedzi (`speakingWeight: 0..1` z funkcji `getSpeechStateAtFrame` w `src/utils/dialogue.ts`), która płynnie narasta na początku zdania i opada dopiero po jego zakończeniu.
  - Wygładzona filtrem dolnoprzepustowym energia sylab (`speechEnergy`) służy wyłącznie do animowania korektora ust na wizjerze, klatki ust wycinanki i pasków fali dźwiękowej.
- **Zakaz skokowych przełączeń gestów (`0 / 1`):**
  - Każda zmiana pozy rąk lub zwrotu głowy (`gestureWeights`, `headYawOffset`) musi przechodzić przez funkcję `getSmoothPoseWindow` (`src/utils/dialogue.ts`) opartą na ciężkiej sprężynie `SPRING_PRESETS.calmPose` (`damping: 200, stiffness: 26, mass: 1.4`), aby przejścia między gestami trwały naturalnie ok. `0,75 s`.
- **Limity częstotliwości ruchu przy `60 FPS`:**
  - Oddech, delikatne kołysanie dłoni podczas mówienia oraz lewitacja obiektów 3D muszą używać niskich częstotliwości kątowych w zakresie `frame * 0.03` do `frame * 0.055` (pełny cykl co `2–3,5 s`). Nigdy nie używaj na ciele postaci ani rekwizytach tła mnożników `frame * 0.1+` ani pionowego podskakiwania tułowia (`talkBounce = 0`).
  - Ruch kamery prowadź na sprężynie `SPRING_PRESETS.calmCamera` (`damping: 200, stiffness: 22, mass: 1.6`).
- **Renderowanie ze sprzętową akceleracją GPU:**
  - Kompozycje 3D (`ThreeCanvas`) renderuj zawsze z flagą `--gl=angle` (`remotion render ... --fps=60 --gl=angle`), co wykorzystuje natywny układ GPU i przyspiesza render wielokrotnie.

---

## 9. Styl 2.5D „Paper Mario / Pop-Up Book” (`src/kits/paper-diorama-3d/`)

- **Prawdziwa przestrzeń 3D dla płaskich wycinanek (`PaperCutout3D`):**
  - Nigdy nie imituj stylu 2.5D płaskim 2D SVG. Wszystkie postacie, rekwizyty i karty muszą być wycinankami z charakterystyczną kremowo-białą krawędzią (`whiteBorderPx`) oraz fizyczną grubością tektury (`thickness`), rozmieszczonymi na wielu planach głębokości `Z` w `ThreeCanvas` z włączonym rzucaniem cieni (`castShadow`, `receiveShadow`) i dynamicznym oświetleniem teatralnym (`PaperStageLighting3D`).
- **Zakaz nakładania wycinanek na tej samej płaszczyźnie `Z` (brak Z-fightingu / „glitchowania”):**
  - Nigdy nie umieszczaj dwóch zachodzących na siebie brył `PaperCutout3D` lub `mesh` na tym samym (lub zbyt bliskim) `z` — przy ruchu kamery lub kołysaniu postaci bufor głębokości WebGL (`z-buffer`) powoduje migotanie i przenikanie się siatek.
  - Zachowuj minimum **`Δz >= thickness_A / 2 + thickness_B / 2 + 0.03 m`** odstępu między kolejnymi warstwami (np. tło skrzynki → popiersie → ramię → tabliczka z podpisem), a grupy stojących obok siebie postaci w jednym rzędzie (np. tragarze z drągiem) rysuj na wspólnej wycinance `PaperCutout3D` dla danego planu `Z`.
- **Marginesy kanwy na białą obwódkę papieru (brak przyciętych krawędzi):**
  - Ponieważ `PaperCutout3D` generuje białą obwódkę przez dylatację kanału alfa o `whiteBorderPx`, każdy kształt rysowany w `draw(ctx)` musi zachować co najmniej **`whiteBorderPx + lineWidth + 12 px`** wolnego odstępu od wszystkich czterech brzegów bufora `pixelWidth × pixelHeight` (szczególnie dolnej krawędzi kart i dymków).
- **Czysta scena bez centralnego grzbietu książki i bez przecinania modeli przy zmianie stron:**
  - **Zakaz grzbietu na środku (`x = 0`):** Nie umieszczaj pionowego walca/grzbietu książki na środku sceny, ponieważ przecina on biurka i postacie.
  - **Trójfazowe przewracanie stron i chowanie kart (`PopUpHinge3D` + `PaperBookPageTurn3D`):** Nigdy nie prowadź obracającej się strony przez stojące figurki i nigdy nie zmniejszaj sceny głównej (`scale ~ 0.05`) za kartami zbliżeń (powoduje to prześwitywanie miniaturowych postaci w szczelinie między kartami). Stosuj sekwencyjną choreografię na zawiasach podłogowych:
    1. Elementy schodzące składają się całkowicie na płasko do podłogi (`foldProgress: 1 → 0` na `Easing.inOut(Easing.cubic)`).
    2. Dopiero gdy `foldProgress <= 0.02`, przelatuje płaski arkusz `PaperBookPageTurn3D` lub podnoszą się elementy nowej sceny (`0 → 1`).
  - Podczas otwierającego zjazdu kamery znad chmur (`frame 0..80`) pierwszy plan obozu/sceny trzymaj złożony i rozkładaj go dopiero w momencie lądowania kamery, aby kamera nie przecinała głów postaci u dołu ekranu.
- **Matematyczna precyzja promieni 3D i brak kolizji z postaciami:**
  - Wszystkie linie celownicze, promienie triangulacyjne, wiązki lasera oraz flagi na szczycie muszą używać dokładnie tego samego punktu docelowego `[x, y, z]` wierzchołka geometrii 3D.
  - Żaden promień ani element scenografii (np. koło teodolitu, stosy ksiąg) nie może przecinać twarzy postaci ani zasłaniać napisów na szyldach i oknach.
- **Zakaz obracania jednowarstwowych wycinanek postaci o `180°` wokół osi Y:**
  - Przy podchodzeniu postaci do tablicy lub rekwizytu postać pozostaje zwrócona przodem (`3/4` do kamery) z lekkim podskokiem kroku (`stepBob`), a trzymane w dłoni klocki/tabliczki mają skontrowany obrót ramienia (`rotation={[0, 0, -armRad]}`), aby cyfry i napisy zawsze były pionowe i czytelne.
- **Ciągłość zmian pogody, oddech montażowy i warstwa ambientowa:**
  - Zmiany pór dnia, pór roku i pogody za oknem animuj wyłącznie płynnie (`interpolateColors`, `getSmoothPoseWindow`), bez skokowych warunków klatkowych.
  - Zachowuj naturalne pauzy oddechowe między scenami (`32–42` klatki) oraz po puentach komediowych (`20–28` klatek), a pod dialogami utrzymuj subtelną warstwę muzyczno-ambientową (`volume: 0.10–0.18`), aby uniknąć głuchej ciszy między efektami foley.
