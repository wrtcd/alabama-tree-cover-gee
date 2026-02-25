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
print("Map layers: S2 composite, NDVI, NLCD forest, export tile boundary.")
# In Jupyter: display with m. In script: open in browser with m.show() if desired.
try:
    m.show()
except Exception:
    pass
