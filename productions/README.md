# Isolated Film Productions (`productions/<slug>/`)

User-created films and client episodes can live in isolated directories (gitignored from the open-source `make.pictures` toolkit so upgrades never conflict with your films). By default `npx make-pictures new` scaffolds into `src/videos/<slug>/`; set `"videosDir": "productions"` in an optional `make-pictures.json` at the repo root if you prefer keeping films under `productions/<slug>/`.

## Optional `make-pictures.json`

```json
{
  "videosDir": "productions"
}
```

## Quick Start

1. **Scaffold a new film (`--space=2d|2.5d|3d`):**
   ```bash
   npx make-pictures new my-episode --space=2d
   # or Soft-Clay 3D studio dialogue:
   npx make-pictures new studio-talk --space=3d --kit=isometric-3d
   ```
2. **Generate voiceovers, AI music score & AI SFX from `audio.json`:**
   ```bash
   npx make-pictures audio my-episode
   # Offline mock synthesis without an ElevenLabs key:
   npx make-pictures audio my-episode --mock
   ```
3. **Preview & live-tune Zod props in native Remotion Studio (`60 FPS`):**
   ```bash
   npx remotion studio
   # or:
   npx make-pictures studio
   ```
   Register your film's `<Composition schema={...} defaultProps={...} />` directly in `src/Root.tsx`.
4. **Run Contact-Sheet QA & render broadcast `-14 LUFS` MP4:**
   ```bash
   npx make-pictures qa MyEpisode
   npx make-pictures render MyEpisode
   ```

## Film Layout

```text
productions/<slug>/                  # (or default src/videos/<slug>/)
├── audio.json                       # Scene script, ElevenLabs v4 voice/dialogue settings, AI SFX & Music spec
├── <PascalSlug>.tsx                 # 60 FPS Remotion composition + Zod schema registered in src/Root.tsx
└── generated/
    └── audio-manifest.ts            # Auto-generated typed manifest for audio & word-level timestamps

public/audio/<slug>/                 # Generated audio served natively by Remotion staticFile()
├── voiceovers/                      # Cached .mp3 + word-level alignment .json
├── music/                           # Cached ElevenLabs Music / procedural fallback score
└── sfx/                             # Cached ElevenLabs SFX / procedural fallback foley
```
