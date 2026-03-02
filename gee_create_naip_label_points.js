/**
 * Create NAIP labeling points for Alabama (export to Drive).
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

var N_CORE_FOREST = 800;
var N_CORE_NONFOREST = 800;
var N_EDGE = 800;

function sampleFromMask(mask, n, seed, subsetName, nlcdHint) {
  var pts = ee.Image(1).updateMask(mask).rename('one').sample({
    region: region,
    scale: SCALE,
    numPixels: n,
    seed: seed,
    geometries: true,
    tileScale: 4
  });
  return pts.map(function (f) {
    return ee.Feature(f.geometry(), {
      subset: subsetName,
      nlcd_hint: nlcdHint,
      forest_label: null  // fill manually in QGIS (0/1)
    });
  });
}

var ptsForest = sampleFromMask(coreForest, N_CORE_FOREST, SEED, 'core_forest', 1);
var ptsNonForest = sampleFromMask(coreNonForest, N_CORE_NONFOREST, SEED + 1, 'core_nonforest', 0);
var ptsEdge = sampleFromMask(edge, N_EDGE, SEED + 2, 'edge', null);

var points = ptsForest.merge(ptsNonForest).merge(ptsEdge)
  .randomColumn('rand', SEED)
  .sort('rand')
  .map(function (f) {
    return f.set('id', ee.String('AL_').cat(ee.Number(f.get('rand')).multiply(1e9).toInt().format('%09d')));
  });

print('Points to label:', points.size());
print('Preview (first 10):', points.limit(10));

Map.addLayer(points, { color: 'yellow' }, 'Label points', true);

// ----- 4) Export -----
Export.table.toDrive({
  collection: points,
  description: 'alabama_naip_label_points',
  fileFormat: 'GeoJSON'
});

