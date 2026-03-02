"""
GEE exploration for Path A: Optical + NLCD → RF
Alabama AOI, cloud-free composite + NLCD, small-tile export.
Run locally with: python gee_explore_alabama_geemap.py
Requires: pip install geemap earthengine-api
Authenticate once: earthengine authenticate
"""

import ee
import geemap

# Initialize Earth Engine (use geemap's default if no ee.Initialize)
try:
    ee.Initialize()
except Exception:
    ee.Authenticate()
    ee.Initialize()

# ----- 1. Alabama AOI -----
alabama = ee.FeatureCollection("TIGER/2018/States").filter(
    ee.Filter.eq("STUSPS", "AL")
)
alabama_bounds = alabama.geometry().bounds()

# ----- 2. Sentinel-2 cloud-free composite -----
def mask_s2_clouds(image):
    qa = image.select("QA60")
    cloud_bit = 1 << 10
    cirrus_bit = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit).eq(0).And(
        qa.bitwiseAnd(cirrus_bit).eq(0)
    )
    return image.updateMask(mask).divide(10000)

s2 = (
    ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(alabama_bounds)
    .filterDate("2023-01-01", "2023-12-31")
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 25))
    .map(mask_s2_clouds)
)

composite = (
    s2.select(["B2", "B3", "B4", "B8", "B11", "B12"])
    .median()
    .clip(alabama_bounds)
)
ndvi = composite.normalizedDifference(["B8", "B4"]).rename("NDVI")

# ----- 3. NLCD (label source for Path A) -----
nlcd = (
    ee.Image("USGS/NLCD/NLCD2021")
    .select("landcover")
    .clip(alabama_bounds)
)
forest_classes = (
    ee.Image(0)
    .where(nlcd.eq(41).Or(nlcd.eq(42)).Or(nlcd.eq(43)), 1)
    .rename("forest_mask")
)

# ----- 4. Optional: terrain -----
dem = ee.Image("USGS/SRTMGL1_003").clip(alabama_bounds)
slope = ee.Terrain.slope(dem)

# ----- 5. Map: view composite + layers -----
m = geemap.Map()
m.center_object(alabama, 6)
m.add_layer(alabama, {"color": "white"}, "Alabama boundary", shown=False)
m.add_layer(
    composite,
    {"bands": ["B4", "B3", "B2"], "min": 0, "max": 0.3},
    "S2 cloud-free composite (30m)",
    shown=True,
)
m.add_layer(
    ndvi,
    {"min": -0.2, "max": 0.8, "palette": ["brown", "yellow", "green"]},
    "NDVI",
    shown=True,
)
m.add_layer(
    forest_classes,
    {"min": 0, "max": 1, "palette": ["transparent", "darkgreen"]},
    "NLCD forest (41,42,43)",
    shown=True,
)
m.add_layer(nlcd, {"min": 11, "max": 95}, "NLCD landcover", shown=False)
m.add_layer(slope, {"min": 0, "max": 45}, "Slope (deg)", shown=False)

# ----- 6. Small-tile export -----
export_region = alabama_bounds.centroid().buffer(7500).bounds()
export_image = composite.addBands(ndvi).addBands(forest_classes)

# Small-tile export: 15 x 15 km at 30 m (confirm resolution & data availability)
out_path = "alabama_pathA_tile_30m.tif"
geemap.ee_export_image(
    export_image,
    filename=out_path,
    region=export_region,
    scale=30,
    file_per_band=False,
)
print(f"Tile export saved to: {out_path}")

m.add_layer(export_region, {"color": "red"}, "Export tile (15x15 km)")

# ----- 7. Training samples + Random Forest -----
scale = 30
predictor_bands = ["B2", "B3", "B4", "B8", "B11", "B12", "NDVI", "slope"]
predictor_image = composite.addBands(ndvi).addBands(slope)
training_image = predictor_image.addBands(forest_classes)

num_pixels = 10000  # Increase for production; decrease for quick tests
rf_seed = 42
num_trees = 100

training_samples = training_image.sample(
    region=alabama_bounds,
    scale=scale,
    numPixels=num_pixels,
    seed=rf_seed,
    geometries=False,
)

rf_classifier = ee.Classifier.smileRandomForest(num_trees).train(
    features=training_samples,
    classProperty="forest_mask",
    inputProperties=predictor_bands,
)
rf_classified = predictor_image.classify(rf_classifier).rename("forest_rf")

m.add_layer(
    rf_classified,
    {"min": 0, "max": 1, "palette": ["#e8e8e8", "darkgreen"]},
    "RF forest (0/1)",
    shown=True,
)

# Optional: export RF tile locally (same 15x15 km region)
rf_out_path = "alabama_pathA_RF_tile_30m.tif"
geemap.ee_export_image(
    rf_classified.toFloat(),
    filename=rf_out_path,
    region=export_region,
    scale=scale,
    file_per_band=False,
)
print(f"RF tile export saved to: {rf_out_path}")

print("Map layers: S2 composite, NDVI, NLCD forest, export tile, RF forest.")
# In Jupyter: display with m. In script: open in browser with m.show() if desired.
try:
    m.show()
except Exception:
    pass
