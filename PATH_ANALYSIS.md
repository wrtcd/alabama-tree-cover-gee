# Candidate paths and optimal choice

From **PROJECT_SPEC.md** and **PROJECT_BOUNDARY.md**: one root (Alabama state-scale tree cover on GEE under constraints), many possible paths. Below: 2–4 distinct candidate paths, scores on the optimization criteria, recommended path, and why it wins.

---

## 1. Candidate paths (signal + label + scale/method)

| Path | Signal | Labels / target | Scale / method | Short name |
|------|--------|-----------------|----------------|------------|
| **A** | Optical (Sentinel-2): single cloud-free composite + NDVI + terrain (slope) | NLCD land cover (2021): forest classes 41/42/43 → 0/1 mask | RF in GEE; train on composite + NDVI + slope; predict statewide; 30 m export | Optical + NLCD → RF |
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

## 3. Recommended optimal path: **A (Optical + NLCD → RF)**

**Why path A wins on the criteria that matter most**

1. **Pipeline & scalability** — Single cloud-free composite + indices → train RF on NLCD-derived labels → predict → tiled export. No GEDI grid aggregation, no multi-date complexity. Scales to full Alabama and is fully GEE-native.
2. **Accuracy & data availability** — NLCD Tree Canopy is a CONUS product; we can train and validate against it and optionally add FIA. All inputs (Landsat/S2, NLCD) are free and available for Alabama in GEE.
3. **Optimization** — Composite strategy (e.g. median, percentiles), band set, and indices are tunable; RF hyperparameters can be tuned; path is not ad hoc.
4. **Speed & efficiency** — One composite per area; moderate compute; time to first result and to full-state export is tractable (hours to days with tiling).

Path **C** is the natural upgrade if we later want higher accuracy and can afford more compute (temporal features). Path **B** is best considered for validation (GEDI vs. map) or a second product (height), not as the first statewide label source. Path **D** is useful as a fast sanity check or baseline, not as the primary chosen path.

---

## 4. What we implemented (Path A)

We built the full Path A pipeline and use it to produce a **wooded-area map** for Alabama.

### Inputs

| Input | Source | Role |
|-------|--------|------|
| **Labels** | NLCD 2021 land cover — classes 41, 42, 43 → forest (1); all else → non-forest (0) | Training target (no manual labeling) |
| **Optical** | Sentinel-2 SR Harmonized, cloud-masked, median composite for target year (e.g. 2023) | Predictors: B2, B3, B4, B8, B11, B12 (blue, green, red, NIR, SWIR1, SWIR2) |
| **NDVI** | Normalized difference B8/B4 from composite | Predictor |
| **Slope** | SRTM DEM → `ee.Terrain.slope` | Predictor |

### Output

- **Product**: Binary wooded map (0 = non-forest, 1 = forest) at **30 m**, for the **composite year** (e.g. 2023).
- **Extent**: Full Alabama (or a preview tile); export to Drive as GeoTIFF (optionally tiled if full-state export hits limits).

### Novelty vs. using NLCD alone

- **Year**: NLCD 2020/2021 is the latest official release. Our map is for **the composite year** (e.g. 2023), so we get a **temporally updated** wooded map.
- **Predictors**: We use **our** feature set (Sentinel-2 bands + NDVI + slope) and train an RF; the model transfers NLCD’s forest definition to **new** imagery. Result can differ where cover changed or where spectral/terrain patterns differ from USGS’s NLCD workflow.
- **Same resolution**: 30 m is preserved for direct comparison with NLCD and state-scale use.

### Where it lives

- **GEE Code Editor (JavaScript):** [gee_alabama_tree_cover_rf.js](gee_alabama_tree_cover_rf.js) — paste into [code.earthengine.google.com](https://code.earthengine.google.com/). Builds composite, samples with NLCD labels, trains RF, classifies, creates export task. Run the export in the Tasks panel for full-state GeoTIFF.
- **Python (geemap):** [gee_explore_alabama_geemap.py](gee_explore_alabama_geemap.py) — same workflow locally; optional export.
- **Training/sampling:** [TRAINING_AND_RF_GUIDE.md](TRAINING_AND_RF_GUIDE.md) — how training samples and the RF are created; memory strategy for full-state runs.
