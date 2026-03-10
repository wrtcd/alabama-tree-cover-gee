# Scope

## Problem statement

For Alabama there is no **10 m**, **wall-to-wall** forest/non-forest map that (1) targets a **chosen year** (e.g. 2025), (2) uses a **stated forest definition** (e.g. FIA-aligned or explicit canopy/patch rules), (3) is **independently validated** (e.g. FIA, hold-out, spatial), and (4) is **reproducible** (free data, open workflow, our labels). Existing products are either 30 m (NLCD, Hansen, GAP, TreeMap), not Alabama-validated (ESA WorldCover, Hansen), or not a wall-to-wall map (FIA). This project fills that **solution/product gap**: an Alabama-specific, 10 m, FIA-validated, re-runable forest/non-forest product with a transparent pipeline.

## What this product would solve (if created)

- **No 10 m forest/non-forest map for Alabama** — Today you only get 30 m (NLCD, Hansen, GAP) or global 10 m (WorldCover) cropped to Alabama; this would be a dedicated 10 m product for the state.
- **No control over the forest definition** — A map where "forest" is explicit and consistent (e.g. FIA-aligned or our own rules), instead of relying on WorldCover's global "tree cover."
- **No map for a chosen year** — Ability to target a specific year (e.g. 2025) and re-run when new imagery exists, instead of being stuck at 2020/2021.
- **No Alabama-specific validation** — Documented accuracy in Alabama (hold-out, spatial, and/or FIA), so users know how good it is there instead of inferring from global stats.
- **No transparent, reproducible pipeline** — An open workflow (labels, RF, scripts) that others can audit, adapt, or re-run, instead of a black-box global model.
- **No single forest/non-forest layer for the state** — A direct binary (and probability) layer for Alabama, without subsetting and reclassifying an 11-class global product.
- **Uncertainty at edges and parcels** — A model trained and validated on Alabama-relevant edges and land use, rather than a globally tuned product that may be suboptimal there.
- **No FIA-benchmarked option** — A wall-to-wall map that can be validated (and described) against FIA forest/non-forest, bridging plot-based truth and a statewide raster.

## What is in scope

- **Platform:** GEE for compute and export.
- **Geography:** Alabama; pipeline scales to statewide (tiled export, batch).
- **Product:** Forest/non-forest map (0/1) + probability at 10 m; NLCD forest mask at 30 m as baseline.
- **Method:** RF and lightweight ML (no heavy deep learning as core).
- **Labels:** NLCD 2021 (30 m, baseline only) — or **NAIP-derived points/polygons**, or a **hybrid** (e.g. NAIP + high-res reference) for better accuracy. Target **order of 1,000s** of quality samples; use **points and polygons** where practical (points for edges/diversity, polygons for homogeneous patches).
- **Validation:** (1) Hold out a portion of training data; (2) hold out a region or strip for spatial validation; (3) use **FIA plots/boundaries** (forest/non-forest) as independent reference where available.

## What is out of scope

- PlanetScope or other paid 3 m imagery as primary input.
- Per-scene U-Net or similar heavy DL as the core workflow.
- Manual download/upload of thousands of scenes as a hard requirement (manual labeling of points/polygons for quality is in scope).
- Single-scene or small-area-only outputs with no path to statewide.

## Key artifacts

| Role                     | File                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Main pipeline**        | [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js)                                                                           |
| **Accuracy (NLCD)**      | [gee_rf_accuracy_from_assets.js](gee_rf_accuracy_from_assets.js)                                                                      |
| **Accuracy (FIA)**       | [gee_rf_accuracy_from_fia.js](gee_rf_accuracy_from_fia.js)                                                                            |
| **Label creation**       | [gee_create_naip_label_points.js](gee_create_naip_label_points.js), [gee_export_polygon_candidates.js](gee_export_polygon_candidates.js), [gee_naip_ndvi_timeseries.js](gee_naip_ndvi_timeseries.js) |
| **Optional Python**      | [gee_explore_alabama_geemap.py](gee_explore_alabama_geemap.py)                                                                          |
| **Data**                 | [data/](data/) (NAIP label points, CSVs, etc.)                                                                                           |

## Supporting docs

- [DIRECTION.md](DIRECTION.md) — Framework, architecture, sample collection (10 m, chosen year).
- [TRAINING.md](TRAINING.md) — Training data, validation, accuracy results, GEE tips.
- [RESEARCH_AND_GAPS.md](RESEARCH_AND_GAPS.md) — Existing datasets and how this project fits the gap.
