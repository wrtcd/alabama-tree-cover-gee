/**
 * Create NAIP labeling points for Alabama (export to Drive).
 * Scope: SCOPE.md.
 *
 * Goal:
 * - Generate a balanced set of points (forest / non-forest + edge cases) for manual labeling in QGIS
 *   using NAIP imagery (or any high-resolution reference).
 *
 * How to use:
 * - Paste into GEE Code Editor and Run.
 * - Run the Export task (GeoJSON or SHP).
 * - In QGIS, load the exported points + add NAIP imagery, then populate the `forest_label` field:
 *   - 1 = forest/tree cover (per your definition)
 *   - 0 = non-forest
 * - Re-upload the labeled points as an Earth Engine asset and use them in `gee_alabama_tree_cover_rf.js`.
 */

// ----- 1) Alabama AOI -----
var alabama = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('STUSPS', 'AL'));
var region = alabama.geometry();
var regionBounds = region.bounds();  // use bounds for sampling so GEE gets enough points
Map.centerObject(alabama, 6);
Map.addLayer(alabama, { color: 'white' }, 'Alabama boundary', true);

// ----- 2) Helper masks to ensure coverage + edge cases -----
// Use NLCD only to STRATIFY sampling so you see both classes and boundaries.
var nlcd = ee.Image('USGS/NLCD_RELEASES/2021_REL/NLCD/2021')
  .select('landcover')
  .clip(region);

var forestMask = ee.Image(0)
  .where(nlcd.eq(41).or(nlcd.eq(42)).or(nlcd.eq(43)), 1)
  .rename('nlcd_forest');

// Edge pixels: where neighborhood mixes forest/non-forest (likely ambiguous).
var r = 60; // meters
var nMax = forestMask.focal_max({ radius: r, units: 'meters' });
var nMin = forestMask.focal_min({ radius: r, units: 'meters' });
var edge = nMax.neq(nMin).rename('edge');

var coreForest = forestMask.eq(1).and(edge.not());
var coreNonForest = forestMask.eq(0).and(edge.not());

// ----- 3) Sampling -----
var SEED = 42;
var SCALE = 30; // sampling scale; label is manual at NAIP resolution later

// Sampling mode:
//   'balanced' = 1000 from likely forest + 1000 from likely non-forest → 2000 points, 50/50 (recommended)
//   'simple'   = 2000 from anywhere (forest/non-forest/edge) → may be class-imbalanced
//   'stratified' = core_forest + core_nonforest + edge strata, then limit 2000 (often returns &lt;2000)
var SAMPLE_MODE = 'balanced';
var N_PER_STRATUM = 1200;
var TARGET_TOTAL = 2000;
var N_BALANCED = 1000;  // per class when SAMPLE_MODE = 'balanced'

function sampleFromMask(mask, n, seed, subsetName, nlcdHint) {
  var pts = ee.Image(1).updateMask(mask).rename('one').sample({
    region: regionBounds,
    scale: SCALE,
    numPixels: n,
    seed: seed,
    geometries: true,
    tileScale: 8
  });
  return pts.map(function (f) {
    return ee.Feature(f.geometry(), {
      subset: subsetName,
      nlcd_hint: nlcdHint,
      forest_label: null  // fill manually in QGIS (0/1)
    });
  });
}

var points;
if (SAMPLE_MODE === 'balanced') {
  // Chunk sampling (GEE limits per call): 6 x 500 per stratum → aim 1000+1000 = 2000
  var forestMask1 = forestMask.eq(1);
  var forestMask0 = forestMask.eq(0);
  var ptsForest = sampleFromMask(forestMask1, 500, SEED, 'forest', 1)
    .merge(sampleFromMask(forestMask1, 500, SEED + 100, 'forest', 1))
    .merge(sampleFromMask(forestMask1, 500, SEED + 200, 'forest', 1))
    .merge(sampleFromMask(forestMask1, 500, SEED + 300, 'forest', 1))
    .merge(sampleFromMask(forestMask1, 500, SEED + 400, 'forest', 1))
    .merge(sampleFromMask(forestMask1, 500, SEED + 500, 'forest', 1))
    .limit(N_BALANCED);
  var ptsNonForest = sampleFromMask(forestMask0, 500, SEED + 1, 'nonforest', 0)
    .merge(sampleFromMask(forestMask0, 500, SEED + 101, 'nonforest', 0))
    .merge(sampleFromMask(forestMask0, 500, SEED + 201, 'nonforest', 0))
    .merge(sampleFromMask(forestMask0, 500, SEED + 301, 'nonforest', 0))
    .merge(sampleFromMask(forestMask0, 500, SEED + 401, 'nonforest', 0))
    .merge(sampleFromMask(forestMask0, 500, SEED + 501, 'nonforest', 0))
    .limit(N_BALANCED);
  points = ptsForest.merge(ptsNonForest)
    .randomColumn('rand', SEED)
    .sort('rand')
    .map(function (f) {
      return f.set('id', ee.String('AL_').cat(ee.Number(f.get('rand')).multiply(1e9).toInt().format('%09d')));
    });
} else if (SAMPLE_MODE === 'simple') {
  var anyLand = coreForest.or(coreNonForest).or(edge);
  var pts = ee.Image(1).updateMask(anyLand).rename('one').sample({
    region: regionBounds,
    scale: SCALE,
    numPixels: TARGET_TOTAL,
    seed: SEED,
    geometries: true,
    tileScale: 8
  });
  points = pts.map(function (f) {
    var pt = ee.Feature(f);
    var hint = forestMask.reduceRegion(ee.Reducer.first(), pt.geometry(), 30).get('nlcd_forest');
    return ee.Feature(f.geometry(), {
      subset: 'simple',
      nlcd_hint: hint,
      forest_label: null
    });
  }).randomColumn('rand', SEED).sort('rand').map(function (f) {
    return f.set('id', ee.String('AL_').cat(ee.Number(f.get('rand')).multiply(1e9).toInt().format('%09d')));
  });
} else {
  // stratified: core_forest + core_nonforest + edge, then limit
  var ptsForest = sampleFromMask(coreForest, N_PER_STRATUM, SEED, 'core_forest', 1);
  var ptsNonForest = sampleFromMask(coreNonForest, N_PER_STRATUM, SEED + 1, 'core_nonforest', 0);
  var ptsEdge = sampleFromMask(edge, N_PER_STRATUM, SEED + 2, 'edge', null);
  points = ptsForest.merge(ptsNonForest).merge(ptsEdge)
    .randomColumn('rand', SEED)
    .sort('rand')
    .limit(TARGET_TOTAL)
    .map(function (f) {
      return f.set('id', ee.String('AL_').cat(ee.Number(f.get('rand')).multiply(1e9).toInt().format('%09d')));
    });
}

print('Points to label:', points.size());
print('Preview (first 10):', points.limit(10));

Map.addLayer(points, { color: 'yellow' }, 'Label points', true);

// ----- 4) Export -----
Export.table.toDrive({
  collection: points,
  description: 'alabama_naip_label_points',
  fileFormat: 'GeoJSON'
});

