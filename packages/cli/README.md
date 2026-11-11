<p align="center">
  <a href="https://make.pictures"><img src="https://make.pictures/brand/make-pictures-logo.svg" alt="make.pictures — Open-source 60 FPS Video-as-Code Studio" width="420" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@make-pictures/cli"><img src="https://img.shields.io/npm/v/@make-pictures/cli?style=for-the-badge&labelColor=0F172A&color=FF2A85&label=%40make-pictures%2Fcli" alt="@make-pictures/cli on npm" /></a>
  <img src="https://img.shields.io/badge/make--pictures_CLI-7209B7?style=for-the-badge&labelColor=0F172A" alt="make--pictures CLI" />
  <a href="https://make.pictures"><img src="https://img.shields.io/badge/make.pictures-Studio-2563EB?style=for-the-badge&labelColor=0F172A" alt="make.pictures Studio" /></a>
</p>

# `@make-pictures/cli`

Unified `60 FPS` Video-as-Code CLI for **make.pictures Studio**.

Powers standalone projects (`npx create-make-pictures@latest my-films`), embedded SaaS video directories (`npx make-pictures init --dir=videos`), and CI render pipelines.

## Commands

```bash
# Agent-driven setup & ElevenLabs OAuth (.env.local)
npx make-pictures onboard
npx make-pictures doctor

# Initialize inside an existing Next.js / SaaS repository
npx make-pictures init --dir=videos

# Launch local 60 FPS Studio Web workstation (HMR + Props Inspector + Safe Box)
npx make-pictures studio

# Scaffold an isolated production capsule in productions/<slug>/
npx make-pictures new product-launch --kit=paper-diorama-3d --lang=en

# Synthesize ElevenLabs TTS + word timestamps + AI Music + AI SFX (or --mock offline)
npx make-pictures audio --production=product-launch

# Render a 12-frame Contact-Sheet PNG for visual QA
npx make-pictures qa ProductLaunch

# Render 60 FPS MP4 + master loudness to broadcast -14 LUFS
npx make-pictures render ProductLaunch
```

## Links

- Website: [make.pictures](https://make.pictures)
- Source & docs: [github.com/make-pictures/make-pictures-studio](https://github.com/make-pictures/make-pictures-studio)
- YouTube: [@makepicturestv](https://www.youtube.com/@makepicturestv) (EN) · [@makepicturespl](https://www.youtube.com/@makepicturespl) (PL)

## License

MIT © [make.pictures](https://make.pictures)
