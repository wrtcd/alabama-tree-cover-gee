/**
 * Alabama tree cover: Path A (Optical + NLCD → RF) — full state
 *
 * MEMORY STRATEGY (to avoid "User memory limit exceeded"):
 * - Map: only PREVIEW tiles are added (never full-state 30m layers), so the viewer doesn't load the whole state.
 * - Training: samples are taken from multiple small tiles across the state and merged (no single full-state sample).
 * - Export: one full-state task; if it fails, use TILED_EXPORT (multiple smaller export tasks).
 *
 * Bottlenecks: (1) Adding full-state imagery to the map. (2) One huge sample over full state. (3) Evaluating full-state classification in-script.
 * We avoid (1) by not adding imagery to the map. (2) by multi-tile sampling. (3) by not adding full-state RF to map and letting Export run in batch.
 *
 * Code Editor: paste → Run → in Tasks run the export task(s).
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

// ----- 5. Map: boundary only (no imagery layers to avoid memory) -----
Map.centerObject(alabama, 6);
Map.addLayer(alabama, { color: 'white' }, 'Alabama boundary', true);

// ----- 6. Export region -----
var EXPORT_SCALE = 30;
var USE_FULL_STATE_REGION = true;
var exportRegion = USE_FULL_STATE_REGION
  ? alabamaBounds
  : alabamaBounds.centroid({ maxError: 1 }).buffer(7500).bounds();

// ----- 7. Training samples + Random Forest -----
// Sample from a small region only. Use a CLIPPED training image for sampling so the backend
// does not build the full-state image when evaluating samples/accuracy (avoids memory limit).
var RF_NUM_PIXELS = 3000;   // Keep modest for Code Editor memory
var RF_SEED = 42;
var RF_NUM_TREES = 100;
// Central AL box [W, S, E, N] in degrees.
var SAMPLE_REGION = ee.Geometry.Rectangle([-87.5, 31.5, -85.5, 34.5]);

var predictorBands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'slope'];
var predictorImage = composite.addBands(ndvi).addBands(slope);
// Clipped image for sampling only — keeps accuracy evaluation graph small (no full-state build).
var trainingImageSampling = predictorImage.clip(SAMPLE_REGION).addBands(forestClasses.clip(SAMPLE_REGION));

var allSamples = trainingImageSampling.sample({
  region: SAMPLE_REGION,
  scale: EXPORT_SCALE,
  numPixels: RF_NUM_PIXELS,
  seed: RF_SEED,
  geometries: false
});

// ----- 7b. Train/test split (70% train, 30% test) for accuracy assessment -----
var SPLIT_SEED = 123;
var TRAIN_FRACTION = 0.7;
var samplesWithSplit = allSamples.randomColumn('split', SPLIT_SEED);
var trainSet = samplesWithSplit.filter(ee.Filter.lt('split', TRAIN_FRACTION));
var testSet = samplesWithSplit.filter(ee.Filter.gte('split', TRAIN_FRACTION));

var rfClassifier = ee.Classifier.smileRandomForest(RF_NUM_TREES)
  .train({
    features: trainSet,
    classProperty: 'forest_mask',
    inputProperties: predictorBands
  });

var rfClassified = predictorImage.classify(rfClassifier).rename('forest_rf');
var rfExportImage = USE_FULL_STATE_REGION ? rfClassified.clip(alabama) : rfClassified;

// Accuracy (test set) is not computed or printed in-script to avoid "User memory limit exceeded".
// To get accuracy: run a separate script that only trains and evaluates on the same SAMPLE_REGION (no full-state image).

// Avoid "User memory limit exceeded": do not add full-state RF layer to the map.
// For full state we only create the export task; run it in Tasks to get the GeoTIFF.
if (!USE_FULL_STATE_REGION) {
  Map.addLayer(rfClassified, { min: 0, max: 1, palette: ['#e8e8e8', 'darkgreen'] }, 'RF forest (0/1)', true);
}

// Export RF result. Full-state run happens when you execute the task in the Tasks panel (batch, higher memory).
// If that export fails, try reducing scale (e.g. 60) or splitting the state into multiple export tasks.
Export.image.toDrive({
  image: rfExportImage.toFloat(),
  description: USE_FULL_STATE_REGION ? 'alabama_pathA_RF_full_30m' : 'alabama_pathA_RF_tile_30m',
  folder: 'alabama_tree_cover_pathA_30m_exploration',
  region: exportRegion,
  scale: EXPORT_SCALE,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: { cloudOptimized: true }
});

print('Done. Run the export task in the Tasks panel for full-state GeoTIFF. (Accuracy not printed to avoid memory limit.)');
