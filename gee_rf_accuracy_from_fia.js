/**
 * Alabama RF accuracy vs FIA (Forest Inventory and Analysis) plot data.
 * Scope: SCOPE.md.
 *
 * Validates the 10 m forest/non-forest map against independent field-based FIA
 * designations. FIA plots are a stronger reference than NLCD (no same-source bias).
 *
 * Requirements:
 * - RF binary 0/1 image uploaded as a GEE Image asset (your exported GeoTIFF).
 * - FIA points uploaded as a GEE FeatureCollection asset. Each feature must have:
 *   - geometry: point (LAT/LON from FIA; note public coords are perturbed ~0.8 km).
 *   - property 'forest': 1 = forest land, 0 = nonforest (from FIA COND_STATUS_CD).
 *
 * How to create the FIA asset:
 * 1. Download PLOT and COND for Alabama from FIA DataMart (https://apps.fs.usda.gov/fia/datamart).
 * 2. Join PLOT (CN, LAT, LON) with COND (PLT_CN, COND_STATUS_CD, CONDPROP_UNADJ).
 * 3. For each plot: forest = 1 if the condition with largest CONDPROP_UNADJ has COND_STATUS_CD == 1, else 0.
 * 4. Export CSV with columns: lon, lat, forest. Convert to GeoJSON (Point features with property 'forest').
 * 5. In GEE: Assets → New → Table → upload GeoJSON/CSV → create FeatureCollection.
 *
 * See TRAINING_DATA_AND_ACCURACY.md for step-by-step FIA preparation.
 */

// ----- 1. Assets (set to your asset IDs) -----
var RF_ASSET = 'projects/earthengine-441016/assets/alabama_rf_forest_binary_naip_10m';
var FIA_POINTS_ASSET = 'projects/earthengine-441016/assets/alabama_fia_plot_forest_points';

// ----- 2. Load RF image and FIA points -----
var rf = ee.Image(RF_ASSET)
  .select(0)
  .round()
  .toInt()
  .rename('rf');

var fiaPoints = ee.FeatureCollection(FIA_POINTS_ASSET);

// FIA reference property must be 0/1. If your asset uses a different name, remap it.
var REF_PROPERTY = 'forest';  // 1 = forest land, 0 = nonforest

// ----- 3. Alabama bounds (optional: filter points to Alabama) -----
var alabama = ee.FeatureCollection('TIGER/2018/States').filter(ee.Filter.eq('STUSPS', 'AL'));
var region = alabama.geometry();
var fiaInState = fiaPoints.filterBounds(region);

// ----- 4. Sample RF at FIA plot locations -----
// Scale 10 m to match RF resolution. FIA coords are perturbed; we sample at the reported location.
var sampled = rf.sampleRegions({
  collection: fiaInState,
  properties: [REF_PROPERTY],
  scale: 10,
  geometries: false,
  tileScale: 4
});

// ----- 5. Confusion matrix and metrics -----
// Reference = FIA forest (0/1), prediction = RF (0/1).
var cm = sampled.errorMatrix(REF_PROPERTY, 'rf');

print('--- RF vs FIA (plot-based) accuracy ---');
print('FIA plot count (in Alabama):', fiaInState.size());
print('Confusion matrix (rows = FIA ref, cols = RF pred):', cm);
print('Overall accuracy:', cm.accuracy());
print('Kappa:', cm.kappa());
print('Producer accuracy (by FIA class):', cm.producersAccuracy());
print('Consumer accuracy (by RF class):', cm.consumersAccuracy());

// ----- 6. Optional: export sampled points with RF prediction for inspection -----
// Uncomment to export to Drive (each row = one FIA plot, with FIA forest and RF prediction).
// Export.table.toDrive({
//   collection: sampled,
//   description: 'alabama_rf_vs_fia_plot_level',
//   folder: 'alabama_tree_cover_rf_10m',
//   fileFormat: 'CSV'
// });

print('Done. FIA validation uses independent plot data; compare with NLCD-based metrics from gee_rf_accuracy_from_assets.js.');
