# Isolated Film Productions (`productions/<slug>/`)

Every user-created film or client episode lives inside its own self-contained capsule directory under `productions/<slug>/` (gitignored from the open-source `make.pictures` engine so engine updates never conflict with your films).

## Quick Start

1. **Scaffold a new isolated production capsule:**
   ```bash
   npm run new -- my-episode --kit=paper-diorama-3d
   ```
2. **Generate voiceovers, AI music score & AI SFX:**
   ```bash
   npm run audio -- --production=my-episode
   ```
3. **Preview & live-tune props in Studio Web (`60 FPS`):**
   ```bash
   npm run studio
   ```
   Switch the left sidebar filter to **Productions** to focus exclusively on your films.
4. **Run 12-frame Contact-Sheet QA & render broadcast `-14 LUFS` MP4:**
   ```bash
   npm run qa -- MyEpisode
   npm run render -- MyEpisode
   ```

## Capsule Layout

```text
productions/<slug>/
├── production.json                 # Scene script, ElevenLabs voice settings, AI SFX & Music Score spec
├── index.ts                        # Exports `defineProduction({ ... })` auto-discovered by Studio Web & Remotion
├── compositions/
│   ├── <PascalSlug>.tsx            # 60 FPS Remotion composition + Zod schema
│   └── <PascalSlug>.props.json     # Live-editable Props Inspector defaults
├── assets/                         #Mirrored via symlink at `public/_productions/<slug>/`
│   ├── voiceovers/                 # Cached .mp3 + word-level alignment .json
│   ├── music/                      # Cached ElevenLabs Music / procedural fallback score
│   └── sfx/                        # Cached ElevenLabs SFX / procedural fallback foley
└── generated/
    └── audio-manifest.ts           # Auto-generated typed manifest for capsule audio & word timestamps
```
