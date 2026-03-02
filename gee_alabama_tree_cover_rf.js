/**
 * Alabama forest map: Optical + Radar (Sentinel-2 + Sentinel-1) → RF
 *
 * MEMORY STRATEGY (to avoid "User memory limit exceeded"):
 * - Map: do NOT add full-state predictor stacks; export instead.
 * - Training: use stratified sampling (balanced classes) with a modest number of points.
 * - Export: full-state tasks run in the Tasks panel (batch).
 *
 * IMPORTANT LIMITATION:
 * - If you use NLCD as labels, you are training to match NLCD. For a more accurate forest map,
 *   replace/augment labels with a better reference dataset (manual points from NAIP, lidar-derived labels, etc.).
 *
 * Code Editor: paste → Run → in Tasks run the export task(s).
 */

// ----- 1. Alabama AOI -----
var alabama = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('STUSPS', 'AL'));
var alabamaBounds = alabama.geometry().bounds();

// ----- 2. Sentinel-2 seasonal composites (leaf-on / leaf-off) -----
// Use seasonal composites to reduce confusion between crops/grass vs forest and handle phenology.
var YEAR = 2023;
var LEAF_ON_START = YEAR + '-05-01';
var LEAF_ON_END = YEAR + '-09-30';
// Leaf-off spans calendar years; use Dec-Feb.
var LEAF_OFF_START = (YEAR - 1) + '-12-01';
var LEAF_OFF_END = YEAR + '-02-28';
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

function s2SeasonComposite(start, end) {
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(alabamaBounds)
  .filterDate(start, end)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 25))
  .map(maskS2clouds);

  // Include red-edge + SWIR (20 m) and core bands (10 m).
  return s2.select(['B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12'])
    .median()
    .clip(alabamaBounds);
}

function addIndices(img, prefix) {
  var ndvi = img.normalizedDifference(['B8', 'B4']).rename(prefix + 'NDVI');
  var ndmi = img.normalizedDifference(['B8', 'B11']).rename(prefix + 'NDMI');
  var nbr = img.normalizedDifference(['B8', 'B12']).rename(prefix + 'NBR');
  // Red-edge NDVI proxy (often helps separating forest vs herbaceous/ag)
  var rendvi = img.normalizedDifference(['B8A', 'B5']).rename(prefix + 'RENDVI');
  return img.addBands([ndvi, ndmi, nbr, rendvi]);
}

var leafOn = addIndices(s2SeasonComposite(LEAF_ON_START, LEAF_ON_END), 'on_');
var leafOff = addIndices(s2SeasonComposite(LEAF_OFF_START, LEAF_OFF_END), 'off_');

// ----- 2b. Sentinel-1 seasonal composites (radar fusion) -----
// Radar helps separate forest from crops/grass and is cloud-independent.
// We use medians over seasons and a single pass direction for consistency.
var S1_PASS = 'DESCENDING'; // or 'ASCENDING'

function toDb(img) {
  // Sentinel-1 GRD backscatter is in linear scale; convert to dB.
  return ee.Image(10).multiply(img.log10());
}

function s1SeasonCompositeDb(start, end, prefix) {
  var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(alabamaBounds)
    .filterDate(start, end)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.eq('orbitProperties_pass', S1_PASS))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .select(['VV', 'VH']);

  // Median composite then convert to dB for more stable ranges.
  var lin = s1.median().clip(alabamaBounds);
  var vvDb = toDb(lin.select('VV')).rename(prefix + 'VV_db');
  var vhDb = toDb(lin.select('VH')).rename(prefix + 'VH_db');
  var vvMinusVh = vvDb.subtract(vhDb).rename(prefix + 'VVminusVH_db');
  var vvDivVh = lin.select('VV').divide(lin.select('VH')).rename(prefix + 'VVdivVH_lin');
  return ee.Image.cat([vvDb, vhDb, vvMinusVh, vvDivVh]);
}

var s1On = s1SeasonCompositeDb(LEAF_ON_START, LEAF_ON_END, 's1_on_');
var s1Off = s1SeasonCompositeDb(LEAF_OFF_START, LEAF_OFF_END, 's1_off_');

// Predictor stack (avoid adding to Map).
var predictorImage = leafOn.addBands(leafOff).addBands(s1On).addBands(s1Off);

// ----- 3. NLCD (label source for Path A) -----
// NLCD 2021 land cover; forest classes 41, 42, 43 = deciduous, evergreen, mixed.
var nlcd = ee.Image('USGS/NLCD_RELEASES/2021_REL/NLCD/2021').select('landcover').clip(alabamaBounds);
var forestClasses = ee.Image(0)
  .where(nlcd.eq(41).or(nlcd.eq(42)).or(nlcd.eq(43)), 1)
  .rename('forest_mask');

// ----- 3b. Label mode (recommended: NAIP-labeled points) -----
// Option A (default): 'NLCD' (fast baseline, but limited by NLCD quality)
// Option B: 'NAIP_POINTS' (train from manually labeled points you create using `gee_create_naip_label_points.js`)
var LABEL_MODE = 'NLCD'; // 'NLCD' | 'NAIP_POINTS'
var NAIP_LABEL_POINTS_ASSET = 'projects/YOUR_PROJECT/assets/alabama_naip_labeled_points'; // required if LABEL_MODE='NAIP_POINTS'
var NAIP_LABEL_PROPERTY = 'forest_label'; // expected 0/1 in the labeled point asset

// ----- 4. Optional: terrain (for pipeline) -----
var dem = ee.Image('USGS/SRTMGL1_003').clip(alabamaBounds);
var slope = ee.Terrain.slope(dem);

// ----- 5. Map: boundary only (no imagery layers to avoid memory) -----
Map.centerObject(alabama, 6);
Map.addLayer(alabama, { color: 'white' }, 'Alabama boundary', true);

// ----- 6. Export region -----
// Predict at 10 m for better parcel/edge behavior (note: labels still NLCD 30 m baseline unless replaced).
var EXPORT_SCALE = 10;
var USE_FULL_STATE_REGION = true;
var exportRegion = USE_FULL_STATE_REGION
  ? alabamaBounds
  : alabamaBounds.centroid({ maxError: 1 }).buffer(7500).bounds();

// ----- 7. Training samples + Random Forest -----
// For parcel-level reliability, avoid training on a single box; sample statewide and balance classes.
// Use 30 m sampling scale to stay aligned with NLCD label grid (even if predictors are 10–20 m).
var LABEL_SCALE = 30;
var RF_SEED = 42;
var RF_NUM_TREES = 300;
var RF_VARS_PER_SPLIT = null; // null lets EE choose sqrt(#features); set a number to tune.
// Keep modest to avoid Code Editor memory limits. Increase gradually if stable.
var STRATIFIED_POINTS_PER_CLASS = 2000; // total samples ~ 2 * this (for 0/1)
// Keep evaluation out of this script to minimize in-session memory use.
// Use `gee_rf_accuracy_from_assets.js` (or a dedicated point-based validation workflow) for metrics.
var RUN_IN_SCRIPT_EVAL = false;

// Add terrain band (upsampled as needed).
predictorImage = predictorImage.addBands(slope.rename('slope'));

// Use a training stack clipped to Alabama to keep computations scoped.
var trainingStack = predictorImage.clip(alabamaBounds).addBands(forestClasses);

var classProperty = 'forest_mask';
var allSamples;

if (LABEL_MODE === 'NAIP_POINTS') {
  classProperty = NAIP_LABEL_PROPERTY;

  var naipPts = ee.FeatureCollection(NAIP_LABEL_POINTS_ASSET)
    .filterBounds(alabamaBounds)
    .filter(ee.Filter.neq(NAIP_LABEL_PROPERTY, null));

  // Sample predictor bands at the labeled points.
  var sampled = predictorImage.addBands(slope.rename('slope')).sampleRegions({
    collection: naipPts,
    properties: [NAIP_LABEL_PROPERTY],
    scale: EXPORT_SCALE,
    geometries: false,
    tileScale: 4
  });

  // Balance classes by limiting to N per class (keeps training stable and fast).
  var N_PER_CLASS = STRATIFIED_POINTS_PER_CLASS;
  var c0 = sampled.filter(ee.Filter.eq(NAIP_LABEL_PROPERTY, 0))
    .randomColumn('r', RF_SEED)
    .sort('r')
    .limit(N_PER_CLASS);
  var c1 = sampled.filter(ee.Filter.eq(NAIP_LABEL_PROPERTY, 1))
    .randomColumn('r', RF_SEED + 1)
    .sort('r')
    .limit(N_PER_CLASS);
  allSamples = c0.merge(c1);

} else {
  // Stratified (balanced) sampling using NLCD mask as the class band.
  allSamples = trainingStack.stratifiedSample({
    numPoints: STRATIFIED_POINTS_PER_CLASS,
    classBand: 'forest_mask',
    region: alabamaBounds,
    scale: LABEL_SCALE,
    seed: RF_SEED,
    geometries: false,
    tileScale: 4
  });
}

// Predictor band list (exclude label and helper lon/lat).
var predictorBands = predictorImage.bandNames();

var rfBase = ee.Classifier.smileRandomForest({
  numberOfTrees: RF_NUM_TREES,
  variablesPerSplit: RF_VARS_PER_SPLIT
});

// Train classifier.
var rfClassifier = rfBase.train({
  features: allSamples,
  classProperty: classProperty,
  inputProperties: predictorBands
});

// Probability output (useful for threshold tuning and uncertainty mapping).
var rfProbClassifier = rfClassifier.setOutputMode('PROBABILITY');

// Hard classification (0/1) and probability.
var rfClassified = predictorImage.classify(rfClassifier).rename('forest_rf');
var pForest = predictorImage.classify(rfProbClassifier).rename('p_forest');
var rfBinary = pForest.gte(0.5).rename('forest_rf_05');

// Optional lightweight sanity check (keep off by default).
if (RUN_IN_SCRIPT_EVAL) {
  var sanity = allSamples.randomColumn('rnd', RF_SEED);
  var train = sanity.filter(ee.Filter.lt('rnd', 0.8));
  var test = sanity.filter(ee.Filter.gte('rnd', 0.8));
  var clf = rfBase.train({
    features: train,
    classProperty: classProperty,
    inputProperties: predictorBands
  });
  var cm = test.classify(clf).errorMatrix(classProperty, 'classification');
  print('Sanity split (not spatial) — sample size:', allSamples.size());
  print('Sanity OA:', cm.accuracy());
  print('Sanity kappa:', cm.kappa());
}

// Avoid "User memory limit exceeded": do not add full-state RF layer to the map.
// For full state we only create the export task; run it in Tasks to get the GeoTIFF.
if (!USE_FULL_STATE_REGION) {
  Map.addLayer(rfBinary, { min: 0, max: 1, palette: ['#e8e8e8', 'darkgreen'] }, 'RF forest (0/1) @ 0.5', true);
}

// ----- 8. Exports -----
// Export probability + thresholded (binary) forest map. Full-state run happens when you execute the tasks in the Tasks panel (batch).
Export.image.toDrive({
  image: pForest.toFloat().clip(alabama),
  description: USE_FULL_STATE_REGION ? 'alabama_rf_pForest_10m' : 'alabama_rf_pForest_tile_10m',
  folder: 'alabama_tree_cover_rf_10m',
  region: exportRegion,
  scale: EXPORT_SCALE,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: { cloudOptimized: true }
});

Export.image.toDrive({
  image: rfBinary.toFloat().clip(alabama),
  description: USE_FULL_STATE_REGION ? 'alabama_rf_forest_binary_05_10m' : 'alabama_rf_forest_binary_05_tile_10m',
  folder: 'alabama_tree_cover_rf_10m',
  region: exportRegion,
  scale: EXPORT_SCALE,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: { cloudOptimized: true }
});

// Export NLCD forest mask (41, 42, 43 → 1, else 0) as baseline reference for QGIS.
// Keep at 30 m to preserve NLCD native grid (avoid implying parcel-level truth).
var nlcdForestExport = (USE_FULL_STATE_REGION ? forestClasses.clip(alabama) : forestClasses).toFloat();
Export.image.toDrive({
  image: nlcdForestExport,
  description: USE_FULL_STATE_REGION ? 'alabama_NLCD_forest_mask_30m' : 'alabama_NLCD_forest_mask_tile_30m',
  folder: 'alabama_tree_cover_rf_10m',
  region: exportRegion,
  scale: LABEL_SCALE,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: { cloudOptimized: true }
});

print('Done. Run export tasks: (1) p_forest (10 m), (2) binary@0.5 (10 m), (3) NLCD forest mask baseline (30 m).');
