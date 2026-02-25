# Project boundary: what we do and what we don't

We optimize and select; we don't lock in by default.

---

## What this project DOES

- **GEE** as the main platform (compute, export).
- **Free data** at Alabama scale (optical, temporal, structural, existing products — as chosen by the optimal path).
- **Alabama** as the target; pipeline **scales** to statewide (tiled export, batch, no manual per-scene).
- **Data pipelines**: Clear, reproducible flow (ingest → composite/features → train or threshold → predict → export); efficient and GEE-native where possible.
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
