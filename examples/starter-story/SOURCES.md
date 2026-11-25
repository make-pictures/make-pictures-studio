# StarterStory ("How a Bullet Train Never Spills a Cup") Visual Asset Sources

All 5 bespoke 3:2 editorial gouache illustrations for `examples/starter-story` (`StarterStory` & `StarterStoryVertical`) were generated specifically for this production in a cohesive warm `editorial-press` mid-century gouache & fine ink style with **zero embedded text, letters, numbers, or watermarks**, and verified via `@make-pictures/cli`:

| Asset | Dimensions | Act / Purpose | Processing Pipeline | Notes / Verified Landmarks | QA Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public/examples/starter-story/images/plate-steam-era.png` | `1264×848` | Act 2 `EditorialPanoramaTrack` plate 1 (*Steam Era*) | Lossless PNG conversion (`ffmpeg`), full bleed 3:2 preserved | Clean warm paper frame, zero dark scanner corners, zero text | `out/qa-starter-story-assets.png` |
| `public/examples/starter-story/images/plate-1964-shinkansen.png` | `1264×848` | Act 2 `EditorialPanoramaTrack` plate 2 (*1964 Shinkansen*) | Lossless PNG conversion (`ffmpeg`), full bleed 3:2 preserved | Clean warm paper frame, Mt. Fuji viaduct, zero text | `out/qa-starter-story-assets.png` |
| `public/examples/starter-story/images/plate-kingfisher-nose.png` | `1264×848` | Act 2 `EditorialPanoramaTrack` plate 3 (*Kingfisher Inspiration*) | Lossless PNG conversion (`ffmpeg`), full bleed 3:2 preserved | Clean warm paper frame, diving kingfisher ripples, zero text | `out/qa-starter-story-assets.png` |
| `public/examples/starter-story/images/plate-teacup-window.png` | `1264×848` | Act 1 Opener & Act 2 `EditorialPanoramaTrack` plate 4 (*Still Teacup*) | Lossless PNG conversion (`ffmpeg`), full bleed 3:2 preserved | Sunlit green tea cup on wooden tray, zero text | `out/qa-starter-story-assets.png` |
| `public/examples/starter-story/images/plate-bullet-profile.png` | `1264×848` | Act 3 `PinnedMediaStage` (*Sculpted Anatomy*) | Lossless PNG conversion (`ffmpeg`), full bleed 3:2 preserved | `sourceWidth: 1264, sourceHeight: 848`; verified pins: `suspension (292, 486)`, `cabin (595, 405)`, `nose (1060, 416)` | `out/qa-starter-story-assets.png` |

## Generation & Verification Notes
- Raw 3:2 gouache illustrations were synthesized via the Antigravity `image-generator` pipeline (strictly zero raster text/letters/numbers/labels) and converted losslessly to uniform `1264×848` PNGs without cropping artwork.
- `assets clean-scan` was intentionally skipped because all 5 plates are clean digital gouache renders with zero dark scanner corners.
- All 3 `PinnedMediaStage` mechanical coordinates on `plate-bullet-profile.png` (`1264×848`) were computed via pixel feature detection and visually confirmed dead-on via reticle overlay:
  - `suspension`: `cx: 292, cy: 486` (`23.1% X, 57.3% Y`, `placement: 'bottom'`) — center of left wheel bogie damper beam (wheels centered at `x = 241` and `x = 343`).
  - `cabin`: `cx: 595, cy: 405` (`47.1% X, 47.8% Y`, `placement: 'top'`) — center of middle passenger window #9.
  - `nose`: `cx: 1060, cy: 416` (`83.9% X, 49.1% Y`, `placement: 'top'`) — midpoint along the upper sloped kingfisher nose cone.
