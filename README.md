# Alabama Tree Cover / Canopy Mapping (GEE)

State-scale tree cover for Alabama on **Google Earth Engine**: free data, scalable pipelines, tiled export. From one root (goal + constraints), **pathways fractal out to a myriad of possibilities** — the key is **picking the optimal approach** for optimization, scalability, efficiency, speed, accuracy, and data availability.

- **Spec**: [PROJECT_SPEC.md](PROJECT_SPEC.md) — goal, constraints, optimization criteria, fractal framing, reference catalog.
- **Boundary**: [PROJECT_BOUNDARY.md](PROJECT_BOUNDARY.md) — what we do and don't do; we optimize, we don't lock in.
- **Paths & choice**: [PATH_ANALYSIS.md](PATH_ANALYSIS.md) — candidate paths, scores, recommended path (Optical + NLCD → RF), and GEE exploration.

**GEE exploration (Path A)**  
- **Code Editor**: open [gee_explore_alabama.js](gee_explore_alabama.js) → paste into [code.earthengine.google.com](https://code.earthengine.google.com/) → Run. Adds Alabama AOI, S2 cloud-free composite, NDVI, NLCD forest; creates a small-tile export task (15×15 km @ 30 m) to Drive.  
- **Python (geemap)**: `pip install geemap earthengine-api`, `earthengine authenticate`, then `python gee_explore_alabama_geemap.py`. Exports the same tile locally and opens an interactive map.

Start with PROJECT_SPEC.md; use the criteria to **select** the optimal path, not just explore.
