# Candidate paths and optimal choice

From **PROJECT_SPEC.md** and **PROJECT_BOUNDARY.md**: one root (Alabama state-scale tree cover on GEE under constraints), many possible paths. Below: 2–4 distinct candidate paths, scores on the optimization criteria, recommended path, and why it wins.

---

## 1. Candidate paths (signal + label + scale/method)

| Path | Signal | Labels / target | Scale / method | Short name |
|------|--------|-----------------|----------------|------------|
| **A** | Optical (Landsat 8/9 or Sentinel-2): single cloud-free composite + indices (NDVI, etc.) | NLCD Tree Canopy (30 m, CONUS) | RF in GEE; train on composite + indices; predict statewide; tiled export | Optical + NLCD → RF |
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

## 4. Next step: GEE exploration for path A

For path A, exploration in GEE should:

- Use **Alabama** as the AOI.
- Load **inputs**: optical (e.g. Sentinel-2 or Landsat 8/9), cloud-free composite; NLCD Tree Canopy (and optionally terrain).
- Produce **one cloud-free composite** (visual + layer list) and **one small-tile export** (e.g. 500×500 px at 30 m) to confirm resolutions and data availability.

Runnable scripts:

- **GEE Code Editor (JavaScript):** `gee_explore_alabama.js` (paste into Code Editor).
- **Python (geemap):** `gee_explore_alabama_geemap.py` (run locally with geemap).

Both scripts define the Alabama AOI, build a cloud-free composite, add NLCD Tree Canopy, and trigger a small export so you can verify resolution and coverage before implementing the full pipeline.
