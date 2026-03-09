# Project scope: Alabama tree cover on GEE

Single source of truth for what this project does and what is in or out of scope.

---

## What this project does

- **State-scale wooded-area map** (forest vs non-forest) for Alabama on Google Earth Engine at **10 m** for a chosen year (e.g. 2023).
- **Pipeline**: Sentinel-2 + Sentinel-1 seasonal composites (leaf-on / leaf-off) + indices + slope → train Random Forest on NLCD or NAIP-derived points/polygons → classify → tiled export (probability + binary @ 0.5 + NLCD baseline).
- **Free data only**; **scalable** (no manual per-scene work); labels from NLCD or NAIP points/polygons.

---

## What is in scope

- **Platform**: GEE for compute and export.
- **Geography**: Alabama; pipeline scales to statewide (tiled export, batch).
- **Product**: Wooded-area map (0/1) + probability at 10 m; NLCD forest mask at 30 m as baseline.
- **Method**: RF and lightweight ML (no heavy deep learning as core).
- **Labels**: NLCD 2021 (forest = 41/42/43), NAIP-derived points, or NAIP-derived polygons.
- **Validation**: In-script stratified sample or accuracy from uploaded RF + NLCD assets.

---

## What is out of scope

- PlanetScope or other paid 3 m imagery as primary input.
- Per-scene U-Net or similar heavy DL as the core workflow.
- Manual download/upload of thousands of scenes.
- Single-scene or small-area-only outputs with no path to statewide.

---

## Key artifacts

| Role | File |
|------|------|
| **Main pipeline** | [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js) |
| **Accuracy from assets** | [gee_rf_accuracy_from_assets.js](gee_rf_accuracy_from_assets.js) |
| **Label creation** | [gee_create_naip_label_points.js](gee_create_naip_label_points.js), [gee_export_polygon_candidates.js](gee_export_polygon_candidates.js), [gee_naip_ndvi_timeseries.js](gee_naip_ndvi_timeseries.js) |
| **Optional Python** | [gee_explore_alabama_geemap.py](gee_explore_alabama_geemap.py) |
| **Data** | [data/](data/) (NAIP label points, CSVs, etc.) |

---

## Supporting docs

- [TRAINING_DATA_AND_ACCURACY.md](TRAINING_DATA_AND_ACCURACY.md) — NAIP points FAQ, NDVI filtering, accuracy metrics, GEE upload tips.
- [TRAINING_DATA_STRATEGY.md](TRAINING_DATA_STRATEGY.md) — Points vs polygons, recommended workflow, quality guidance.
