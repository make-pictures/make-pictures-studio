<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures — Production & Audio/QA Toolkit CLI for Remotion" width="420" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/cli"><img src="https://img.shields.io/npm/v/@make-pictures/cli?style=for-the-badge&labelColor=0F172A&color=FF2A85&label=%40make-pictures%2Fcli" alt="@make-pictures/cli on npm" /></a>
  <img src="https://img.shields.io/badge/Remotion-4.x_Add--On-7209B7?style=for-the-badge&labelColor=0F172A" alt="Remotion 4 Add-On" />
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Toolkit-2563EB?style=for-the-badge&labelColor=0F172A" alt="make.pictures Toolkit" /></a>
</p>

# `@make-pictures/cli`

Production, ElevenLabs Audio, Asset Hygiene, Director QA, and Remotion Elements CLI for **any standard Remotion 4 project**.

Works in fresh projects (`npx create-make-pictures@latest my-films`), existing `create-video` Remotion repositories (`npx make-pictures init`), and embedded app directories (`npx make-pictures init --dir=videos`) with zero lock-in. Optional `make-pictures.json` overrides default paths (`entryPoint`, `publicDir`, `videosDir`, `stylesDir`, `lang`, `fps`).

## Commands

```bash
# 3-mode onboarding (empty dir, existing Remotion repo, or existing app) + tandem skills + optional ElevenLabs auth
npx -y @make-pictures/cli@latest onboard --lang=en
npx make-pictures doctor

# Add @make-pictures/remotion & bundled AI skills to an existing Remotion repo without touching src/Root.tsx
npx make-pictures init
npx make-pictures init --dir=videos

# Launch native Remotion Studio (`remotion studio <entryPoint>`)
npx make-pictures studio

# List 10 built-in & custom styles (--space=2d|2.5d|3d) or fork a brand preset
npx make-pictures styles --space=3d
npx make-pictures style new brand-clay --from=soft-clay

# Scaffold src/videos/<slug>/ (audio.json + component) and register <Composition> in src/Root.tsx
npx make-pictures new product-launch --space=2d --style=minimal-product --lang=en

# Synthesize ElevenLabs eleven_v4 TTS / Text-to-Dialogue / Music / SFX into public/audio/<slug>/ (or --mock offline)
npx make-pictures audio product-launch
npx make-pictures voices --lang=en --gender=male

# Asset generation, lossless PDF /SMask or flood-fill cutouts, scan cleanup, and QA sheets
npx make-pictures image "Warm gouache editorial desk illustration" --style=editorial-press --out=public/hero.png
npx make-pictures cutout scan.png --out=public/cutout.png
npx make-pictures assets clean-scan raw-scan.png --out=public/clean.png
npx make-pictures assets sheet public/

# Native @remotion/renderer selectComposition QA gate + Contact-Sheet PNG (works on any Remotion project)
npx make-pictures qa ProductLaunch

# Render 60 FPS MP4 (auto --gl=angle for 3D) + master loudness to -14 LUFS (EBU R128)
npx make-pictures render ProductLaunch

# Export 7 flagship Remotion Elements payloads (@remotion/studio-protocol)
npx make-pictures elements build --out=dist/elements
```

## Links

- Website: [make.pictures](https://make.pictures)
- Source & docs: [github.com/make-pictures/make-pictures-studio](https://github.com/make-pictures/make-pictures-studio)
- YouTube: [@makepicturestv](https://www.youtube.com/@makepicturestv) (EN) · [@makepicturespl](https://www.youtube.com/@makepicturespl) (PL)

## License

MIT © [make.pictures](https://make.pictures)
