/**
 * Alabama RF vs NLCD accuracy from uploaded assets.
 *
 * Use when you have:
 * - projects/earthengine-441016/assets/alabama_2023_RF          (RF 0/1 map)
 * - projects/earthengine-441016/assets/alabama_NLCD_2021       (NLCD-based reference)
 *
 * This script:
 * - loads both images,
 * - stacks them,
 * - draws a stratified (class-balanced) sample of pixels over Alabama,
 * - computes a confusion matrix, overall accuracy, kappa, and per-class accuracies.
 *
 * MEMORY STRATEGY:
 * - We NEVER run reduceRegion over the full image.
 * - We only use .sample(...) on a manageable number of pixels (e.g. 50k),
 *   which keeps memory usage and runtime within safe bounds.
 *
 * How to use:
 * 1. Paste this whole script into a new Code Editor script.
 * 2. If your alabama_NLCD_2021 asset is already a 0/1 forest mask (1 = forest, 0 = non-forest),
 *    leave the "CASE 1" block active.
 * 3. If alabama_NLCD_2021 still has NLCD landcover classes (41/42/43 = forest),
 *    comment CASE 1 and uncomment CASE 2.
 * 4. Click Run and read the confusion matrix and accuracy metrics in the Console.
 */

// ----- 1. Load assets -----

// RF prediction (0/1 map), uploaded from your GeoTIFF export.
var rf = ee.Image('projects/earthengine-441016/assets/alabama_2023_RF')
  .select(0)
  .rename('rf');

// NLCD-based reference, uploaded from your NLCD GeoTIFF.
var nlcdRaw = ee.Image('projects/earthengine-441016/assets/alabama_NLCD_2021')
  .select(0);

// ----- 1a. Reference band: choose ONE of the following cases -----

// CASE 1: alabama_NLCD_2021 is ALREADY a 0/1 forest mask (1 = forest, 0 = non-forest).
//         In this case we only rename the band.
var ref = nlcdRaw.rename('ref');

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

// Optional: export the per-seed metrics to Drive as CSV (uncomment to use).
// Export.table.toDrive({
//   collection: metricsFC,
//   description: 'alabama_rf_vs_nlcd_accuracy_multi_seed',
//   fileFormat: 'CSV'
// });

print('Done. Per-seed metrics and mean accuracy/kappa are printed above. Adjust POINTS_PER_CLASS, seeds, or CASE 1/CASE 2 if needed.');

