# Training Data (NAIP Points) and Accuracy — FAQ

Scope, validation design, and what this product solves: [SCOPE.md](SCOPE.md).

## 1. How were the NAIP points generated?

**Script:** `gee_create_naip_label_points.js`

**Steps:**

1. **Stratified grid**  
   We don’t random-sample the whole state. We use **NLCD 2021** only to define three strata and then sample **within** them so we get both classes and edge cases:
   - **Core forest:** NLCD 41/42/43 (deciduous/evergreen/mixed), excluding a 60 m “edge” buffer.
   - **Core non-forest:** NLCD not 41/42/43, excluding edge.
   - **Edge:** 60 m neighborhood where forest and non-forest mix (ambiguous boundaries).

2. **Target counts (per stratum)**  
   - `N_CORE_FOREST = 1500`  
   - `N_CORE_NONFOREST = 1500`  
   - `N_EDGE = 1500`  
   So the design is **up to 4,500 points** (1,500×3).

3. **Why you see ~700**  
   - GEE’s `sample()` is **up to** `numPixels`: if a stratum has fewer valid pixels than 1,500, you get fewer points.  
   - So the actual total is often **1,000+** after labeling and NDVI filter when some strata don’t have enough area or the sampler hits limits.

4. **Export**  
   Points are exported as GeoJSON (or SHP). You then **manually label** in QGIS (or similar) using NAIP/high-res imagery: set `forest_label` (or `forest_lab`) to **1** = forest, **0** = non-forest. Only **labeled** points are used later.

So: **~700** = stratified design (core forest, core non-forest, edge) with a cap of 800 per stratum, reduced by what’s actually available and by your manual labeling (only labeled points count).

---

## 2. Why did NDVI filtering reduce them to ~449?

**Script:** `gee_naip_ndvi_timeseries.js`

- For each NAIP point we get a **12‑month Sentinel‑2 NDVI timeseries** (2023) and compute `mean_ndvi`, `min_ndvi`, `max_ndvi`, `ndvi_amplitude`.
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

- **Increase the design size** in `gee_create_naip_label_points.js`: e.g. try **1,500 or 2,000 per stratum** (if GEE and your labeling capacity allow) so that after labeling and NDVI filtering you still have **1,000+** points.
- **Keep NDVI filtering**; it improves quality. Optionally relax thresholds slightly (e.g. `min_ndvi >= 0.15`, `mean_ndvi >= 0.20`) if you are losing too many good labels.
- **Balance classes:** Aim for similar number of forest and non-forest after filtering (the RF script already balances by capping per class with `STRATIFIED_POINTS_PER_CLASS`).

---

## 4. Points vs. polygons (both in scope)

- **Polygon training in scope:** We support “manual polygon labeling at scale” (see [SCOPE.md](SCOPE.md)). You can train from NAIP-derived polygons (hand-drawn in QGIS or from gee_export_polygon_candidates.js); the pipeline samples every pixel inside each polygon and balances by class.
- **Efficiency:** Points are fast to label (one click per location in QGIS with NAIP), so we can get **hundreds to thousands** of labels in reasonable time. Polygons would give more pixels per label but far fewer labels for the same effort.
- **Existing products:** For a **state-scale** baseline we use **NLCD** (or NAIP-derived points) as the **source of labels**. NLCD is already polygon/raster; we either:
  - sample **points** from NLCD (no manual drawing), or  
  - use **points** you label from NAIP to get **better than NLCD** where you need it.
- **RF in GEE:** The classifier needs **per-pixel** training rows. Points give one row per point; polygons are rasterized and sampled (handled via sampleRegions). Both are supported (LABEL_MODE: NAIP_POINTS or NAIP_POLYGONS).

**Summary:** Points and polygons are both in scope (one label source per run). For higher accuracy, the main lever is **more quality points and/or polygons** (see [TRAINING.md](TRAINING.md) and [TRAINING_DATA_STRATEGY.md](TRAINING_DATA_STRATEGY.md)).

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
   Set `RF_ASSET` at the top of the script to your asset ID.

2. **NLCD-based reference (0/1)**  
   The NLCD forest mask (41/42/43 → 1, else 0), e.g. `alabama_NLCD_forest_mask_30m` or similar.  
   In the script this is `alabama_NLCD_2021`; use CASE 1 if it’s already 0/1, CASE 2 if it’s raw landcover codes.

**You do not need** the probability raster for this script. It only does **classification accuracy** (binary vs binary); probability would be used for things like calibration or ROC curves, not for the confusion matrix / OA / kappa in this script.

**Updating the script for your asset names:**  
Edit the two lines at the top of `gee_rf_accuracy_from_assets.js` so they point to your actual asset IDs (e.g. `alabama_rf_forest_binary_naip_05_10m` and your NLCD asset). Once those two uploads succeed and the paths are correct, you can run the accuracy script.

---

## 7. FIA-based validation (independent reference)

**Script:** `gee_rf_accuracy_from_fia.js`

FIA (Forest Inventory and Analysis) plot data is an **independent** reference: field-based forest/nonforest, not derived from the same imagery or models as NLCD. Validating against FIA gives a stronger measure of how well the map matches reality.

**Steps:**

1. **Get FIA data for Alabama**  
   - Go to [FIA DataMart](https://apps.fs.usda.gov/fia/datamart/datamart.html), select **Alabama**, download **PLOT** and **COND** tables (CSV).

2. **Build one row per plot with forest (0/1)**  
   - Join PLOT (by `CN`) to COND (by `PLT_CN`).  
   - In COND: `COND_STATUS_CD` = 1 means **forest land**, 2 = nonforest. Each plot can have multiple conditions; `CONDPROP_UNADJ` is the proportion of the plot in that condition.  
   - For each plot: take the condition with the **largest** `CONDPROP_UNADJ`; set **forest = 1** if that condition has `COND_STATUS_CD == 1`, else **forest = 0**.

3. **Export a point table**  
   - From PLOT use `LAT`, `LON` (public coordinates are perturbed ~0.8 km for privacy; still useful for state-scale validation).  
   - Create a CSV with columns: **lon**, **lat**, **forest**.  
   - Convert to GeoJSON: each row → a Point feature with properties `{ "forest": 0 or 1 }`.

4. **Upload to GEE**  
   - Assets → New → Table → upload the GeoJSON (or CSV with geometry). Create a **FeatureCollection** asset (e.g. `alabama_fia_plot_forest_points`).

5. **Run the FIA validation script**  
   - In `gee_rf_accuracy_from_fia.js` set `RF_ASSET` to your RF binary image asset and `FIA_POINTS_ASSET` to your FIA FeatureCollection.  
   - Run the script. It samples the RF map at each FIA point and prints confusion matrix, overall accuracy, kappa, and producer/consumer accuracy.

**Note:** Public FIA coordinates are perturbed, so the pixel sampled may not be the exact plot location. The result is still a useful state-scale check. For exact coordinates, contact [FIA Spatial Data Services](https://research.fs.usda.gov/programs/fia/sds).

---

## Spatial strip (block) holdout

Instead of (or in addition to) random point holdout, you can **hold out a whole region** (strip or block) from training and validate only there. That tests whether the model generalizes to an area it has never seen.

In **`gee_alabama_tree_cover_rf.js`** set **`SPATIAL_HOLDOUT_ENABLED = true`** and define **`SPATIAL_HOLDOUT_REGION`** as an `ee.Geometry.Rectangle([minLon, minLat, maxLon, maxLat])` (or any geometry). The script will:

- **Training:** Exclude all NAIP points/polygons that fall inside that region (or, for NLCD, sample only outside the region).
- **Validation:** After prediction, take a stratified sample of RF vs NLCD **only inside the strip** and print confusion matrix, OA, and kappa for that region.

Edit the rectangle coords to match your strip (e.g. a vertical band across Alabama). The strip is intersected with the Alabama boundary so only in-state area is used.

---

## Accuracy results (vs NLCD 0/1 reference)

Stratified sampling over Alabama; multiple seeds (42, 1337, 2025); ~8,000 points per class per seed. Reference: NLCD forest mask (0/1). Metrics from `gee_rf_accuracy_from_assets.js` (export to Drive for full per-seed CSV).

| Model | Mean overall accuracy | Mean kappa |
|-------|------------------------|-----------|
| **RF trained on NAIP points** (binary @ 0.5, 10 m) | 0.742 | 0.483 |
| **RF trained on NLCD** (binary @ 0.5, 10 m) | **0.789** | **0.579** |

*Note:* These metrics compare the RF output to **NLCD as the reference**. The NLCD-trained model scores higher in this setup because it is trained to match NLCD; the NAIP model uses human-labeled points and can disagree with NLCD where labels differ. NLCD itself has noise at 30 m; some NAIP-vs-NLCD disagreement may reflect the RF improving on NLCD. Use producer/consumer accuracy and visual checks to interpret class-wise performance.

---

## Summary

| Topic | Answer |
|-------|--------|
| NAIP points | Stratified sample (core forest, core non-forest, edge), 1,500 per stratum → you label in QGIS; aim for 1,000+ after labeling and NDVI filter. |
| ~449 | Subset that passes NDVI quality filter (min/mean NDVI thresholds) to remove bad/non-veg points. |
| Sample size | 449 is usable but low for state-scale; aim for 1,000+ quality points (increase stratum size and/or relax NDVI slightly). |
| Points vs polygons | Both in scope (one label source per run). See TRAINING.md and TRAINING_DATA_STRATEGY.md. |
| GEE upload error | Use asset ID without leading `/`; shorten name; create folder first; check file. |
| Accuracy rasters | **NLCD script:** binary RF + NLCD 0/1. **FIA script:** binary RF + FIA points asset (lon, lat, forest). No probability needed. |
| FIA validation | Independent reference; see §7 for FIA DataMart → GeoJSON → GEE asset and `gee_rf_accuracy_from_fia.js`. |

Good training data = good model; focusing on **more quality NAIP points** (and optional validation with polygons) is the right direction.
