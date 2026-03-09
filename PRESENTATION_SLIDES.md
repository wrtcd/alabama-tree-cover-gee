# Alabama Tree Cover Mapping on Google Earth Engine
## Presentation slide content and speaker notes

Use this file to build your PowerPoint, or run `python build_presentation.py` to generate a .pptx.

---

## Slide 1: Title
**Alabama Tree Cover Mapping on Google Earth Engine**

*State-scale wooded-area map with free data and a scalable, reproducible pipeline*

- **Your name / date** (add as needed)

**Speaker note:** One-sentence pitch: We built a statewide forest/non-forest map for Alabama on GEE using free optical + radar data and NLCD-derived labels, with no manual labeling and a path to temporal updates (e.g., 2023).

---

## Slide 2: Problem & Goal
**Problem**
- Need a **state-scale tree/wooded cover** product for Alabama.
- Must use **free data**, run on **GEE**, and be **scalable** (no thousands of manual scene downloads).
- No manual polygon labeling at scale.

**Goal**
- **State-scale wooded-area map** (forest vs non-forest) at **10 m**, for a **chosen year** (e.g., 2023).
- **Reproducible pipeline**: ingest → composite/features → train → predict → export.
- **Temporally updated** relative to NLCD alone (NLCD 2020/2021 vs our composite year).

**Speaker note:** Emphasize “one root, many paths”—we didn’t lock into one recipe; we evaluated options and chose the best trade-off.

---

## Slide 3: Design Approach — “Fractal Possibilities, Optimal Path”
**We did not pick a single recipe by default.**

- **Root:** Alabama state-scale tree cover on GEE; free data; no manual labeling; lightweight.
- **Fractal:** Many valid paths (optical only, optical + radar, temporal, GEDI height, index-threshold, etc.).
- **Optimal path:** We **evaluated** candidate paths against clear criteria and **selected** the approach that best balances:
  - Optimization, scalability, pipeline efficiency, speed, accuracy, data availability.

**Speaker note:** This framing shows the work is methodical and criteria-driven, not ad hoc.

---

## Slide 4: Optimization Criteria (How We Chose the Path)
| Criterion | What we care about |
|-----------|---------------------|
| **Optimization** | Tunable pipeline (composite, features, model); not ad hoc. |
| **Scalability** | Full Alabama; tiled export; batch; no per-scene manual steps. |
| **Data pipeline** | Clear flow: ingest → composite/features → train → predict → export; GEE-native. |
| **Efficiency** | Bounded compute and I/O. |
| **Speed** | Time to first result and full-state result tractable (hours to days). |
| **Accuracy** | Measurable vs reference (NLCD, FIA); labels support validation. |
| **Data availability** | Free, Alabama coverage, ideally CONUS/global. |

**Speaker note:** Path A (Optical + NLCD → RF) scored best on pipeline, scalability, accuracy, and data availability while staying fast and efficient.

---

## Slide 5: Candidate Paths We Evaluated
| Path | Signal | Labels | Method |
|------|--------|--------|--------|
| **A (chosen)** | Optical (S2) + radar (S1) + seasonal composites + terrain | NLCD forest classes (or NAIP points) | RF in GEE; 10 m export |
| **B** | Optical + terrain | GEDI height | RF; GEDI sparse → scalability issues |
| **C** | Temporal optical + terrain | NLCD | RF; more signal, more compute |
| **D** | Single composite + terrain | NLCD/FIA validation only | Index-threshold; fast but weak accuracy |

**Why Path A:** Best balance of pipeline clarity, scalability, accuracy, and data availability; no GEDI grid aggregation; seasonal composites + radar improve separation of forest vs crops/grass.

**Speaker note:** Path C is the natural upgrade for more accuracy if we can afford more compute; Path B is better for validation or a height product.

---

## Slide 6: What We Built — Implemented Pipeline (Path A+)
**Delivered product**
- **Wooded-area map** (0 = non-forest, 1 = forest) for **Alabama** at **10 m** (export; labels at 30 m baseline).
- **Target year** set by composite date (e.g., 2023).
- **Labels:** NLCD 2021 — forest = classes 41, 42, 43 (deciduous, evergreen, mixed); all else = non-forest. Optional: NAIP-derived points for better accuracy.
- **Predictors:**  
  - Sentinel-2 seasonal composites (leaf-on, leaf-off): bands + **NDVI, NDMI, NBR, red-edge NDVI**.  
  - **Sentinel-1** seasonal composites (VV, VH in dB; ratios).  
  - **Slope** (SRTM).
- **Method:** Random Forest in GEE → classify full state → export GeoTIFF (probability + binary @ 0.5).

**Speaker note:** Implementation went beyond “optical + NDVI + slope” to include radar and seasonal composites for better separation of forest vs crops/grass.

---

## Slide 7: Pipeline Architecture (High Level)
```
[Sentinel-2] ──► Cloud mask ──► Seasonal composites (leaf-on / leaf-off) ──► Indices (NDVI, NDMI, NBR, RENDVI)
[Sentinel-1] ──► Seasonal composites (VV, VH dB) ──► Ratios
[SRTM]       ──► Slope
[NLCD 2021]  ──► Forest mask (41,42,43 → 1) ──► Training labels (no manual labeling)

                    ▼
         Stratified sampling → Train RF (GEE) → Classify full state → Export (Drive)
                    ▼
         GeoTIFF: probability map + binary forest @ 0.5 + NLCD baseline (for validation)
```

**Speaker note:** Everything runs in GEE; export is tiled/batch via Tasks to avoid memory limits.

---

## Slide 8: Why This Is Useful vs. Using NLCD Alone
| Aspect | NLCD only | Our pipeline |
|--------|-----------|--------------|
| **Temporal** | NLCD 2020/2021 release cycle | Map for **composite year** (e.g., 2023) — temporally updated. |
| **Signal** | USGS workflow | **Our** features (S2 + S1 seasonal + indices + slope); can differ where land cover changed or spectral/terrain differ. |
| **Resolution** | 30 m | 10 m export; NLCD baseline at 30 m for comparison. |
| **Labels** | N/A | NLCD used as **training source**; model transfers to **new** imagery. |

**Speaker note:** We are not replacing NLCD; we use it as a label source and produce an updated map for a chosen year with the same resolution (or finer export) for comparison.

---

## Slide 9: Technical Implementation Summary
- **Platform:** Google Earth Engine (Code Editor JS + optional Python/geemap).
- **Training:** Stratified sampling (balanced forest/non-forest); ~2k–6k points per class; 300 trees; in-GEE RF.
- **Memory strategy:** No full-state layers on the map; export via Tasks; evaluation on stratified sample or uploaded assets.
- **Exports:** (1) Probability of forest, (2) Binary forest @ 0.5, (3) NLCD forest mask (30 m) for comparison.
- **Validation:** In-GEE (confusion matrix on stratified sample); optional `gee_rf_accuracy_from_assets.js` for uploaded RF + NLCD assets (multi-seed sampling, accuracy/kappa).

**Speaker note:** Key artifacts: `gee_alabama_tree_cover_rf.js`, `gee_rf_accuracy_from_assets.js`, `gee_explore_alabama_geemap.py`, `gee_naip_ndvi_timeseries.js`, `gee_create_naip_label_points.js`.

---

## Slide 10: Validation & Metrics
- **In-GEE:** Confusion matrix (RF vs NLCD) on stratified sample; overall accuracy, kappa, producer/consumer accuracy printed in Console.
- **From assets:** Upload RF + NLCD GeoTIFFs as assets → `gee_rf_accuracy_from_assets.js` → multi-seed sampling, accuracy/kappa, optional CSV export.
**Speaker note:** Validation is GEE-native (in-script or from assets); FIA can be added later for independent validation.

---

## Slide 11: Optional Upgrade — NAIP-Derived Labels
- **Limitation:** Training on NLCD means we approximate NLCD; edge and class errors carry over.
- **Upgrade:** Create **manual 0/1 labels** from NAIP imagery.
  - `gee_create_naip_label_points.js` exports point grid (core_forest, core_nonforest, edge).
  - Label in QGIS with NAIP basemap; fill `forest_label` (0/1).
  - Upload as asset; set `LABEL_MODE = 'NAIP_POINTS'` in main script.
- **Result:** Same pipeline, better label quality, no change to export or scale.

**Speaker note:** Optional follow-up for higher accuracy without changing the rest of the pipeline.

---

## Slide 12: Deliverables & Repo Structure
- **Product:** Alabama wooded-area map (0/1) at 10 m (and NLCD baseline at 30 m) for chosen year.
- **Code:**  
  - `gee_alabama_tree_cover_rf.js` — main pipeline (paste in GEE Code Editor; run exports in Tasks).  
  - `gee_rf_accuracy_from_assets.js` — accuracy from uploaded RF + NLCD assets.  
  - `gee_create_naip_label_points.js` — NAIP label point export.  
  - `gee_naip_ndvi_timeseries.js` — NDVI timeseries + quality filter for NAIP points.  
  - `gee_explore_alabama_geemap.py` — same workflow via geemap (optional).
- **Docs:** PROJECT_SPEC.md, PROJECT_BOUNDARY.md, PATH_ANALYSIS.md, README.md.

**Speaker note:** Everything is documented and runnable; no proprietary or paywalled data.

---

## Slide 13: Summary
- **Goal:** State-scale tree cover for Alabama on GEE with free data and a scalable pipeline.
- **Approach:** Evaluated multiple paths against optimization criteria; selected **Path A (Optical + NLCD → RF)** and extended it with **Sentinel-1 and seasonal composites**.
- **Output:** Wooded-area map (forest/non-forest) at 10 m for a chosen year; temporally updated vs NLCD; validated in GEE (in-script or from assets).
- **Next steps (optional):** Path C (temporal) for more signal; NAIP labels for better accuracy; GEDI for validation or height product.

**Speaker note:** Close with the one-liner: reproducible, criteria-driven, scalable Alabama tree cover on GEE with no manual labeling at scale.

---

## Slide 14: Thank you / Q&A
**Thank you**

Questions?

- **Repo / code:** See README.md and PROJECT_SPEC.md.
- **Validation:** gee_rf_accuracy_from_assets.js (upload RF + NLCD assets).

