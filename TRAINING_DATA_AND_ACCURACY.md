# Training Data (NAIP Points) and Accuracy — FAQ

## 1. How were the NAIP points generated?

**Script:** `gee_create_naip_label_points.js`

**Steps:**

1. **Stratified grid**  
   We don’t random-sample the whole state. We use **NLCD 2021** only to define three strata and then sample **within** them so we get both classes and edge cases:
   - **Core forest:** NLCD 41/42/43 (deciduous/evergreen/mixed), excluding a 60 m “edge” buffer.
   - **Core non-forest:** NLCD not 41/42/43, excluding edge.
   - **Edge:** 60 m neighborhood where forest and non-forest mix (ambiguous boundaries).

2. **Target counts (per stratum)**  
   - `N_CORE_FOREST = 800`  
   - `N_CORE_NONFOREST = 800`  
   - `N_EDGE = 800`  
   So the design is **up to 2,400 points** (800×3), not 700.

3. **Why you see ~700**  
   - GEE’s `sample()` is **up to** `numPixels`: if a stratum has fewer valid pixels than 800, you get fewer points.  
   - So the actual total is often **less than 2,400** (e.g. ~700–900) when some strata don’t have enough area or the sampler hits limits.

4. **Export**  
   Points are exported as GeoJSON (or SHP). You then **manually label** in QGIS (or similar) using NAIP/high-res imagery: set `forest_label` (or `forest_lab`) to **1** = forest, **0** = non-forest. Only **labeled** points are used later.

So: **~700** = stratified design (core forest, core non-forest, edge) with a cap of 800 per stratum, reduced by what’s actually available and by your manual labeling (only labeled points count).

---

## 2. Why did NDVI filtering reduce them to ~449?

**Script:** `gee_naip_ndvi_timeseries.js`

- For each NAIP point we get a **12‑month Sentinel‑2 NDVI timeseries** (e.g. 2023 or match your target year) and compute `mean_ndvi`, `min_ndvi`, `max_ndvi`, `ndvi_amplitude`.
- **Quality filter** (optional but recommended):
  - `min_ndvi >= 0.20`  (drop very barren/water)
  - `mean_ndvi >= 0.25` (drop persistently low vegetation)
- Points that fail these thresholds are removed to avoid **mislabeled or non-vegetation** (water, bare soil, clouds, bad geometry) from hurting the RF.

So **~449** = the subset of your **labeled** points that pass the NDVI quality filter. The drop from ~700 is by design to improve label quality, not a bug.

---

## 3. Is ~449 too few for Alabama? What does the literature say?

**Short answer:** It’s on the low side for ideal accuracy, but RF is robust; more points (especially per class) will help.

**Rough guidance from remote-sensing / RF literature:**

- **Per-class:** Many studies use **hundreds to a few thousand** training pixels per class for land-cover RF; 750+ per class is often enough for >90% OA when the scene is representative.
- **Total:** Studies report good results with **~300–500** samples total, but **accuracy and stability usually improve** with **1,000–10,000+** (especially for large, heterogeneous areas).
- **State-scale:** For “state of Alabama” size, **thousands** of well-distributed, quality-labeled points are a safer target; **449 total** is workable for a first model but can underperform in rare classes or complex ecoregions.

**Practical recommendation:**

- For **state-scale** (Alabama), training data should be in the **order of 1,000s** of quality samples. **Increase the design size** in `gee_create_naip_label_points.js`: e.g. try **1,500 or 2,000 per stratum** (if GEE and your labeling capacity allow) so that after labeling and NDVI filtering you still have **1,000+** points.
- **Keep NDVI filtering**; it improves quality. Optionally relax thresholds slightly (e.g. `min_ndvi >= 0.15`, `mean_ndvi >= 0.20`) if you are losing too many good labels.
- **Balance classes:** Aim for similar number of forest and non-forest after filtering (the RF script already balances by capping per class with `STRATIFIED_POINTS_PER_CLASS`).
- **Validation:** Hold out a **portion of the original training data** (e.g. 20%) for validation/testing, and consider holding out a **strip or region** of the study area for spatial validation. Where available, **FIA plots and boundaries** (forest/non-forest) can be used for independent validation.

---

## 4. Why points, polygons, or both?

- **NLCD** is 30 m and not the most accurate; it is kept as a **baseline option**. For better accuracy, use **NAIP-derived** (or hybrid NAIP + Google Satellite / other reference) labels. **Manual labeling is fine**; the focus is on **quality** training data.
- **Points:** Fast to label (one click per location in QGIS with NAIP/high-res), so we can get **hundreds to thousands** of labels. Good for edges and mixed areas.
- **Polygons:** Fewer labels but many pixels per label; good for large homogeneous patches. Drawing many polygons at state scale is more effort, but **a combination of points and polygons** is recommended—points for diversity/edges, polygons for efficient coverage of pure forest/non-forest.
- **RF in GEE:** The classifier needs **per-pixel** training rows. Points give one row per point; polygons are rasterized and sampled. The script supports **one label source per run** (NLCD, NAIP_POINTS, or NAIP_POLYGONS); use both in your workflow (e.g. separate runs or future combined mode) to maximize quality and coverage.

**Summary:** Use a **combination of points and polygons** where practical. Training data should be in the **order of 1,000s** for this scale. Focus on **procuring quality data**; manual labeling is in scope.

---

## 5. GEE upload error: "Cannot read properties of undefined (reading 'startsWith')"

**What it usually means:** The upload UI or backend is calling `.startsWith()` on something that is `undefined` (often the asset path or a part of it).

**Try this:**

1. **No leading slash**  
   Use:
   ```text
   projects/earthengine-441016/assets/alabama_rf_forest_binary_naip_05_10m
   ```
   Not:
   ```text
   /projects/earthengine-441016/assets/...
   ```

2. **Shorter asset name**  
   If it still fails, try a shorter ID, e.g.:
   ```text
   projects/earthengine-441016/assets/alabama_rf_binary_naip_10m
   ```

3. **Create the asset folder first**  
   In **Assets** → your project → **New** → **Folder** → e.g. `alabama_rf`. Then upload the image into that folder and set the asset ID to something like:
   ```text
   projects/earthengine-441016/assets/alabama_rf/forest_binary_naip_05_10m
   ```

4. **Upload method**  
   Use **Assets** → **New** → **Image** → upload GeoTIFF, and type the full asset ID in the field that asks for the destination. If the error persists, it may be a GEE UI bug; try another browser or a different asset ID format (e.g. with a folder prefix).

5. **Check file**  
   Ensure the GeoTIFF is a single-band (or known multi-band) raster and not corrupted; sometimes problematic files trigger backend errors that surface as `startsWith`.

---

## 6. Which rasters do you need for the accuracy script? Do you need the probability raster?

**Script:** `gee_rf_accuracy_from_assets.js`

**You need exactly two assets:**

1. **RF binary (0/1) map**  
   Your classification at 0.5 threshold (e.g. the export named like `alabama_rf_forest_binary_naip_05_10m`).  
   In the script this is currently hard-coded (e.g. `alabama_2023_RF` or your year). If your asset has a different name, update the script (see below).

2. **NLCD-based reference (0/1)**  
   The NLCD forest mask (41/42/43 → 1, else 0), e.g. `alabama_NLCD_forest_mask_30m` or similar.  
   In the script this is `alabama_NLCD_2021`; use CASE 1 if it’s already 0/1, CASE 2 if it’s raw landcover codes.

**You do not need** the probability raster for this script. It only does **classification accuracy** (binary vs binary); probability would be used for things like calibration or ROC curves, not for the confusion matrix / OA / kappa in this script.

**Updating the script for your asset names:**  
Edit the two lines at the top of `gee_rf_accuracy_from_assets.js` so they point to your actual asset IDs (e.g. `alabama_rf_forest_binary_naip_05_10m` and your NLCD asset). Once those two uploads succeed and the paths are correct, you can run the accuracy script.

---

## 7. Validation design: hold-out and FIA

- **Hold out a portion of training data:** Reserve a fraction (e.g. 20%) of your labeled points/polygons for validation/testing so accuracy is not evaluated on the same data used to train the model.
- **Hold out a region or strip:** Reserve a **section, strip, or region** of the study area (e.g. a county or a north–south strip) for **spatial** validation; train on the rest and evaluate on the held-out geography to assess generalization.
- **FIA plots and boundaries:** Where available, use **FIA (Forest Inventory and Analysis) plots and boundaries** (forest vs non-forest) as an **independent** validation set. FIA provides field-based reference that is not derived from the same imagery or NLCD used in training.

---

## Accuracy results (vs NLCD 0/1 reference)

Stratified sampling over Alabama; multiple seeds (42, 1337, 2025); ~8,000 points per class per seed. Reference: NLCD forest mask (0/1). Metrics from `gee_rf_accuracy_from_assets.js` (export to Drive for full per-seed CSV).

| Model | Mean overall accuracy | Mean kappa |
|-------|------------------------|-----------|
| **RF trained on NAIP points** (binary @ 0.5, 10 m) | 0.742 | 0.483 |
| RF trained on NLCD (binary @ 0.5, 10 m) | — | — *(run when asset ready)* |

*Note:* These metrics compare the RF output to NLCD as “truth.” NLCD itself has noise at 30 m; some disagreement may reflect RF improving on NLCD. Use producer/consumer accuracy and visual checks to interpret class-wise performance.

---

## Summary

| Topic | Answer |
|-------|--------|
| NAIP points | Stratified sample (core forest, core non-forest, edge), 800+ per stratum design; you label in QGIS (manual labeling is fine). |
| ~449 | Subset that passes NDVI quality filter (min/mean NDVI thresholds) to remove bad/non-veg points. |
| Sample size | For state-scale, training data should be in the **order of 1,000s**; aim for 1,000+ quality points (increase stratum size and/or relax NDVI slightly). |
| Points vs polygons | Use a **combination**: points for edges/diversity, polygons for homogeneous patches; focus on **quality** data. |
| Validation | Hold out a portion of training data and/or a region/strip of the study area; use **FIA plots/boundaries** where available. |
| GEE upload error | Use asset ID without leading `/`; shorten name; create folder first; check file. |
| Accuracy rasters | Only **binary RF** + **NLCD 0/1**; **no probability** needed for the current accuracy script. |

Good training data = good model; focus on **procuring quality data** (points + polygons, 1,000s scale) and validation design.
