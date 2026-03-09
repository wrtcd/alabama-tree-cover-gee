# Project spec: Alabama tree cover mapping on GEE

**Goal**: State-scale tree (or wooded) cover for Alabama, on GEE, with free data and a pipeline that is **scalable, efficient, and accurate**. From one root (this goal + constraints), **pathways fractal out to a myriad of possibilities** — data choices, label sources, temporal vs single-date, height vs optical-only, export strategy. **Picking the optimal approach** is the key: evaluate paths against clear criteria and select the one that best balances optimization, scalability, pipeline efficiency, speed, accuracy, and data availability.

---

## Framing: fractal possibilities, optimal path

- **Root**: Alabama state-scale tree cover on GEE; free data; no manual labeling at scale; lightweight enough to scale.
- **Fractal**: From this root, many valid paths branch out — different signal sources (optical, temporal, height), label sources (existing products, derived targets), resolutions, composite strategies, export tile sizes, methods (indices, RF, light ML). The space of possibilities is large.
- **Optimal path**: We do not "pick one from a list" or "stay open to everything." We **evaluate** candidate paths against the criteria below and **choose the approach that best satisfies** them (or best trades them off). Design is optimization under constraints.

---

## Optimization criteria (how we choose the path)

Evaluate any candidate approach against these. **Optimal** = the path that best balances them for our goal and constraints.

| Criterion | What we care about |
|-----------|---------------------|
| **Optimization** | Pipeline and method are tuned (e.g. composite strategy, feature set, thresholds or model) for the task; not ad hoc. |
| **Scalability** | Design scales to full Alabama (and beyond if useful): tiled export, batch processing, no per-scene manual steps. |
| **Data pipeline** | Clear, reproducible flow: ingest → composite/features → train or threshold → predict → export; minimal hand steps; GEE-native where possible. |
| **Efficiency** | Compute and I/O are bounded: avoid redundant reads, unnecessary resolution, or exports that don't need to leave GEE. |
| **Speed** | Time to first result and time to full-state result are tractable (e.g. hours to days, not months of manual work). |
| **Accuracy** | Where we have reference (existing products, FIA, etc.), we can measure and improve accuracy; choice of labels/targets supports validation. |
| **Data availability** | Inputs are free, available for Alabama, and (ideally) global or CONUS so the approach can generalize; no dependency on scarce or paywalled data. |

Trade-offs are allowed (e.g. slightly lower resolution for much faster export), but the **chosen path** should be justified against these criteria, not by default or habit.

---

## Constraints (non-negotiable)

- **Platform**: GEE for main compute and export (no thousands of manual scene downloads).
- **Data**: Free, usable at Alabama scale. Prefer global or CONUS so the approach can generalize.
- **Geography**: Alabama as target; pipeline must scale to statewide (tiled export, etc.).
- **Method**: Lightweight enough to run in GEE or with small exports — no per-scene heavy DL as the core.
- **Labels**: No manual polygon labeling at scale; use existing products, points, or derived targets.

---

## What we don't do (boundary)

- PlanetScope or other paid 3m as the primary input.
- Per-scene U-Net (or similar) as the core workflow.
- Manual labeling at scale as the main source of labels.
- Single-scene or small-area-only outputs with no path to statewide.
- Choosing an approach by default or lock-in; we **select** using the optimization criteria.

---

## Reference: what's available (catalog for path design)

Use this to design and compare paths. **Which** assets and dimensions you combine is decided by evaluating against the criteria above.

| Kind | Examples (GEE or free, Alabama) | Role they can play |
|------|--------------------------------|---------------------|
| Optical | Sentinel-2, Landsat 8/9 | Signal: reflectance, indices, composites. |
| Radar | Sentinel-1 GRD (VV, VH) | Signal: backscatter; cloud-independent; structure. |
| Temporal | Same; multi-date composites, phenology metrics | Signal: seasonal/change; can help accuracy and robustness. |
| Structure / height | GEDI L2A, Global Forest Canopy Height | Signal or target: height, "tall" vs "low". |
| Existing tree/cover | NLCD Tree Canopy, USFS TCC, land cover | Labels, validation, or proxy targets; high data availability. |
| Terrain | DEM, slope (GEE) | Signal: terrain, shadows. |
| Points / plots | FIA | Validation, calibration. |

**Alabama**: All of the above cover or can be used for Alabama. GEE has Sentinel-2, Landsat, GEDI; NLCD/USFS/FIA are CONUS.

---

## Suggested next steps (order)

1. ~~**Map the fractal**~~: Done — candidate paths and scores are in PATH_ANALYSIS.md.
2. ~~**Select the optimal path**~~: Done — Path A (Optical + NLCD → RF) selected; implementation evolved to **Optical + Radar + seasonal composites** (see script).
3. ~~**Explore in GEE**~~: Done — Alabama AOI, seasonal composites (S2 + S1), NLCD, terrain; small-tile and full-state export supported.
4. ~~**Implement pipeline**~~: Done — seasonal composites (S2 leaf-on/leaf-off + S1) → indices + slope → sample from NLCD or NAIP points (optionally NDVI quality–filtered via gee_naip_ndvi_timeseries.js) → train RF → classify → export (see gee_alabama_tree_cover_rf.js).
5. ~~**Document**~~: Done — PROJECT_SPEC (this file), PATH_ANALYSIS, PROJECT_BOUNDARY, README.

**Optional follow-ups**: Path C (temporal + NLCD → RF) for more signal; Path B (GEDI) for validation or height product; or re-run pipeline for a different composite year.

---

## Use case this project owns

A **state-scale, reproducible, GEE-based** tree (or wooded) cover product for Alabama that:

- **Optimizes** for scalability, data pipeline efficiency, speed, accuracy, and data availability.
- **Selects** the optimal path from the fractal of possibilities (signal + labels + scale + method), rather than locking into one recipe by default.
- Exports in a **tiled, scalable** way and can be validated where reference exists.

The exact path is the one that **best satisfies the optimization criteria** under the constraints above.

---

## What we built (implemented approach)

The **current pipeline** in `gee_alabama_tree_cover_rf.js` implements **Optical + Radar + seasonal composites → RF** (evolution from the original Path A). Delivered artifact:

- **Product**: A **wooded-area map** (forest vs non-forest, 0/1) plus **probability** for Alabama at **10 m resolution**, for a **target year** (e.g. 2023). NLCD forest mask is exported at 30 m as baseline reference.
- **Labels**: NLCD 2021 land cover — forest = classes 41, 42, 43 (deciduous, evergreen, mixed); all else = non-forest. Optional: NAIP-derived points (see `gee_create_naip_label_points.js`) or NDVI quality–filtered points (see `gee_naip_ndvi_timeseries.js`) for higher-quality labels.
- **Predictors**:
  - **Optical (Sentinel-2)**: **Seasonal composites** — leaf-on (May–Sep) and leaf-off (Dec–Feb); bands B2–B8, B8A, B11, B12; indices NDVI, NDMI, NBR, RENDVI per season.
  - **Radar (Sentinel-1)**: **Seasonal composites** (same windows); VV and VH in dB, VV−VH, VV/VH; cloud-independent signal.
  - **Terrain**: slope (SRTM).
- **Method**: Random Forest in GEE on stratified samples (NLCD or NAIP labels); classify full state; export probability and binary @ 0.5. Validation: in-script stratified sample or `gee_rf_accuracy_from_assets.js` on uploaded RF + NLCD exports.

**Why this is novel vs. using NLCD alone**

- **Temporal update**: Map is for the **composite year** (e.g. 2023), not only NLCD’s 2020/2021.
- **Optical + radar + phenology**: Seasonal composites reduce confusion (e.g. crops vs forest); radar adds structure and all-weather signal.
- **Transfer of labels**: NLCD (or NAIP points) as **training label source**; model uses **our** feature set on **new** imagery — output can differ where cover changed or spectral/terrain patterns differ.

**Why it's reasonable**

- Labels from a trusted reference (NLCD or NAIP); no manual labeling at scale.
- Predictors are standard (reflectance, indices, backscatter, slope) and appropriate for forest vs non-forest.
- Pipeline is reproducible and tunable (year, seasons, RF params); full-state export via GEE tasks; 10 m export for better parcel/edge behavior.
