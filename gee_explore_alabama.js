/**
 * GEE exploration for Path A: Optical + NLCD → RF
 * Alabama AOI, cloud-free composite + NLCD, small-tile export.
 *
 * Code Editor steps:
 * 1. Open https://code.earthengine.google.com/
 * 2. Sign in with your Google account (GEE access required).
 * 3. Copy this entire file and paste into the script panel (replace any existing code).
 * 4. Click Run (or Ctrl+Enter). Map will center on Alabama and add layers.
 * 5. In the Tasks tab (right), click "Run" next to alabama_pathA_tile_30m to start the export to Google Drive (folder: alabama_tree_cover_pathA_30m_exploration).
 */

// ----- 1. Alabama AOI -----
var alabama = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('STUSPS', 'AL'));
var alabamaBounds = alabama.geometry().bounds();

// ----- 2. Sentinel-2 cloud-free composite -----
// Composite year: no special reason for 2023 — pick a recent year with full coverage; change if needed.
var COMPOSITE_YEAR_START = '2023-01-01';
var COMPOSITE_YEAR_END = '2023-12-31';
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(alabamaBounds)
  .filterDate(COMPOSITE_YEAR_START, COMPOSITE_YEAR_END)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 25))
  .map(maskS2clouds);

var composite = s2.select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12'])
  .median()
  .clip(alabamaBounds);

// NDVI for path A (optical indices)
var ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

// ----- 3. NLCD (label source for Path A) -----
// NLCD 2021 land cover; forest classes 41, 42, 43 = deciduous, evergreen, mixed.
var nlcd = ee.Image('USGS/NLCD_RELEASES/2021_REL/NLCD/2021').select('landcover').clip(alabamaBounds);
var forestClasses = ee.Image(0)
  .where(nlcd.eq(41).or(nlcd.eq(42)).or(nlcd.eq(43)), 1)
  .rename('forest_mask');
// Optional: USFS/NLCD tree canopy percent (different asset, check GEE catalog)
// var tcc = ee.Image('USGS/NLCD_RELEASE_2020/TCC').clip(alabamaBounds);

// ----- 4. Optional: terrain (for pipeline) -----
var dem = ee.Image('USGS/SRTMGL1_003').clip(alabamaBounds);
var slope = ee.Terrain.slope(dem);

// ----- 5. Visualize: add layers to map -----
Map.centerObject(alabama, 6);
Map.addLayer(alabama, { color: 'white' }, 'Alabama boundary', false);

// True-color composite (B4, B3, B2) at 30m for resolution check
Map.addLayer(composite, { bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3 }, 'S2 cloud-free composite (30m)', true);
Map.addLayer(ndvi, { min: -0.2, max: 0.8, palette: ['brown', 'yellow', 'green'] }, 'NDVI', true);
// Non-forest (0) = subtle gray; forest (1) = darkgreen. (Palette is colors only; opacity is not a color.)
Map.addLayer(forestClasses, { min: 0, max: 1, palette: ['#e8e8e8', 'darkgreen'] }, 'NLCD forest (41,42,43)', true);
// NLCD landcover: use a simple palette (water, developed, forest, etc.)
Map.addLayer(nlcd, { min: 11, max: 95 }, 'NLCD landcover', false);
Map.addLayer(slope, { min: 0, max: 45 }, 'Slope (deg)', false);

// ----- 6. Export region (confirm resolution & data availability) -----
// Scale 30 m (not S2's 10 m): Path A trains with NLCD labels, which are 30 m. Export at 30 m so
// optical and labels align; S2 10/20 m bands are resampled to 30 m. Use 10 m only for visual-only exports.
var EXPORT_SCALE = 30;

// Why not use alabamaBounds (or alabama.geometry()) directly? alabamaBounds is the full state
// bounding rectangle — using it as region exports the entire state (large, slow). A small tile
// (centroid + buffer) gives a quick, small export to check resolution and data. Use full state
// when you want the whole AOI (set USE_FULL_STATE_REGION = true).
var USE_FULL_STATE_REGION = false;
// Export region: always use a simple geometry (4-vertex bbox). GEE does NOT auto-convert region
// to bbox — complex polygons (e.g. alabama.geometry()) can trigger "too many edges" errors.
var exportRegion = USE_FULL_STATE_REGION
  ? alabamaBounds  // full state as bounding box (simple rectangle)
  : alabamaBounds.centroid({ maxError: 1 }).buffer(7500).bounds(); // 15 km half-side => 15x15 km tile

// Exported bands (8 total):
//   B2, B3, B4, B8, B11, B12 — Sentinel-2 surface reflectance (0–1), median composite, 30 m
//   NDVI                 — (NIR−Red)/(NIR+Red), -1 to 1
//   forest_mask          — 0 = non-forest, 1 = NLCD forest (classes 41, 42, 43)
// Cast to same type so export succeeds (composite + NDVI float; forest_mask can be int).
var exportImage = composite.addBands(ndvi).addBands(forestClasses).float();
// For full state: clip to state boundary so pixels outside Alabama are masked (region is bbox).
if (USE_FULL_STATE_REGION) { exportImage = exportImage.clip(alabama); }

var exportDescription = USE_FULL_STATE_REGION ? 'alabama_pathA_full_30m' : 'alabama_pathA_tile_30m';
Export.image.toDrive({
  image: exportImage,
  description: exportDescription,
  folder: 'alabama_tree_cover_pathA_30m_exploration',
  region: exportRegion,
  scale: EXPORT_SCALE,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: { cloudOptimized: true }
});

print('Export task created: ' + exportDescription);
print('Region (full state = ' + USE_FULL_STATE_REGION + ')', exportRegion);
print('Export band names', exportImage.bandNames());
print('Export band types (all same for GeoTIFF)', exportImage.bandTypes());
print(USE_FULL_STATE_REGION ? 'Full Alabama at ' + EXPORT_SCALE + 'm (large export; may take time)' : 'Approx. tile at ' + EXPORT_SCALE + 'm: 500 x 500 px = 15 x 15 km');
