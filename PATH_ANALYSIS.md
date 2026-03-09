# Candidate paths and optimal choice

From **PROJECT_SPEC.md** and **PROJECT_BOUNDARY.md**: one root (Alabama state-scale tree cover on GEE under constraints), many possible paths. Below: 2–4 distinct candidate paths, scores on the optimization criteria, recommended path, and why it wins.

---

## 1. Candidate paths (signal + label + scale/method)

| Path | Signal | Labels / target | Scale / method | Short name |
|------|--------|-----------------|----------------|------------|
| **A** | Optical (S2) + radar (S1): seasonal composites (leaf-on/leaf-off) + indices + terrain (slope) | NLCD 2021 (41/42/43 → 1) or NAIP points (optionally NDVI-filtered) | RF in GEE; 10 m export; tiled to Drive | Optical + Radar + NLCD/NAIP → RF |
| **B** | Optical composite + terrain (DEM, slope) | GEDI L2A (RH98, canopy height) aggregated to grid or as sparse target | RF or regression; GEDI points → 30 m grid or sample-based training | Optical + GEDI height |
| **C** | Temporal optical: multi-date composites, phenology (e.g. max NDVI, range, seasonality) | NLCD Tree Canopy (or USFS TCC) | RF with temporal + spectral features; same export pattern | Temporal optical + NLCD → RF |
| **D** | Single cloud-free composite + terrain | NLCD / FIA for validation only; product is index-based (e.g. NDVI threshold) | No RF: threshold + terrain mask; validate with NLCD/FIA | Index-threshold + validation |

---

## 2. Scores on optimization criteria

Scale: **1–5** (5 = best). Trade-offs noted in brief.

| Criterion | A: Optical + NLCD → RF | B: Optical + GEDI | C: Temporal + NLCD → RF | D: Index-threshold |
|-----------|------------------------|-------------------|-------------------------|--------------------|
| **Optimization** | 4 — Tunable (features, RF params); composite strategy clear | 4 — Tunable; GEDI as target is well-defined | 5 — Rich feature set; phenology adds signal | 2 — Few knobs; threshold is ad hoc |
| **Scalability** | 5 — Full Alabama; tiled export; batch; no per-scene steps | 3 — GEDI sparse; grid aggregation or sampling adds complexity | 5 — Same as A; more compute per tile | 5 — Lightest; very fast export |
| **Data pipeline** | 5 — Ingest → composite → train → predict → export; GEE-native | 3 — GEDI sampling/aggregation; two workflows (optical + GEDI) | 4 — Same as A plus temporal composite step | 5 — Simplest flow |
| **Efficiency** | 4 — Single composite; bounded I/O; RF in GEE is manageable | 3 — Extra reads for GEDI; aggregation can be heavy | 3 — More imagery and features per pixel | 5 — Minimal compute and I/O |
| **Speed** | 4 — Hours to first result; days for full state with tiling | 3 — GEDI processing and alignment add time | 3 — More composite + feature time | 5 — Fastest to result |
| **Accuracy** | 5 — NLCD is CONUS reference; direct train/validate; FIA possible | 5 — GEDI is direct structure; best where GEDI exists | 5 — Temporal can reduce confusion; same labels as A | 3 — Limited; good for rough mask only |
| **Data availability** | 5 — Landsat/S2 + NLCD all free, CONUS, in GEE | 5 — All free; GEDI global; Landsat/S2 CONUS | 5 — Same as A | 5 — Same as A |

**Summary**

- **A** and **C** lead on pipeline clarity, scalability, accuracy, and data availability; **A** is simpler and faster, **C** trades speed/efficiency for more signal.
- **B** is strong on accuracy (GEDI) and optimization but weaker on pipeline and scalability (GEDI sparsity, aggregation).
- **D** wins on efficiency and speed but is weak on optimization and accuracy; suitable as a quick baseline, not as the main path.

---

## 3. Recommended optimal path: **A (Optical + NLCD → RF)** — implementation evolved to **Optical + Radar + seasonal composites**

Path A was selected; the **implemented pipeline** in `gee_alabama_tree_cover_rf.js` extends it with **radar (Sentinel-1)** and **seasonal composites** (leaf-on / leaf-off) for both optical and radar. That gives: richer signal (phenology + structure), cloud robustness (S1), and better separation of forest vs crops/grass.

**Why the chosen path works**

1. **Pipeline & scalability** — Seasonal composites (S2 + S1) → indices + slope → train RF on NLCD (or NAIP points) → predict → tiled export. Scales to full Alabama; GEE-native.
2. **Accuracy & data availability** — NLCD (or optional NAIP points) as labels; S2 + S1 + terrain all free in GEE for Alabama.
3. **Optimization** — Seasonal strategy, band set, indices, and RF are tunable; radar adds structure and all-weather signal.
4. **Speed & efficiency** — Bounded composites and exports; full-state export tractable via GEE tasks (hours to days with tiling).

Path **C** (temporal-only optical) is partly absorbed by seasonal composites. Path **B** (GEDI) remains an option for validation or height product. Path **D** is a fast baseline. **Source of truth for the current pipeline**: [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js).

---

## 4. What we implemented (Path A+)

We built the full pipeline: **Optical + Radar + seasonal composites → RF**, producing a **wooded-area map** for Alabama at **10 m**.

### Inputs

| Input | Source | Role |
|-------|--------|------|
| **Labels** | NLCD 2021 (classes 41, 42, 43 → forest) or NAIP-derived points (manual 0/1; optionally NDVI quality–filtered via `gee_naip_ndvi_timeseries.js`) | Training target (no manual labeling at scale for NLCD; optional NAIP labeling for higher accuracy) |
| **Optical** | Sentinel-2 SR Harmonized: **seasonal composites** — leaf-on (May–Sep) and leaf-off (Dec–Feb); bands B2–B8, B8A, B11, B12; indices NDVI, NDMI, NBR, RENDVI per season | Predictors |
| **Radar** | Sentinel-1 GRD: same seasonal windows; VV and VH in dB, VV−VH, VV/VH | Predictors (cloud-independent) |
| **Terrain** | SRTM → slope | Predictor |

### Output

- **Product**: (1) **Probability** of forest, (2) **binary** forest/non-forest @ 0.5, (3) NLCD forest mask (30 m) as baseline — all for the **composite year** (e.g. 2023).
- **Resolution**: **10 m** for RF outputs; 30 m for NLCD baseline.
- **Extent**: Full Alabama (or preview tile); export to Drive as GeoTIFF via GEE Tasks.

### Novelty vs. using NLCD alone

- **Temporal**: Map is for the **composite year** (e.g. 2023), not only NLCD 2020/2021.
- **Signal**: Seasonal composites + radar reduce confusion (crops/grass vs forest); our feature set differs from USGS NLCD workflow.
- **Labels**: NLCD (or NAIP points) used as **training source**; model transfers to **new** imagery — output can differ where cover changed or patterns differ.

### Where it lives

- **Main pipeline:** [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js) — **source of truth**. Paste into [code.earthengine.google.com](https://code.earthengine.google.com/); run export tasks in Tasks panel.
- **Accuracy from exports:** [gee_rf_accuracy_from_assets.js](gee_rf_accuracy_from_assets.js) — upload RF + NLCD GeoTIFFs as assets; multi-seed sampling, accuracy/kappa.
- **NAIP labels:** [gee_create_naip_label_points.js](gee_create_naip_label_points.js) — export point grid for manual labeling; [gee_naip_ndvi_timeseries.js](gee_naip_ndvi_timeseries.js) — NDVI timeseries + quality filter for NAIP points.
- **Python (geemap):** [gee_explore_alabama_geemap.py](gee_explore_alabama_geemap.py) — exploratory workflow; optional export.
