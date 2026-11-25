# ProductPromo ("One Tap to Your Door") Visual Asset Sources

All 6 bespoke zero-text illustrations for `examples/aether-promo` (`ProductPromo`) were generated specifically for this production in a cohesive sunlit warm `minimal-product` editorial gouache palette (warm cream, kraft paper, terracotta, sage green, sunlit oak) with **zero embedded text, letters, numbers, or watermarks**, and verified via `@make-pictures/cli`:

| Asset | Dimensions | Act / Purpose | Processing Pipeline | Verified Landmarks / Notes | QA Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public/examples/aether-promo/images/bakery-box.png` | `1200×896` | Act 1 (`tap-en`) phone order card & Act 3 tracker thumbnail | Lossless PNG conversion (`ffmpeg`), full bleed preserved | Warm kraft box of croissants & cinnamon roll beside terracotta latte cup; zero text | `out/qa-aether-promo-assets.png` |
| `public/examples/aether-promo/images/neighborhood-map.png` | `1376×768` | Act 3 (`live-sync-en`) `<BrowserFrame>` live neighborhood delivery map | Lossless PNG conversion (`ffmpeg`), full bleed 16:9 preserved | Exact 27-point road + park trail centerline traced (`0` grass hits, `0` building hits) | `out/qa-aether-promo-route-verify.png`, `out/qa-aether-promo-assets.png` |
| `public/examples/aether-promo/images/card-instant-handoff.png` | `1200×900` (`4:3`) | Act 4 (`doorstep-en`) card 1 — *Instant Handoff* | Outer white margin tightly trimmed (`crop=899:674:150:113`) + Lanczos scale to `1200×900` | Baker packing croissants beside sunlit counter order tablet; full-bleed `4:3`, zero text | `out/qa-aether-promo-assets.png` |
| `public/examples/aether-promo/images/card-live-street-view.png` | `1200×900` (`4:3`) | Act 4 (`doorstep-en`) card 2 — *Live Street View* | Lossless PNG conversion + Lanczos scale to `1200×900` | Sage courier bicycle with ribboned bakery box on sunlit park lane; full-bleed `4:3`, zero text | `out/qa-aether-promo-assets.png` |
| `public/examples/aether-promo/images/card-always-warm.png` | `1200×900` (`4:3`) | Act 4 (`doorstep-en`) card 3 — *Always Warm* | Lossless PNG conversion + Lanczos scale to `1200×900` | Steaming croissants & cinnamon roll on wooden peel by terracotta brick hearth; clean `4:3`, zero text | `out/qa-aether-promo-assets.png` |
| `public/examples/aether-promo/images/card-happy-mornings.png` | `1200×900` (`4:3`) | Act 4 (`doorstep-en`) card 4 — *Happy Mornings* | Outer white margin tightly trimmed (`crop=886:665:135:172`) + Lanczos scale to `1200×900` | Sunlit morning breakfast table with open pastry box & two steaming terracotta lattes; full-bleed `4:3`, zero text | `out/qa-aether-promo-assets.png` |

## Verified Road + Park Trail Centerline (`DISPATCH_ROUTE_WAYPOINTS`) on `neighborhood-map.png` (`1376×768`)
Extracted via distance-transformed medial-axis Dijkstra strictly on pure white avenues (`x=279`, `y=227`, `x=1091`) and the winding cream park trail (`x∈[292,793], y∈[240,513]`), and visually verified via `out/qa-aether-promo-route-verify.png` (`0` grass hits, `0` building hits across 1,155 sampled pixels):

```json
[
  {"x":0.2028,"y":0.8021},
  {"x":0.2028,"y":0.7474},
  {"x":0.2028,"y":0.6940},
  {"x":0.2158,"y":0.6641},
  {"x":0.2370,"y":0.6313},
  {"x":0.2584,"y":0.5982},
  {"x":0.2841,"y":0.5782},
  {"x":0.3120,"y":0.5741},
  {"x":0.3393,"y":0.5871},
  {"x":0.3670,"y":0.5964},
  {"x":0.3937,"y":0.5846},
  {"x":0.4103,"y":0.5447},
  {"x":0.4218,"y":0.4999},
  {"x":0.4325,"y":0.4542},
  {"x":0.4596,"y":0.4427},
  {"x":0.4877,"y":0.4393},
  {"x":0.5140,"y":0.4217},
  {"x":0.5342,"y":0.3866},
  {"x":0.5538,"y":0.3503},
  {"x":0.5734,"y":0.3151},
  {"x":0.5843,"y":0.2956},
  {"x":0.6359,"y":0.2956},
  {"x":0.6904,"y":0.2956},
  {"x":0.7449,"y":0.2956},
  {"x":0.7929,"y":0.2956},
  {"x":0.7929,"y":0.2396},
  {"x":0.7929,"y":0.1849}
]
```
