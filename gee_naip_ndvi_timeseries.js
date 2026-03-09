/**
 * NAIP-labeled points → Sentinel-2 NDVI timeseries (12 months) + quality filter
 *
 * Uses your ~700 manually labeled NAIP points to:
 * 1. Build a 12-month (Jan–Dec) NDVI timeseries from Sentinel-2 at each point.
 * 2. Compute per-point stats: mean_ndvi, min_ndvi, max_ndvi, amplitude (seasonality).
 * 3. Optionally filter out barren/water/built-up (low NDVI) to improve training data.
 *
 * Forest: typically high NDVI; seasonal (deciduous) or flatter (evergreen).
 * Grass/crops: different seasonal pattern; barren/water/built-up: low NDVI.
 * Dropping points with min_ndvi or mean_ndvi below a threshold removes mislabels and
 * non-vegetation, improving RF training.
 *
 * Run in Code Editor; export the table to Drive for analysis (e.g. Excel/Python)
 * and optionally export the filtered point collection for use in the main RF script.
 */

// ----- 1. Alabama AOI -----
var alabama = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('STUSPS', 'AL'));
var alabamaBounds = alabama.geometry().bounds();

// ----- 2. Your NAIP-labeled points -----
var NAIP_LABEL_POINTS_ASSET = 'projects/earthengine-441016/assets/alabama_naip_label_points';
var NAIP_LABEL_PROPERTY = 'forest_lab';  // 0/1 or "Forest"/"Non-forest"

var naipPts = ee.FeatureCollection(NAIP_LABEL_POINTS_ASSET)
  .filterBounds(alabamaBounds)
  .filter(ee.Filter.neq(NAIP_LABEL_PROPERTY, null));  // drop unlabeled points

// ----- 3. Year for NDVI timeseries (full calendar year) -----
var YEAR = 2023;

// ----- 4. Sentinel-2: cloud mask + NDVI -----
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

function addNDVI(img) {
  return img.addBands(
    img.normalizedDifference(['B8', 'B4']).rename('NDVI')
  );
}

// ----- 5. Monthly composites (Jan–Dec): median NDVI per month -----
// Use client-side loop so band names are literal strings (ndvi_01 .. ndvi_12).
function monthlyNdviComposite(month) {
  var start = ee.Date.fromYMD(YEAR, month, 1);
  var end = start.advance(1, 'month');
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(alabamaBounds)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 25))
    .map(maskS2clouds)
    .map(addNDVI);
  var bandName = 'ndvi_' + (month < 10 ? '0' + month : String(month));
  return s2.select('NDVI').median().rename(bandName);
}

var monthlyImages = [];
for (var m = 1; m <= 12; m++) {
  monthlyImages.push(monthlyNdviComposite(m));
}
var ndviStack = ee.Image.cat(monthlyImages);

// ----- 6. Sample 12-month NDVI at each NAIP point -----
var scale = 10;  // 10 m to match S2
var sampled = ndviStack.sampleRegions({
  collection: naipPts,
  properties: null,  // keep all point properties (e.g. forest_lab)
  scale: scale,
  geometries: true,  // required for Export.table.toAsset (asset must have geometry)
  tileScale: 4
});

// ----- 7. Add summary stats: mean, min, max, amplitude -----
var bandNames = ndviStack.bandNames();

function addNdviStats(f) {
  var ndviValues = bandNames.map(function(name) { return f.getNumber(name); });
  var sum = ee.List(ndviValues).reduce(ee.Reducer.sum());
  var n = ee.List(ndviValues).size();
  var meanNdvi = ee.Number(sum).divide(n);
  var minNdvi = ee.List(ndviValues).reduce(ee.Reducer.min());
  var maxNdvi = ee.List(ndviValues).reduce(ee.Reducer.max());
  var amplitude = ee.Number(maxNdvi).subtract(minNdvi);
  return f
    .set('mean_ndvi', meanNdvi)
    .set('min_ndvi', minNdvi)
    .set('max_ndvi', maxNdvi)
    .set('ndvi_amplitude', amplitude);
}

var withStats = sampled.map(addNdviStats)
  .filter(ee.Filter.neq('mean_ndvi', null));  // drop points with any null NDVI (no valid S2 for some months)

// ----- 8. Optional: filter out low-NDVI (barren / water / built-up) -----
// Points with mean or min NDVI below these are often non-vegetation or mislabeled.
var MIN_NDVI_THRESHOLD = 0.20;   // drop if min_ndvi < this (very barren/water)
var MEAN_NDVI_THRESHOLD = 0.25;  // drop if mean_ndvi < this (persistently low veg)

var filtered = withStats
  .filter(ee.Filter.gte('min_ndvi', MIN_NDVI_THRESHOLD))
  .filter(ee.Filter.gte('mean_ndvi', MEAN_NDVI_THRESHOLD));

// ----- 9. Print for inspection -----
print('NAIP points (total):', naipPts.size());
print('After NDVI quality filter (min_ndvi >= ' + MIN_NDVI_THRESHOLD + ', mean_ndvi >= ' + MEAN_NDVI_THRESHOLD + '):', filtered.size());
print('Sample row (with 12-month NDVI + stats):', withStats.first());

// Summary by label (if property exists)
var forestCount = filtered.filter(ee.Filter.or(
  ee.Filter.eq(NAIP_LABEL_PROPERTY, 1),
  ee.Filter.eq(NAIP_LABEL_PROPERTY, 'Forest')
)).size();
var nonForestCount = filtered.filter(ee.Filter.or(
  ee.Filter.eq(NAIP_LABEL_PROPERTY, 0),
  ee.Filter.eq(NAIP_LABEL_PROPERTY, 'Non-forest')
)).size();
print('Filtered points — Forest:', forestCount, 'Non-forest:', nonForestCount);

// ----- 10. Export full table (all points with timeseries + stats) to Drive -----
// Use this in Excel/Python to plot NDVI by month and by class (forest vs non-forest).
Export.table.toDrive({
  collection: withStats,
  description: 'alabama_naip_ndvi_timeseries_' + YEAR,
  folder: 'alabama_tree_cover_rf_10m',
  fileFormat: 'CSV'
});

// ----- 11. Export filtered points (quality-controlled) for RF training -----
// Use this asset in gee_alabama_tree_cover_rf.js: set LABEL_MODE='NAIP_POINTS'
// and NAIP_LABEL_POINTS_ASSET to this exported table/asset (or re-import as FC).
Export.table.toDrive({
  collection: filtered,
  description: 'alabama_naip_points_filtered_ndvi_' + YEAR,
  folder: 'alabama_tree_cover_rf_10m',
  fileFormat: 'CSV'
});

// ----- 12. Export filtered FC as asset (run once, then use in gee_alabama_tree_cover_rf.js) -----
Export.table.toAsset({
  collection: filtered,
  description: 'alabama_naip_points_filtered_ndvi_asset',
  assetId: 'projects/earthengine-441016/assets/alabama_naip_points_filtered_ndvi'
});

print('Done. Run Tasks: (1) alabama_naip_ndvi_timeseries_* CSV, (2) alabama_naip_points_filtered_ndvi_* CSV, (3) alabama_naip_points_filtered_ndvi asset.');
print('Use filtered CSV/asset in gee_alabama_tree_cover_rf.js to train on quality-filtered labels.');
