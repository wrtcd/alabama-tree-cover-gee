# Direction: framework, architecture, sample collection

Single place for **where we’re going** given the research gap (10 m, 2025). Use this to align framework, architecture, and sample collection.

---

## Vision (fixed)

- **Resolution:** 10 m (fill the gap: existing forest maps are 30 m).
- **Target year:** 2025 (temporally updated product).
- **Goal:** State-scale forest/non-forest map for Alabama that supports finer parcel/edge analysis and is **better than 30 m baselines** where we have better labels.

---

## Framework

**High-level approach:**

1. **Free, scalable stack**  
   GEE + Sentinel-2 + Sentinel-1 + terrain; no paid imagery as core; pipeline runs statewide (tiled export).

2. **Quality over convenience**  
   NLCD is 30 m and not the most accurate. To beat 30 m we need **labels that are better than NLCD** (e.g. NAIP + high-res reference). Manual labeling is in scope; the constraint is **quality**, not “no manual work.”

3. **Validation by design**  
   - Hold out a **portion of training data** (e.g. 20%) for validation/testing.  
   - Hold out a **region or strip** of Alabama for spatial validation.  
   - Use **FIA plots/boundaries** (forest/non-forest) as independent reference where available.

4. **Lightweight ML**  
   Random Forest (or similar) as the core classifier; no heavy deep learning in the main pipeline so we can iterate on data and validation.

**Implication:** Invest in **label quality and validation design**; treat NLCD as a baseline, not the target.

---

## Architecture

**Pipeline (logical flow):**

```
[Inputs]
  • Alabama AOI
  • Target year (e.g. 2025)

[Predictors] (all free, GEE)
  • Sentinel-2 seasonal composites (leaf-on, leaf-off) → bands + indices (NDVI, NDMI, NBR, RENDVI)
  • Sentinel-1 seasonal composites (VV, VH, ratios) → radar
  • SRTM slope

[Labels] (choose one source per run for now)
  • NLCD 2021 (forest 41/42/43) — baseline only, 30 m
  • NAIP-derived points (manual labels in QGIS)
  • NAIP-derived polygons (manual or candidate approval)
  • (Future) Hybrid: NAIP + Google Satellite or other reference

[Model]
  • Random Forest (GEE smileRandomForest)
  • Train on sampled pixels at label locations; balance classes; optional NDVI quality filter for points

[Outputs]
  • Probability raster (10 m)
  • Binary forest/non-forest @ 0.5 (10 m)
  • NLCD forest mask (30 m) as baseline reference

[Validation]
  • Hold-out training sample + hold-out region/strip + FIA where available
  • Accuracy script: RF binary vs reference (NLCD or FIA) over stratified sample
```

**Code layout:** One main script (`gee_alabama_tree_cover_rf.js`) drives the pipeline; separate scripts for label creation (points, polygon candidates, NDVI filter) and accuracy from assets. Python/geemap optional for exploration.

---

## Sample collection

**What the numbers suggest:**

- **NLCD RF** (train on NLCD, validate vs NLCD): ~0.79 OA, ~0.58 kappa — circular; good for “replicate NLCD at 10 m” only.
- **NAIP-points RF** (train on manual NAIP points, validate vs NLCD): ~0.74 OA, ~0.48 kappa — when validated on NLCD, looks worse, but labels are independent; with more and better points we can aim above NLCD.

**Direction for filling the research gap:**

1. **Label source**  
   Move toward **hybrid** labels: NAIP + high-res reference (e.g. Google Satellite) for consistency. Keep NLCD as a baseline option, not the primary label source for the “best” run.

2. **Points + polygons**  
   Use **both** in the workflow:
   - **Points:** Stratified (core forest, core non-forest, edge); scale to **1,500+ per stratum** so after labeling and NDVI filter you have **1,000+** quality points. Good for edges and diversity.
   - **Polygons:** Homogeneous patches (forest / non-forest); candidate export from NLCD + approve/edit in QGIS, or hand-draw. Many pixels per label; good for efficient coverage.
   - Run the RF script with one mode per run (points *or* polygons); a future “combined” mode could merge both in one training set.

3. **Scale**  
   For state-scale Alabama, target **order of 1,000s** of quality training samples (points and/or polygon-derived pixels). Few hundred is workable but 1,000+ is the target.

4. **Quality controls**  
   - NDVI filter on points (drop barren/water/cloud).
   - Prefer compact, homogeneous polygons.
   - Stratify across ecoregions / land use where possible so the model sees the full variety.

5. **Validation**  
   - Reserve **~20% of labeled data** for validation (no training on it).
   - Reserve a **geographic strip or region** (e.g. one or more counties) for spatial validation.
   - Use **FIA plots/boundaries** as independent forest/non-forest reference when available; report accuracy vs NLCD and vs FIA separately.

---

## Summary

| Pillar            | Direction |
|-------------------|-----------|
| **Framework**     | Free, scalable GEE pipeline; quality labels over convenience; validation by design (hold-out data + region + FIA); RF as core. |
| **Architecture**  | S2 + S1 + slope → RF → 10 m probability + binary; one label source per run; separate scripts for labels and accuracy. |
| **Sample collection** | Hybrid labels (NAIP + reference); points + polygons; 1,000s scale; NDVI/quality filters; hold-out + FIA validation. |

**Next steps:** Prioritize (1) scaling point and/or polygon collection to 1,000+ quality samples, (2) defining a hold-out region and hold-out fraction for training data, and (3) adding FIA-based validation where data exist.
