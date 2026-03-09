# Project boundary: what we do and what we don't

We optimize and select; we don't lock in by default.

---

## What this project DOES

- **GEE** as the main platform (compute, export).
- **Free data** at Alabama scale (optical, temporal, structural, existing products — as chosen by the optimal path).
- **Alabama** as the target; pipeline **scales** to statewide (tiled export, batch, no manual per-scene).
- **Delivered product**: A **wooded-area map** (forest vs non-forest, 0/1) plus **probability** for Alabama at **10 m** for a chosen year (e.g. 2023), by training a Random Forest on NLCD or **NAIP-derived points** (optionally NDVI quality–filtered) and applying it to **Sentinel-2 + Sentinel-1 seasonal composites** (leaf-on/leaf-off), indices (NDVI, NDMI, NBR, RENDVI), and slope — temporally updated and radar-augmented relative to NLCD alone. Exports: probability + binary @ 0.5 + NLCD forest mask (30 m) baseline.
- **Data pipelines**: Clear, reproducible flow (ingest → composite/features → train → predict → export); efficient and GEE-native. Validation: in-script stratified sample or **gee_rf_accuracy_from_assets.js** on uploaded RF + NLCD exports.
- **Optimization criteria** drive the choice: optimization, scalability, pipeline efficiency, speed, accuracy, data availability. We **evaluate** candidate paths and **select the optimal** one from the fractal of possibilities — we do not adopt an approach by habit or a single fixed recipe.
- **Lightweight methods** (e.g. indices, RF, small ML) that stay tractable at scale.
- **Labels/targets** from existing or derived sources; no manual labeling at scale.

---

## What this project does NOT do

- **PlanetScope** (or paid 3m) as the primary input.
- **Per-scene U-Net** (or similar heavy DL) as the core workflow.
- **Manual polygon labeling at scale** as the main source of labels.
- **Manual download/upload** of thousands of scenes.
- **Single-scene or small-area-only** outputs with no path to statewide.
- **Choosing an approach by default** — we select using the optimization criteria; the path is justified, not assumed.

---

## If you're unsure

- **In scope**: GEE + free data + Alabama scale + scalable pipeline; choice of path is **optimization-driven** (scalability, efficiency, speed, accuracy, data availability); labels from existing or derived sources.
- **Out of scope**: Planet, per-scene DL, hand-labeling at scale; or any path chosen without evaluation against the criteria.
