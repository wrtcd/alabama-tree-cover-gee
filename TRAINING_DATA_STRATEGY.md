# Smart training data strategy: points, polygons, and hybrid

Scope and problem statement: [SCOPE.md](SCOPE.md). Quality training data is the heart of the model. You’re not fixed on points—polygons are fine. Here’s a concise way to think about it and what’s implemented.

---

## Where to collect labels: NAIP vs Google Earth

| | **NAIP** | **Google Earth (or similar)** |
|--|----------|-------------------------------|
| **Resolution** | ~1 m, consistent | Varies; often good in populated areas |
| **Dates** | Known acquisition years; you can match your composite year | Mixed; may be older or newer than your map year |
| **Coverage** | CONUS; periodic (e.g. every 2–3 years per area) | Global; often more recent in GE |
| **Recommendation** | **Preferred** for forest/non-forest: consistent, free, high-res; load in QGIS or GEE. | Fine for a quick check; use the same source for all labels so dates/sensors are consistent. |

**Bottom line:** Use **NAIP** when you can. If you use Google Earth, stick to it for the whole set.

---

## How many labels (and holdout)

| | **Points** | **Polygons** |
|--|------------|--------------|
| **Aim** | **1,000+ total** (500+ per class) | **50–200** well-chosen polygons (many pixels each) |
| **Holdout** | Set `NAIP_HOLDOUT_RATIO = 0.2` in the RF script → 80% train, 20% validation. Script prints accuracy on the held-out 20%. | Same: 20% of polygons held out (evaluated at polygon centroids). |

---

## 0. One source per run (no mix yet)

In **`gee_alabama_tree_cover_rf.js`** you set **one** `LABEL_MODE`: `'NLCD'`, `'NAIP_POINTS'`, or `'NAIP_POLYGONS'`. Each run uses **that** source only. We do **not** mix points and polygons in a single training run yet—you either train from points, or from polygons, or from NLCD.

**Why both point and polygon scripts exist:** They are **two ways** to get more/better training data. You choose the workflow that fits you (or run both in separate experiments and compare):

- **Points (scaled up):** Many labels, one training pixel per label. Good when you want to click quickly and cover edges/mixed areas; you scale by increasing the number of points.
- **Polygons (candidates or hand-drawn):** Fewer labels, many training pixels per label (every pixel inside the polygon). Good when you want to label big homogeneous patches once and get hundreds of samples per polygon.

You don’t have to use both. Use points **or** polygons for a given run; the “hybrid” idea (points + polygons in one run) would require a fourth mode that merges both—not implemented yet.

---

## 1. Points vs polygons (when to use which)

| | **Points** | **Polygons** |
|---|------------|----------------|
| **Effort per label** | One click per location | Draw boundary (more time per polygon) |
| **Pixels per label** | 1 (or a few if you use buffer sampling) | Many (100s–1000s per polygon) |
| **Best for** | Edge cases, mixed areas, quick coverage | Large homogeneous patches (pure forest, pure non-forest) |
| **Risk** | Need many points to get enough pixels | Few bad polygons can add many bad pixels |

**Conceptually:** use both *types* in your overall workflow—polygons for big homogeneous patches (many pixels per label) and points for edges/ambiguous areas (targeted diversity). In practice you still run the RF script with one mode per run (points *or* polygons) unless we add a combined mode later.

---

## 2. Recommended workflow

### Option A: Scale up points (fastest next step)

- In **`gee_create_naip_label_points.js`** the design is now **1,500 per stratum** (core forest, core non-forest, edge) → up to **4,500** candidates.
- After sampling + manual labeling + NDVI filter, aim for **1,000+** quality points.
- Still one click per label; no new workflow.

### Option B: Add polygons (most efficient for pixels per minute)

1. **Create polygons**
   - **Draw in QGIS:** On NAIP (or similar), draw polygons; add attribute `forest_label` = 1 (forest) or 0 (non-forest). Export as GeoJSON.
   - **Or use candidates from GEE:** Run **`gee_export_polygon_candidates.js`** to export NLCD-derived candidate polygons (one layer forest, one non-forest). In QGIS you only **approve/reject/edit** and set `forest_label`, then re-export.
2. **Upload** the polygon GeoJSON as a GEE **FeatureCollection** asset (e.g. `alabama_naip_training_polygons`). Each feature must have a property **`forest_label`** (or `forest_lab`) = 0 or 1 (or "Non-forest"/"Forest"). In the RF script set **`NAIP_LABEL_PROPERTY`** to match (e.g. `'forest_label'`).
3. **Train from polygons:** In **`gee_alabama_tree_cover_rf.js`** set `LABEL_MODE = 'NAIP_POLYGONS'` and `NAIP_POLYGONS_ASSET` to that asset. GEE will **sample every pixel inside each polygon** (at 10 m), then balance to `STRATIFIED_POINTS_PER_CLASS` per class so you get thousands of training pixels from fewer polygons.

### Option C: Compare both (separate runs)

- Build **points** (scaled-up design + QGIS + optional NDVI filter) and **polygons** (candidates or hand-drawn + QGIS) as separate assets.
- Run the RF script **twice**: once with `LABEL_MODE = 'NAIP_POINTS'`, once with `LABEL_MODE = 'NAIP_POLYGONS'`, and compare accuracy. A future enhancement would be a single run that merges point samples and polygon samples into one training set.

---

## 3. Quality over raw count

- **Stratify:** Don’t sample only “easy” interior forest/non-forest. Include **edges** (already in the point design) and, if possible, different **ecoregions** or land-use types so the model sees the full variety.
- **NDVI filter (points):** Keep using `gee_naip_ndvi_timeseries.js` to drop points with very low NDVI (barren/water/cloud) so mislabels don’t dilute the model.
- **Polygon quality:** Prefer **compact, homogeneous** polygons. One big polygon that crosses forest and field is one label but many wrong pixels; split it or use points there instead.

---

## 4. What’s in the repo

See [SCOPE.md](SCOPE.md) for the list of scripts and key artifacts. You can start with more points (Option A), then add polygons (Option B) when you want more training pixels per minute of labeling.
