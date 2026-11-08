# 🎬 make.pictures — Otwarte Studio Video-as-Code (`60 FPS`)

<p align="center">
  <strong>Twórz profesjonalne animacje 60 FPS bezpośrednio z kodu (TypeScript, React, Three.js, Remotion, ElevenLabs) przy pomocy Google Antigravity oraz Claude Code.</strong>
</p>

<p align="center">
  <a href="https://make.pictures">🌐 make.pictures</a> •
  <a href="https://www.youtube.com/@makepicturespl">📺 YouTube (PL: @makepicturespl)</a> •
  <a href="https://www.youtube.com/@makepicturestv">📺 YouTube (EN: @makepicturestv)</a> •
  <a href="./README.md">🇬🇧 English Documentation (README.md)</a> •
  <a href="./LICENSE">⚖️ Licencja MIT</a>
</p>

> [!TIP]
> **Zacznij ze swoim agentem AI. Nie potrzebujesz wcześniej konta ani klucza API.**
>
> Wklej to do **Google Antigravity**, **Claude Code**, **Cursor** lub **Codex**. Skrypt zainstaluje zależności, zaloguje Cię lub założy konto ElevenLabs w przeglądarce, zapisze klucz `ELEVENLABS_API_KEY` w `.env.local` (bez pokazywania go na czacie) i przygotuje studio 60 FPS:
>
> ```text
> Skonfiguruj studio make.pictures: uruchom `npm run onboard` i wykonuj to, co wypisze.
> ```

---

## ✨ Czym jest `make.pictures`?

**make.pictures** to otwartoźródłowe studio **Video-as-Code**, zaprojektowane do natywnej współpracy z agentami AI (**Google Antigravity** oraz **Claude Code**).

Zamiast ręcznego ustawiania klatek kluczowych w After Effects czy modelowania w Blenderze, każda postać, wycinanka 2.5D z papieru, ruch kamery, promień triangulacji i diagram przepływu danych to deterministyczny program w **TypeScript + React**, renderowany w **60 klatkach na sekundę** i zsynchronizowany co do milisekundy z głosem lektora **ElevenLabs**.

- **Brak ograniczeń tematycznych i stylowych (Domain-Agnostic & Multi-Style):** Twórz historie naukowe, filmy edukacyjne, prezentacje architektury IT, dema produktowe oraz pionowe Shortsy / Reelsy (`9:16`).
- **Modularne Zestawy Wizualne (`src/kits/`):** Korzystaj z 3 gotowych kitów startowych (`paper-diorama-3d`, `isometric-3d`, `motion-diagrams-2d`) lub poproś agenta AI o wygenerowanie zupełnie nowego stylu wizualnego na życzenie.
- **Synchronizacja ze słowami lektora (Cache SHA-256):** Komenda `npm run voiceover` generuje pliki `.mp3` oraz dokładne timestampy słów `.json` przez API ElevenLabs (`eleven_multilingual_v2`), a w przypadku braku klucza API automatycznie uruchamia deterministyczny tryb offline.
- **Gotowa wiedza produkcyjna dla agenta (`AGENTS.md` i `CLAUDE.md`):** Wbudowane instrukcje automatycznie uczą Google Antigravity i Claude Code polskiej fonetyki w ElevenLabs, fizyki sprężyn `damping: 200`, unikania Z-fightingu w 3D oraz weryfikacji klatek kontrolnych PNG przed renderem.

---

## 🎨 Modularna Architektura Visual Kits (`src/kits/`)

| Zestaw wizualny (Kit) | Katalog | Główne komponenty | Zastosowanie |
| :--- | :--- | :--- | :--- |
| **1. Paper Diorama 3D** *(2.5D Pop-Up Book)* | [`src/kits/paper-diorama-3d/`](./src/kits/paper-diorama-3d) | `PaperCutout3D`, `PopUpHinge3D`, `PaperBookPageTurn3D`, `PaperStageLighting3D` | Storytelling, historie naukowe i historyczne, teatrzyk rozkładanej księgi 2.5D |
| **2. Isometric 3D Studio** | [`src/kits/isometric-3d/`](./src/kits/isometric-3d) | `Stylized3DCharacter`, `IsometricStudioEnvironment` | Dialogi postaci w izometrycznym studiu 3D, explainery technologiczne |
| **3. Motion Diagrams 2D** | [`src/kits/motion-diagrams-2d/`](./src/kits/motion-diagrams-2d) | `CameraRig` (nieskończona siatka), `NodeBox` (`portTop/Bottom/Left/Right`), `FlowCurve`, `DataFlowEdge`, `SystemNode` | Architektura systemów, przepływy danych, prezentacje produktów z kamerą One-Shot |
| **+ Nowe Kity AI** | [`src/kits/README.md`](./src/kits/README.md) | Generowane na życzenie przez Antigravity / Claude Code | Flat Vector 2D, Kinetic Typography, Low-Poly 3D, Retro Pixel, Data Storytelling |

---

## 🚀 Szybki Start

### Konfiguracja przez Agenta AI

Nie potrzebujesz wcześniej konta ani klucza API do ElevenLabs. Sklonuj repozytorium, otwórz je w **Google Antigravity**, **Claude Code**, **Cursor** lub **Codex** i wklej jedno zdanie:

```text
Skonfiguruj studio make.pictures: uruchom `npm run onboard` i wykonuj to, co wypisze.
```

Komenda `npm run onboard` ([`scripts/onboard.mjs`](./scripts/onboard.mjs), wykorzystująca pod spodem `@elevenlabs/cli onboard`) przejmuje prowadzenie i przekazuje agentowi kolejne kroki:
1. Instaluje zależności (`npm install`) oraz weryfikuje `ffmpeg`.
2. Otwiera jednorazowo przeglądarkę, abyś mógł zalogować się do ElevenLabs (lub założyć darmowe konto) i kliknąć **Authorize**.
3. Zapisuje klucz `ELEVENLABS_API_KEY` bezpośrednio w pliku `.env.local` (chronionym przez `.gitignore` — klucz **nigdy** nie pojawia się w oknie czatu).
4. Weryfikuje gotowość silnika Remotion `60 FPS` i pyta, jaką animację chcesz stworzyć.

*(Jeśli chcesz wywołać wyłącznie oficjalny kreator autoryzacji ElevenLabs CLI, wklej: ``Dodaj ElevenLabs do projektu: uruchom `npx -y @elevenlabs/cli@latest onboard init` i wykonuj to, co wypisze.``)*

### Konfiguracja ręczna

<details>
<summary><b>Wolisz ręczną konfigurację w terminalu? (Kliknij, aby rozwinąć)</b></summary>

```bash
git clone https://github.com/make-pictures/make-pictures-studio.git
cd make-pictures-studio
npm install
npm run setup
```

Otwórz utworzony plik `.env.local` i wklej swój klucz `ELEVENLABS_API_KEY` (klucz wygenerujesz w panelu [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)):

```env
ELEVENLABS_API_KEY=twoj_klucz_api_elevenlabs
ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Sprawdź gotowość środowiska jednym poleceniem:

```bash
npm run doctor
```
</details>

---

## 🛠️ Najważniejsze Komendy

| Komenda | Opis działania |
| :--- | :--- |
| `npm run onboard` | Automatyczny kreator dla agenta AI (`init` → logowanie w przeglądarce przez `@elevenlabs/cli` → `check`) |
| `npm run doctor` | Sprawdza wersję Node.js, FFmpeg, obecność `.env.local`, połączenie z API ElevenLabs oraz gotowość Remotion |
| `npm run setup` | Tworzy plik `.env.local` na podstawie `.env.example` i uruchamia diagnostykę `doctor` |
| `npm run voiceover` | Generuje pliki lektora `.mp3` oraz timestampy słów `.json` na podstawie `scenes.json` (z cache SHA-256) |
| `npm run studio` | Uruchamia podgląd na żywo w przeglądarce (`Remotion Studio` w `60 FPS`) |
| `npm run render` | Renderuje szablon startowy `StarterStory` (`16:9`, `1920×1080` @ `60 FPS`) do `out/starter-story.mp4` |
| `npm run render:vertical` | Renderuje pionowy szablon `StarterStoryVertical` (`9:16`, `1080×1920` @ `60 FPS`) |
| `npm run render:diorama` | Renderuje demo rozkładanej księgi 2.5D `PaperDioramaDemo` (`paper-diorama-3d` @ `60 FPS`, `--gl=angle`) |
| `npm run render:iso` | Renderuje demo dialogu `IsometricDialogueDemo` (`isometric-3d` @ `60 FPS`, `--gl=angle`) |
| `npm run render:diagrams` | Renderuje demo przepływu architektury `ArchitectureDemo` (`motion-diagrams-2d` @ `60 FPS`) |
| `npm run typecheck` | Weryfikuje poprawność typów TypeScript (`tsc --noEmit`) |

---

## 📦 Przykładowe Kompozycje w Repozytorium (`src/Root.tsx`)

1. **`StarterStory` oraz `StarterStoryVertical`** (`src/compositions/StarterStory.tsx`)
   Czysty, zwięzły szablon startowy `16:9` oraz `9:16` pokazujący użycie `CameraRig` (z nieskończoną siatką), matematycznych portów `NodeBox` (`portRight`, `portLeft`, `portTop`, `portBottom`), krzywych `FlowCurve` oraz synchronizacji ze słowami lektora.
2. **`PaperDioramaDemo`** (`src/compositions/PaperDioramaDemo.tsx`)
   Demo stylu 2.5D Paper Pop-Up Book prezentujące `PopUpBookBase3D`, `PopUpHinge3D`, `PaperCutout3D` oraz oświetlenie `PaperStageLighting3D` (`src/kits/paper-diorama-3d/`).
3. **`IsometricDialogueDemo`** (`src/compositions/IsometricDialogueDemo.tsx`)
   Wieloosobowy dialog w izometrycznym studiu 3D prezentujący płynną animację postaci (`Stylized3DCharacter` z rozdzieleniem `speakingWeight` od `speechEnergy`).
4. **`ArchitectureDemo` oraz `ProductPromo`** (`src/scenes/ArchitectureDemoScene.tsx`)
   Dynamiczny diagram architektury i przepływu pakietów danych (`DataFlowEdge`, `SystemNode`, `CodePayloadToast`).

---

## 🌐 Społeczność i Kanały YouTube

- **Strona główna:** [https://make.pictures](https://make.pictures)
- **YouTube (Polski):** [@makepicturespl](https://www.youtube.com/@makepicturespl)
- **YouTube (English):** [@makepicturestv](https://www.youtube.com/@makepicturestv)

---

## 📄 Licencja

Projekt udostępniany na otwartej licencji [MIT](./LICENSE). Możesz swobodnie wykorzystywać go do celów prywatnych, edukacyjnych i komercyjnych.
