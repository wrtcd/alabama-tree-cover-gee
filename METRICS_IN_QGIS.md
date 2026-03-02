# Computing metrics on the RF map in QGIS

You’ve downloaded the Alabama RF forest map (0/1) and opened it in QGIS. These workflows compute metrics **locally in QGIS** so you avoid GEE memory limits.

---

## 1. Metrics you can compute

| Metric | What it is | How (QGIS) |
|--------|------------|-------------|
| **Area (forest vs non-forest)** | Total forest area, % forest | Raster layer statistics or Raster Calculator → count × pixel area |
| **Accuracy vs reference** | Agreement with NLCD (or another reference) | Confusion matrix (SAGA or Raster Calculator) |
| **By region** | Forest area or % per county / watershed | Zonal Statistics (raster + polygon layer) |

---

## 2. Area and pixel counts (no reference needed)

Your RF layer is 0 (non-forest) and 1 (forest) at 30 m.

- **Raster → Zonal Statistics** (or **Layer Properties → Histogram**): count pixels per value (0 and 1).
- **Forest area** = (number of pixels with value 1) × (30 × 30) m².  
  Or use **Raster Calculator**:  
  `"rf_band@1" = 1` → output 1/NoData, then **Raster → Conversion → Rasterize** or use **Raster layer statistics** on the binary layer to get pixel count.
- In **Layer Properties → Information**, check **Dimensions** (cols × rows) and **CRS** to confirm resolution (e.g. 30 m) and extent.

---

## 3. Accuracy vs NLCD (confusion matrix)

To get overall accuracy, kappa, and class-wise agreement you need a **reference raster** aligned to your RF map (same extent, same 30 m grid). NLCD 2021 is the natural reference (forest = 41, 42, 43; non-forest = else).

### 3a. Get the NLCD forest mask (reference) for Alabama

- **From GEE (easiest)**: The script `gee_alabama_tree_cover_rf.js` now exports the **NLCD forest mask** (classes 41, 42, 43 → 1, else → 0) as a second task: `alabama_NLCD_forest_mask_30m`. Run that export in the Tasks panel along with the RF export. You get a GeoTIFF with the same extent, scale (30 m), and alignment as the RF map — use it as the reference in QGIS.
- **From USGS**: [NLCD 2021](https://www.mrlc.gov/data) — download the tile(s) covering Alabama, clip to your area, resample to 30 m if needed, then reclass 41/42/43 → 1, else → 0 so classes match (0 = non-forest, 1 = forest).

Load the RF map and the NLCD 0/1 reference in QGIS; they must overlap and align (same CRS and cell size).

### 3b. Confusion matrix in QGIS

**Option A – SAGA (recommended)**  
1. **Processing → Toolbox** → search **“Confusion Matrix”** and open the tool that uses **two rasters** (e.g. **“Confusion Matrix (Two Rasters)”**).  
2. Fill in the parameters as follows:

| Parameter | What to choose | Your layer |
|-----------|----------------|------------|
| **Classification** / **Predicted** / **Grid 1** (your map) | The layer you produced | `alabama_pathA_RF_full_30m` (RF 0/1 map) |
| **Reference** / **Ground truth** / **Grid 2** (truth) | The reference layer | `alabama_NLCD_forest_mask_30m` (NLCD forest mask 0/1) |

3. Leave other options at default (e.g. class values 0 and 1 are usually auto-detected from the rasters).  
4. Run. You get a confusion matrix and often overall accuracy and kappa.

**If you get "Wrong or missing parameter value" or "Value error"**  
The GEE exports are **float** (0.0, 1.0). Some SAGA tools expect **integer** class rasters. Try one of:

- **Convert to integer with GDAL Translate**: For each raster (RF and NLCD mask), use **Raster → Conversion → Translate (Convert)**. Set **Input layer** to your raster, **Output data type** to **Int16** or **Int32**, and choose an output path. Run for both rasters, then run the confusion matrix on these integer GeoTIFFs. (Do **not** use Raster Calculator `round()` — it is not valid in QGIS Raster Calculator.)
- **Use Option B below** (Raster Calculator agreement map): it works with float rasters and gives you **overall accuracy** without converting or using SAGA.
- **Check parameter types**: Ensure you selected a **raster layer** (not a band name string). If the tool asks for "Grid" or "Layer", pick the layer from the dropdown. If it asks for "Band", use band 1.

**If the tool complains about "Value" or "Value (Maximum)" or "Name" parameters**  
The SAGA **Confusion Matrix (Two Grids)** tool has optional **Look-up Table** parameters (Value, Value (Maximum), Name for Classification 1 and Classification 2). When you don’t use a LUT, the QGIS wrapper may still show these and can throw a "value" error if they’re left in an invalid state. Try:

1. **No LUT**: Leave **Look-up Table** empty for both grids. If there are dropdowns for "Value", "Value (Maximum)", "Name", set them to **&lt;not set&gt;** or the first option (e.g. "None") if available. Leave **Include Unclassified Cells** as 0 (unchecked) so NoData is excluded.
2. **All outputs**: Ensure every output has a value — use **Save to temporary file** for **Combined Classes**, **Confusion Matrix**, **Class Values**, and **Summary** if you don’t need to keep them.
3. **With a LUT (if the error persists)**: See **§3c** below for step-by-step LUT creation and how to fill the value parameters so the tool runs.

If it still fails, use **Option B** (§3d) below — pure QGIS, no SAGA.

### 3c. Make SAGA run: use a lookup table (when Value parameters must be set)

The plugin often will not run with empty Value parameters. Give it a minimal lookup table and point the parameters to it.

**Step 1 – Create the CSV**

Create a text file named e.g. `lut_classes.csv` with **no spaces** after commas:

```text
min,max,name
0,0,Non-forest
1,1,Forest
```

Save it (e.g. in your project folder).

**Step 2 – Add it in QGIS**

- **Layer → Add Layer → Add Delimited Text Layer** (or **Add Delimited Text Layer** from the Layer menu).
- **File name**: browse to `lut_classes.csv`.
- Set **Geometry definition** to **No geometry (attribute only table)**.
- Click **Add**, then **Close**. The table appears in the Layers panel.

**Step 3 – Run Confusion Matrix (Two Grids)**

- **Processing → Toolbox** → open **SAGA → Imagery classification → Confusion Matrix (Two Grids)**.
- **Classification 1**: your RF raster (e.g. Int16 version).
- **Look-up Table** (first one): select the `lut_classes` table.
- **Value** (for Grid 1): choose field **min**.
- **Value (Maximum)** (for Grid 1): choose **max**.
- **Name** (for Grid 1): choose **name**.
- **Classification 2**: your NLCD mask raster (e.g. Int16 version).
- **Look-up Table** (second): same `lut_classes` table.
- **Value** (for Grid 2): **min**.
- **Value (Maximum)** (for Grid 2): **max**.
- **Name** (for Grid 2): **name**.
- Set **Include Unclassified Cells** to **No** (0) so NoData is excluded.
- Set all four outputs to **Save to temporary file** (or choose paths).
- Run. The **Confusion Matrix** and **Summary** outputs give the 2×2 counts and accuracy/kappa.

### 3d. QGIS-only confusion matrix (no SAGA, no plugins)

If SAGA still fails or you prefer not to use it, you can get the full 2×2 matrix and accuracy/kappa with Raster Calculator and a report.

**Step 1 – Combined class raster**

- **Raster → Raster Calculator**.
- Replace `RF` and `NLCD` with your layer names (e.g. `alabama_pathA_RF_full_30m_int16` and `alabama_NLCD_forest_mask_30m_int16`). Use the band like `@1` if needed.

Expression (one line):

```text
(2 * "RF@1" + "NLCD@1" + 1)
```

- Result: value **1** = (RF=0, NLCD=0), **2** = (RF=0, NLCD=1), **3** = (RF=1, NLCD=0), **4** = (RF=1, NLCD=1). Save the output (e.g. `combined_classes.tif`).

**Step 2 – Get pixel counts per value**

- **Processing → Toolbox** → search **Raster layer unique values report** (QGIS) or **r.stats** (GRASS).
- **Input layer**: the combined raster from Step 1.
- Run. The report lists each value (1–4) and the **count** (number of pixels).

If that algorithm is not available: **Raster → Analysis → Raster layer statistics** and note the histogram, or use **Processing → Toolbox → Native → Raster layer unique values report** (name may vary by QGIS version).

**Step 3 – Build the 2×2 matrix and accuracy**

Let **a** = count for value 1 (RF=0, NLCD=0), **b** = count for value 2 (RF=0, NLCD=1), **c** = count for value 3 (RF=1, NLCD=0), **d** = count for value 4 (RF=1, NLCD=1).

Confusion matrix (rows = reference NLCD, columns = predicted RF):

|            | RF=0 (pred) | RF=1 (pred) |
|------------|-------------|-------------|
| NLCD=0     | a           | c           |
| NLCD=1     | b           | d           |

- **Overall accuracy** = (a + d) / (a + b + c + d).
- **Kappa** = (P_o − P_e) / (1 − P_e), where  
  P_o = (a + d) / (a + b + c + d),  
  P_e = ((a+c)(a+b) + (b+d)(c+d)) / (a+b+c+d)².

Use a spreadsheet or calculator to plug in a, b, c, d.

**Option B (quick overall accuracy only)**  
- Raster Calculator: `("RF@1" = "NLCD@1")` → 1 = agreement, 0 = disagreement.  
- In **Layer Properties → Information** or **Raster layer statistics**, use the count of 1s and total count → **overall accuracy** = count(1) / total. (No 2×2 matrix or kappa.)

**Option C – Sample points**  
1. Create a grid or random points over the overlap.  
2. **Sample raster values** for RF and NLCD at each point.  
3. Export to CSV and compute accuracy/kappa in Excel, R, or Python (e.g. `sklearn.metrics.confusion_matrix`, `accuracy_score`, `cohen_kappa_score`).

---

## 4. Zonal statistics (e.g. by county)

To get **forest area or % forest per county** (or any polygon layer):

1. **Vector layer**: Alabama counties (or your zones), same CRS as the RF raster.
2. **Raster → Zonal Statistics**:  
   - **Raster layer**: your RF map (0/1).  
   - **Zones layer**: counties.  
   - **Statistics**: Sum, Mean, Count.  
   - **Sum** = forest pixel count per zone; **Mean** = proportion forest (0–1); **Count** = total pixels.  
   - Forest area per zone = Sum × (30 × 30) m² (or convert to km²/ha as needed).

---

## 5. Summary

- **Area/counts**: Use the RF layer only (Layer Properties, Raster Calculator, or Zonal Statistics).
- **Accuracy vs NLCD**: Export NLCD as 0/1 at 30 m for Alabama, then use SAGA “Confusion Matrix (Two Rasters)” or point sampling + CSV.
- **By region**: Zonal Statistics with the RF raster and a polygon layer (e.g. counties).

All of this runs in QGIS on your downloaded RF GeoTIFF and avoids any GEE memory limits. For **in-GEE** metrics on the same model, use the test-set accuracy printed in the Code Editor (see the updated `gee_alabama_tree_cover_rf.js`); that stays within memory because it only evaluates the small test sample, not the full state.

---

## 6. Building better labels with NAIP (recommended)

If you want an **accurate forest map**, NLCD is a weak label source (it’s 30 m and has class/edge errors). A practical upgrade is to create **manual 0/1 labels** from NAIP imagery and train the model on those points.

### 6a. Create points to label (from GEE)

1. In the GEE Code Editor, run `gee_create_naip_label_points.js`.
2. Run the export task `alabama_naip_label_points` (GeoJSON).

The exported points include fields:
- `id`: stable identifier
- `subset`: `core_forest`, `core_nonforest`, `edge` (edge points help label ambiguous areas)
- `nlcd_hint`: only a hint for where the point came from (do **not** treat it as truth)
- `forest_label`: **empty**; you will fill this in QGIS as 0/1

### 6b. Add NAIP imagery in QGIS

You have a few options to view NAIP in QGIS while labeling points:

- **ArcGIS REST (USDA NAIP)**:
  - In QGIS: **Data Source Manager → ArcGIS REST Server**
  - New connection URL:
    - `https://gis.apfo.usda.gov/arcgis/rest/services/NAIP/USDA_CONUS_PRIME/ImageServer`
  - Connect and add the NAIP layer.

- **Alternative NAIP REST service**:
  - `https://naip.imagery1.arcgis.com/arcgis/rest/services/NAIP/ImageServer`

### 6c. Label points in QGIS

1. Load `alabama_naip_label_points.geojson`.
2. Toggle editing for the point layer.
3. Populate `forest_label`:
   - `1` = forest/tree cover
   - `0` = non-forest
4. Save edits and export the labeled points (GeoJSON/Shapefile/GeoPackage).

### 6d. Use labeled points back in GEE

1. Upload the labeled points file to Earth Engine as an asset (FeatureCollection).
2. In `gee_alabama_tree_cover_rf.js` set:
   - `LABEL_MODE = 'NAIP_POINTS'`
   - `NAIP_LABEL_POINTS_ASSET = 'projects/.../assets/...'`
   - Ensure the label field is named `forest_label` (or change `NAIP_LABEL_PROPERTY`).
