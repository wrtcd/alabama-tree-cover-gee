# What's out there and where this project fits

**In plain terms:** Government and research maps already show where forests are across the US and in Alabama, but they're all at a coarser "30-meter" resolution (like one dot per football field), or they're global 10 m products (e.g. ESA WorldCover) not validated for Alabama. Nobody has published a finer "10-meter" forest map **just for Alabama** that you can set to a chosen year (e.g. 2024 or 2025), with a stated forest definition and independent validation (e.g. FIA). This project fills that gap. See [SCOPE.md](SCOPE.md) for the full problem statement and what the product would solve.

---

## Dataset comparison (forest/land cover for Alabama)

| **Dataset** | **Temporal** | **Resolution** | **How built** | **Pros** | **Cons** | **Use cases** | **Gaps (for our purpose)** |
|-------------|--------------|----------------|---------------|----------|----------|---------------|-----------------------------|
| **NLCD** | 1992, 2001, 2006, 2011, 2016, 2019, 2021 | 30 m | Landsat + ancillary; theme-based post-classification; forest = 41/42/43 | CONUS standard, long series, free | 30 m only; edge precision; circular if only label | National/state reporting, baseline | **Resolution**; **chosen year**; **Alabama validation** |
| **GAP Land Cover** | ~2011 | 30 m | Landsat; NatureServe; 590 classes (8 general) | Ecological detail | 30 m; old; not simple forest/non-forest | Habitat, conservation | **Resolution**; **forest/non-forest**; **recent year**; **Alabama-only** |
| **Hansen Global Forest Change** | 2000 baseline; annual to 2023–2024 | ~30 m | Landsat; trees >5 m; loss/gain | Global, annual change, free | 30 m; "tree cover" ≠ "forest"; no US tuning | Deforestation, carbon | **Resolution**; **forest definition**; **Alabama validation** |
| **FIA** | Rolling panels | **Point/plot** (no raster) | Field plots; FIA forest definition | Ground truth; authoritative | Not wall-to-wall; perturbed coords | Validation, statistics | **No wall-to-wall map**; reference only |
| **USDA/FS (e.g. TreeMap)** | e.g. circa 2014 | 30 m (when rasterized) | FIA imputed to 30 m grid | FIA-aligned; wall-to-wall | 30 m; vintage; not annual | Research | **Resolution**; **chosen year**; **Alabama pipeline** |
| **ESA WorldCover** | 2020, 2021 | **10 m** | S1+S2; large training set; AI; 11 classes incl. "Tree cover" | 10 m; global; free | Single "tree cover"; no local retrain/validation; fixed years | Global planning | **Alabama validation**; **chosen year**; **FIA-aligned def**; **transparency** |

---

## Intersection of the gap (where this project works)

We aim at the **intersection** of the gaps above:

- **10 m** (not 30 m)
- **Alabama-focused** (geography + validation)
- **Chosen year** (e.g. 2025), not fixed 2020/2021
- **Stated forest definition** (e.g. FIA-aligned or explicit)
- **We control the pipeline** (reproducible, our labels, our validation)
- **Independent validation** (FIA, hold-out, spatial)

We are **not** trying to beat WorldCover globally; we are filling the **solution/product gap**: a 10 m, Alabama-specific, FIA-validated, re-runable forest/non-forest product with a transparent workflow. Full problem statement and "what it would solve" bullets: [SCOPE.md](SCOPE.md).
