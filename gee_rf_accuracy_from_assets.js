/**
 * Alabama RF vs NLCD accuracy from uploaded assets.
 * Scope: SCOPE.md.
 *
 * RECOMMENDED: Fastest way to get accuracy after your long RF export run (~2+ hr).
 * No need to re-run the main pipeline; just upload the two exported rasters as
 * assets and run this script (sampling + confusion matrix only, typically minutes).
 *
 * Required assets (upload your GeoTIFF exports from Drive):
 * - RF 0/1 map (e.g. alabama_2023_RF or alabama_rf_forest_binary_naip_05_10m)
 * - NLCD 0/1 forest mask (e.g. alabama_NLCD_2021 or alabama_NLCD_forest_mask_30m)
 * Set RF_ASSET and NLCD_ASSET below to match your asset IDs.
 *
 * This script: stratified sample → confusion matrix, OA, kappa, producer/consumer accuracy.
 *
 * How to use:
 * 1. In GEE: Assets → New → Image → upload RF GeoTIFF (binary 0/1) and NLCD mask GeoTIFF.
 * 2. Paste this script into Code Editor; fix asset paths (project ID, asset names) if needed.
 * 3. If NLCD asset is raw landcover (41/42/43), use CASE 2; if already 0/1 mask, use CASE 1.
 * 4. Run → read metrics in Console; optionally uncomment Export.table.toDrive for CSV.
 */

// ----- 1. Load assets -----
// Your RF binary (0/1) maps — pick one to compare vs NLCD reference.
var RF_ASSET = 'projects/earthengine-441016/assets/alabama_rf_forest_binary_naip_10m';   // RF trained on NAIP points
// var RF_ASSET = 'projects/earthengine-441016/assets/alabama_rf_forest_binary_nlcd_10m'; // RF trained on NLCD
// Reference (truth) for accuracy: NLCD 0/1 forest mask.
var NLCD_ASSET = 'projects/earthengine-441016/assets/alabama_NLCD_2021';

// RF prediction (0/1 map), uploaded from your GeoTIFF export.
// Cast to integer so it's a proper 0/1 band.
var rf = ee.Image(RF_ASSET)
  .select(0)
  .round()
  .toInt()
  .rename('rf');

// NLCD-based reference, uploaded from your NLCD GeoTIFF.
// We will cast to integer in the CASE block below.
var nlcdRaw = ee.Image(NLCD_ASSET)
  .select(0);

// ----- 1a. Reference band: choose ONE of the following cases -----

// CASE 1: alabama_NLCD_2021 is ALREADY a 0/1 forest mask (1 = forest, 0 = non-forest).
//         Cast to integer so it can be used as classBand in stratifiedSample.
var ref = nlcdRaw
  .round()
  .toInt()
  .rename('ref');

// CASE 2: alabama_NLCD_2021 still has NLCD landcover classes.
//         If you know this is true, comment CASE 1 above and uncomment this block.
//
// var ref = ee.Image(0)
//   .where(
//     nlcdRaw.eq(41)
//       .or(nlcdRaw.eq(42))
//       .or(nlcdRaw.eq(43)),
//     1
//   )
//   .toInt()
//   .rename('ref');


// ----- 2. Alabama region -----

var alabama = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('STUSPS', 'AL'));
var region = alabama.geometry();

Map.centerObject(alabama, 6);
Map.addLayer(alabama, { color: 'white' }, 'Alabama boundary', false);

// Optional quick visual check (turn layers on in the map if desired).
Map.addLayer(rf,  { min: 0, max: 1, palette: ['#e0e0e0', 'darkgreen'] }, 'RF (0/1)', false);
Map.addLayer(ref, { min: 0, max: 1, palette: ['#e0e0e0', 'navy'] },      'Reference (0/1)', false);


// ----- 3. Helper: draw a sample for a given seed and compute metrics -----

// Stack prediction and reference bands into one image (shared for all runs).
var both = rf.addBands(ref).clip(region);

// Sampling controls.
// Stratified sampling is preferred for 0/1 maps to avoid "easy" majority-class domination.
// Keep this modest to avoid Code Editor memory limits; increase gradually if stable.
var POINTS_PER_CLASS = 8000; // total samples ~ 2 * this
var SAMPLE_SCALE = 30;    // RF / NLCD resolution.

// Return a Feature with metrics for a given random seed.
function metricsForSeed(seed) {
  // Stratify by reference so both classes are represented.
  var samples = both.stratifiedSample({
    numPoints: POINTS_PER_CLASS,
    classBand: 'ref',
    region: region,
    scale: SAMPLE_SCALE,
    seed: seed,
    geometries: false,
    tileScale: 4
  });

  var size = samples.size();
  var cm = samples.errorMatrix('ref', 'rf');

  return ee.Feature(null, {
    seed: seed,
    sample_count: size,
    confusion_matrix: cm.array(),
    overall_accuracy: cm.accuracy(),
    kappa: cm.kappa(),
    producers_accuracy: cm.producersAccuracy(),
    consumers_accuracy: cm.consumersAccuracy()
  });
}


// ----- 4. Multi-seed accuracy: run several random samples and aggregate -----

// Choose a few independent seeds for repeated sampling over all of Alabama.
var seeds = [42, 1337, 2025];

// Compute per-seed metrics.
var metricsFC = ee.FeatureCollection(seeds.map(function(seed) {
  return metricsForSeed(seed);
}));

print('Per-seed accuracy metrics (rows = reference, cols = prediction):', metricsFC);

// Aggregate metrics across seeds.
var meanAcc = metricsFC.aggregate_mean('overall_accuracy');
var meanKappa = metricsFC.aggregate_mean('kappa');

print('Mean overall accuracy (all seeds):', meanAcc);
print('Mean kappa (all seeds):', meanKappa);

// Optional: export the per-seed metrics to Drive as CSV.
Export.table.toDrive({
  collection: metricsFC,
  description: 'alabama_rf_vs_nlcd_accuracy_multi_seed',
  folder: 'alabama_tree_cover_rf_10m',
  fileFormat: 'CSV'
});

print('Done. Per-seed metrics and mean accuracy/kappa are printed above. Adjust POINTS_PER_CLASS, seeds, or CASE 1/CASE 2 if needed.');

