# Training and accuracy

Concise guide: sample collection, validation, accuracy results, and GEE tips. For framework and direction see [DIRECTION.md](DIRECTION.md).

---

## Sample collection

- **Points:** `gee_create_naip_label_points.js` — stratified (core forest, core non-forest, edge), 1,500 per stratum. Export → label in QGIS (property `forest_lab` or `forest_label`, 0/1). Optional NDVI filter: `gee_naip_ndvi_timeseries.js` (drop barren/water).
- **Polygons:** `gee_export_polygon_candidates.js` — NLCD-based candidates; approve/edit in QGIS, set `forest_label` 0/1, upload as FeatureCollection. Or draw polygons in QGIS.
- **Scale:** Target **1,000+** quality samples for state-scale. Use **points and polygons** in your workflow (one label source per RF run; run both in separate experiments if desired).
- **Quality:** Stratify across edges and ecoregions; use NDVI filter on points; prefer compact, homogeneous polygons.

---

## Validation

- Hold out **~20% of training data** for validation/testing.
- Hold out a **region or strip** of Alabama for spatial validation.
- Use **FIA plots/boundaries** (forest/non-forest) as independent reference where available.

---

## Accuracy results (vs NLCD 0/1)

| Model | Mean OA | Mean kappa |
|-------|---------|------------|
| RF on NAIP points (10 m) | 0.742 | 0.483 |
| RF on NLCD (10 m) | 0.789 | 0.579 |

NLCD RF (3 runs): OA 0.791, 0.786, 0.790; kappa 0.583, 0.573, 0.581. Reference: NLCD forest mask. Script: `gee_rf_accuracy_from_assets.js`.

---

## Accuracy script

**Inputs:** (1) RF binary map (0/1 @ 0.5); (2) NLCD forest mask (0/1). Set asset IDs at top of `gee_rf_accuracy_from_assets.js`. Probability raster not required.

---

## GEE upload (asset ID error)

Use asset ID **without** leading `/` (e.g. `projects/.../assets/name`). If upload fails, shorten the asset name or create the asset folder first in Assets.
