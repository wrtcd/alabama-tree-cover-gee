# Alabama Tree Cover (GEE)

State-scale **forest/non-forest map** for Alabama at **10 m** (chosen year, e.g. 2025). Sentinel-2 + Sentinel-1 + slope → RF → probability + binary. Labels: NLCD (baseline) or NAIP points/polygons. Problem statement, what this product solves, and validation design: [SCOPE.md](SCOPE.md). Framework and sample collection: [DIRECTION.md](DIRECTION.md).

**Docs**
- [SCOPE.md](SCOPE.md) — problem statement, in/out of scope, artifacts
- [DIRECTION.md](DIRECTION.md) — framework, architecture, sample collection
- [TRAINING.md](TRAINING.md) — training data, validation, accuracy results
- [RESEARCH_AND_GAPS.md](RESEARCH_AND_GAPS.md) — existing datasets and gap this project fills

**Run**
- **GEE Code Editor:** [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js) → paste at [code.earthengine.google.com](https://code.earthengine.google.com/) → Run → execute export tasks.
- **Python:** `pip install geemap earthengine-api`, `earthengine authenticate`, `python gee_explore_alabama_geemap.py`.

**Scripts**
- [gee_rf_accuracy_from_assets.js](gee_rf_accuracy_from_assets.js) — accuracy vs NLCD
- [gee_rf_accuracy_from_fia.js](gee_rf_accuracy_from_fia.js) — accuracy vs FIA plots
- [gee_create_naip_label_points.js](gee_create_naip_label_points.js) — stratified points for labeling
- [gee_export_polygon_candidates.js](gee_export_polygon_candidates.js) — polygon candidates
- [gee_naip_ndvi_timeseries.js](gee_naip_ndvi_timeseries.js) — NDVI filter for points
