<p align="center">
  <a href="https://make.pictures"><img src="./public/brand/make-pictures-logo.svg" alt="make.pictures — Twórz animacje z agentem AI" width="480" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-make-pictures"><img src="https://img.shields.io/badge/npm-v2.2.0-2563EB?style=for-the-badge&labelColor=0F172A" alt="npm v2.2.0" /></a>
  <img src="https://img.shields.io/badge/Agenci-Antigravity_%26_Claude_Code-0096C7?style=for-the-badge&labelColor=0F172A" alt="Antigravity & Claude Code" />
  <img src="https://img.shields.io/badge/Audio-ElevenLabs_Głos_•_Muzyka_•_SFX-7209B7?style=for-the-badge&labelColor=0F172A" alt="ElevenLabs Audio" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/Licencja-MIT-FF2A85?style=for-the-badge&labelColor=0F172A" alt="Licencja MIT" /></a>
</p>

<h3 align="center">Twórz animacje rozmawiając z agentem AI — i dopracuj każdy kadr wizualnie.</h3>

<p align="center">
  <a href="https://make.pictures">🌐 make.pictures</a> •
  <a href="https://www.youtube.com/@makepicturespl">📺 YouTube (PL)</a> •
  <a href="https://www.youtube.com/@makepicturestv">📺 YouTube (EN)</a> •
  <a href="./README.md">🇬🇧 English version</a>
</p>

---

## ⚡ Start jednym promptem

`1. Wklej w Antigravity lub Claude Code` → `2. Opisz pomysł i wybierz styl` → `3. Dopracuj i wyeksportuj MP4 w Studio Web`

```text
Przygotuj dla mnie studio filmowe make.pictures: uruchom `npx -y @make-pictures/cli@latest onboard --lang=pl` i wykonaj wszystkie kroki aż do uruchomienia podglądu Studio Web.
```

---

## 🖥️ Studio Web i 🎨 Style Lab (`v2.2.0`)

<p align="center">
  <img src="./docs/showcase/studio-web-liquid-glass.png" alt="make.pictures Studio Web — scena Liquid Glass, oś reżyserska, transkrypt i 3-zakładkowy inspektor" width="920" />
  <br />
  <sub><strong>Studio Web</strong> (<code>127.0.0.1:3000</code>) — podgląd na żywo, oś kamery/lektora/SFX/muzyki, transkrypcja słowo po słowie, 3-zakładkowy Inspektor (<code>⌘I</code>) i eksport MP4 jednym kliknięciem.</sub>
</p>

<p align="center">
  <img src="./docs/showcase/style-lab-grid.png" alt="make.pictures Style Lab — podgląd i edycja 7 gotowych stylów wizualnych" width="920" />
  <br />
  <sub><strong>🎨 Style Lab</strong> (<code>?view=styles</code>) — przełączaj 7 gotowych stylów kierownictwa artystycznego albo zapisz własny styl marki na żywo.</sub>
</p>

---

## 🎬 Co stworzysz w kilkanaście minut

| Dema produktów i SaaS (`product-frames`) | Przepływy danych i systemy (`motion-diagrams-2d`) |
| :---: | :---: |
| <img src="./docs/showcase/kit-product-promo.png" alt="Prezentacja interfejsu aplikacji SaaS" width="440" /> | <img src="./docs/showcase/kit-architecture-2d.png" alt="Animowany diagram przepływu danych 2D" width="440" /> |
| **Opowieści 2.5D Pop-Up (`paper-diorama-3d`)** | **Dialogi i wyjaśnienia 3D (`isometric-3d`)** |
| <img src="./docs/showcase/kit-paper-diorama-3d.png" alt="Rozkładana papierowa makieta 2.5D" width="440" /> | <img src="./docs/showcase/kit-isometric-dialogue-3d.png" alt="Izometryczna rozmowa postaci 3D" width="440" /> |

<sub>Oraz gotowe zestawy **Editorial Collage** (eseje i dokumenty), **Vector Scene 2D**, **Kinetic Typography** (dynamiczne napisy do Shorts), **Data Storytelling** (wyścigi słupków i osie czasu) i **VFX** — w poziomym `16:9` oraz pionowym `9:16` (`Golden Safe Box`).</sub>

---

## 🔄 Jak wygląda reżyseria z AI w praktyce

| 1. Pierwszy prompt (surowy szkic) | 2. Zmiana podejścia (płaskie 2D) | 3. Finałowy kadr 2.5D |
| :---: | :---: | :---: |
| <img src="./docs/showcase/stage1-v1-calcutta.jpg" alt="Etap 1: surowy prototyp 3D" width="290" /> | <img src="./docs/showcase/stage2-v2-calcutta.jpg" alt="Etap 2: płaska próba 2D" width="290" /> | <img src="./docs/showcase/stage3-v8-calcutta.jpg" alt="Etap 3: gotowa scena wycinankowa 2.5D" width="290" /> |

<p align="center">
  <a href="https://www.youtube.com/watch?v=4t-hVA3OxSY"><img src="./docs/showcase/thumbnail-pl-1280x720.png" alt="Obejrzyj pełny film przykładowy na YouTube" width="640" /></a>
  <br />
  <sub>▶ <a href="https://www.youtube.com/watch?v=4t-hVA3OxSY"><strong>Zobacz gotowy film 2:42 na YouTube</strong></a> — głos, muzyka, efekty dźwiękowe i każdy ruch kamery powstały w <code>make.pictures</code>.</sub>
</p>

---

## 🛠️ Dla developerów — 4 sposoby użycia

```bash
# 1. Osobny projekt studia wideo
npx create-make-pictures@latest moje-filmy --lang=pl && cd moje-filmy && npx make-pictures studio

# 2. Wewnątrz istniejącej aplikacji Next.js / Vite / SaaS (użyj własnych komponentów React lub nagrań .mp4)
npm i -D @make-pictures/cli @make-pictures/studio @make-pictures/core @make-pictures/kits
npx make-pictures init --dir=videos --lang=pl && npx make-pictures studio --dir=videos

# 3. Interaktywne osadzenie na stronie WWW (żywy React / WebGL przez @remotion/player bez kodowania MP4)
npm i @make-pictures/core @make-pictures/kits @remotion/player remotion zod lucide-react

# 4. Instalacja samych skilli agenta AI (skills.sh — Claude Code, Cursor, Antigravity)
npx skills add make-pictures/make-pictures-studio
```

<details>
<summary><strong>📦 Pakiety npm i ściąga komend CLI (<code>v2.2.0</code>)</strong></summary>

<br />

| Pakiet | Rola |
| :--- | :--- |
| `create-make-pictures` | Szybki kreator projektu (`npx create-make-pictures@latest <katalog>`) |
| `@make-pictures/core` | Silnik `60 FPS`, 7 stylów `StylePreset`, kamery `DirectorCamera3D/2D`, `SmartMusicBed`, `SoundCue` |
| `@make-pictures/kits` | 7 zestawów scenicznych + `product-frames` + efekty optyczne `vfx` |
| `@make-pictures/studio` | Lokalny warsztat **Studio Web** i **🎨 Style Lab** (interfejs `Liquid Glass`, oś czasu, inspektor) |
| `@make-pictures/cli` | Narzędzie `make-pictures` + 9 automatycznie wykrywanych skilli `SKILL.md` dla Antigravity i Claude Code |

| Komenda | Działanie |
| :--- | :--- |
| `npx make-pictures onboard` | Logowanie do ElevenLabs w przeglądarce i konfiguracja studia |
| `npx make-pictures studio` | Uruchomienie **Studio Web** i **🎨 Style Lab** na `http://127.0.0.1:3000` |
| `npx make-pictures new <slug>` | Nowa kapsuła filmu (`--kit=...`, `--style=...`, `--lang=pl\|en`) |
| `npx make-pictures styles` | Lista gotowych i własnych stylów `styles/*.style.json` (`style new <slug>` tworzy nowy) |
| `npx make-pictures audio` | Generowanie lektora z czasami słów, muzyki z auto-duckingiem i efektów SFX |
| `npx make-pictures qa <Id>` | Styk 12 klatek kontrolnych PNG (`out/qa-<Id>.png`) z ramkami `9:16` |
| `npx make-pictures render <Id>` | Eksport filmu MP4 `60 FPS` zmasterowanego do `-14 LUFS` |

</details>

---

<p align="center">
  Licencja MIT • <a href="https://make.pictures">make.pictures</a> • <a href="https://buycoffee.to/makepictures">☕ Postaw mi kawę</a>
</p>
