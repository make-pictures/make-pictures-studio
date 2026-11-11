<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures — Open-source 60 FPS Video-as-Code Studio" width="420" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/studio"><img src="https://img.shields.io/npm/v/@make-pictures/studio?style=for-the-badge&labelColor=0F172A&color=FF2A85&label=%40make-pictures%2Fstudio" alt="@make-pictures/studio on npm" /></a>
  <img src="https://img.shields.io/badge/Studio_Web_2.0-0096C7?style=for-the-badge&labelColor=0F172A" alt="Studio Web 2.0" />
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Studio-2563EB?style=for-the-badge&labelColor=0F172A" alt="make.pictures Studio" /></a>
</p>

# `@make-pictures/studio`

Local `60 FPS` **Studio Web** client (`<StudioApp />`) and programmatic Vite server (`startStudioServer`) for [`make.pictures`](https://make.pictures).

## Exports

- `@make-pictures/studio` / `@make-pictures/studio/client` — `<StudioApp compositions={...} />`, `zod` Props Inspector, Multi-Track Director Timeline (`Camera Cuts`, `Voiceover`, `SFX Cues`, `SmartMusicBed` auto-ducking envelope), and 12-frame Contact-Sheet QA viewer.
- `@make-pictures/studio/server` — `startStudioServer({ rootDir, studioDir, port, host })` and `makePicturesStudioServerPlugin({ rootDir, studioDir })`.
- `@make-pictures/studio/styles.css` — Studio Web stylesheet.

## Usage

```ts
import { startStudioServer } from '@make-pictures/studio/server';

const { url, close } = await startStudioServer({ rootDir: process.cwd(), port: 3000 });
console.log(`Studio Web running at ${url}`);
```

Most projects simply run `npx make-pictures studio` (or `npx make-pictures studio --dir=videos` inside an existing app).

## Links

- Website: [make.pictures](https://make.pictures)
- Source & docs: [github.com/make-pictures/make-pictures-studio](https://github.com/make-pictures/make-pictures-studio)
- YouTube: [@makepicturestv](https://www.youtube.com/@makepicturestv) (EN) · [@makepicturespl](https://www.youtube.com/@makepicturespl) (PL)

## License

MIT © [make.pictures](https://make.pictures)
