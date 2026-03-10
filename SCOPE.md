# Project scope: Alabama tree cover on GEE

Single source of truth for what this project does and what is in or out of scope.

---

## What this project does

- **State-scale wooded-area map** (forest vs non-forest) for Alabama on Google Earth Engine at **10 m** for a chosen year (e.g. **2025**). We target **10 m** to fill a research gap: existing forest maps (e.g. NLCD) are 30 m; a 10 m product supports finer parcel/edge analysis.
- **Pipeline**: Sentinel-2 + Sentinel-1 seasonal composites (leaf-on / leaf-off) + indices + slope → train Random Forest on labels (NLCD, NAIP-derived points/polygons, or a hybrid) → classify → tiled export (probability + binary @ 0.5 + NLCD baseline).
- **Free data only**; **scalable**; labels from NLCD, NAIP points/polygons, or hybrid (e.g. NAIP + Google Satellite for quality). **Manual labeling is fine**; the focus is on procuring **quality** training data, not on avoiding manual work per se.

---

## What is in scope

- **Platform**: GEE for compute and export.
- **Geography**: Alabama; pipeline scales to statewide (tiled export, batch).
- **Product**: Wooded-area map (0/1) + probability at 10 m; NLCD forest mask at 30 m as baseline.
- **Method**: RF and lightweight ML (no heavy deep learning as core).
- **Labels**: NLCD 2021 (30 m, baseline only; not the most accurate)—or **NAIP-derived points/polygons**, or a **hybrid** (e.g. NAIP + Google Satellite) for better accuracy. **Training data** should be in the **order of 1,000s** of quality samples for this scale; use a **combination of points and polygons** where practical (points for edges/diversity, polygons for homogeneous patches).
- **Validation**: (1) Hold out a **portion of the original training data** for validation/testing; (2) hold out a **section, strip, or region** of the study area for spatial validation; (3) where available, use **FIA plots and boundaries** (forest/non-forest) for independent validation. In-script stratified sample or accuracy from uploaded RF + NLCD/assets as needed.

---

## What is out of scope

- PlanetScope or other paid 3 m imagery as primary input.
- Per-scene U-Net or similar heavy DL as the core workflow.
- Manual download/upload of thousands of scenes as a hard requirement (manual labeling of points/polygons for quality is in scope).
- Single-scene or small-area-only outputs with no path to statewide.

---

## Key artifacts


| Role                     | File                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Main pipeline**        | [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js)                                                                                                                                         |
| **Accuracy from assets** | [gee_rf_accuracy_from_assets.js](gee_rf_accuracy_from_assets.js)                                                                                                                                     |
| **Label creation**       | [gee_create_naip_label_points.js](gee_create_naip_label_points.js), [gee_export_polygon_candidates.js](gee_export_polygon_candidates.js), [gee_naip_ndvi_timeseries.js](gee_naip_ndvi_timeseries.js) |
| **Optional Python**      | [gee_explore_alabama_geemap.py](gee_explore_alabama_geemap.py)                                                                                                                                       |
| **Data**                 | [data/](data/) (NAIP label points, CSVs, etc.)                                                                                                                                                       |


---

## Supporting docs

- [DIRECTION.md](DIRECTION.md) — Framework, architecture, sample collection (10 m, 2025).
- [TRAINING.md](TRAINING.md) — Training data, validation, accuracy results, GEE tips.

