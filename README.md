# Alabama Tree Cover / Canopy Mapping (GEE)

State-scale **wooded-area map** for Alabama on **Google Earth Engine**: free data, scalable pipeline, **10 m** export. We use **Sentinel-2 + Sentinel-1 seasonal composites** (leaf-on/leaf-off), indices, and slope as predictors, with NLCD or **NAIP-derived points** (optionally NDVI quality–filtered) as labels, to produce a **temporally updated** forest/non-forest map (e.g. 2023). **Source of truth**: [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js).

- **Spec**: [PROJECT_SPEC.md](PROJECT_SPEC.md) — goal, constraints, **what we built** (optical + radar + seasonal composites), and reference catalog.
- **Boundary**: [PROJECT_BOUNDARY.md](PROJECT_BOUNDARY.md) — what we do and don't do; delivered product summary.
- **Paths & implementation**: [PATH_ANALYSIS.md](PATH_ANALYSIS.md) — candidate paths, scores, and **implemented pipeline** (inputs, output, scripts).

**Run the pipeline**  
- **Code Editor**: open [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js) → paste into [code.earthengine.google.com](https://code.earthengine.google.com/) → Run → execute export tasks in the Tasks panel for full-state GeoTIFFs (probability + binary @ 0.5 + NLCD baseline).
- **Python (geemap)**: `pip install geemap earthengine-api`, `earthengine authenticate`, then `python gee_explore_alabama_geemap.py`. Optional export and interactive map.

**Other scripts**  
- [gee_rf_accuracy_from_assets.js](gee_rf_accuracy_from_assets.js) — accuracy/kappa from uploaded RF + NLCD assets.  
- [gee_create_naip_label_points.js](gee_create_naip_label_points.js) — export NAIP label point grid.  
- [gee_naip_ndvi_timeseries.js](gee_naip_ndvi_timeseries.js) — NDVI timeseries + quality filter for NAIP points.

Start with [PROJECT_SPEC.md](PROJECT_SPEC.md) for the big picture and "What we built"; use [PATH_ANALYSIS.md](PATH_ANALYSIS.md) for implementation details.
