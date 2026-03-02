# Alabama Tree Cover / Canopy Mapping (GEE)

State-scale **wooded-area map** for Alabama on **Google Earth Engine**: free data, scalable pipeline, 30 m export. We use NLCD as training labels and Sentinel-2 + NDVI + slope as predictors to produce a **temporally updated** forest/non-forest map (e.g. for 2023) without manual labeling.

- **Spec**: [PROJECT_SPEC.md](PROJECT_SPEC.md) — goal, constraints, optimization criteria, **what we built** (Path A, novelty vs NLCD), and reference catalog.
- **Boundary**: [PROJECT_BOUNDARY.md](PROJECT_BOUNDARY.md) — what we do and don't do; delivered product summary.
- **Paths & implementation**: [PATH_ANALYSIS.md](PATH_ANALYSIS.md) — candidate paths, scores, chosen path (Optical + NLCD → RF), and **what we implemented** (inputs, output, novelty, scripts).
- **Training & RF**: [TRAINING_AND_RF_GUIDE.md](TRAINING_AND_RF_GUIDE.md) — how training samples and the Random Forest are created; full-state memory strategy.

**Run the pipeline (Path A)**  
- **Code Editor**: open [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js) → paste into [code.earthengine.google.com](https://code.earthengine.google.com/) → Run → execute the export task in the Tasks panel for full-state GeoTIFF.
- **Python (geemap)**: `pip install geemap earthengine-api`, `earthengine authenticate`, then `python gee_explore_alabama_geemap.py`. Same workflow; optional export and interactive map.

Start with [PROJECT_SPEC.md](PROJECT_SPEC.md) for the big picture and "What we built"; use [PATH_ANALYSIS.md](PATH_ANALYSIS.md) for implementation details and novelty vs NLCD.
