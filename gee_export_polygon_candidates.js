/**
 * Export candidate polygons for manual labeling (forest / non-forest).
 *
 * Two options:
 * A) NLCD-based candidates: random tiles over Alabama with dominant class (forest vs non-forest).
 *    You export → open in QGIS with NAIP → set forest_label (0/1), re-upload as asset.
 * B) Draw your own polygons in QGIS (no GEE export): add column forest_label = 0 or 1,
 *    export GeoJSON, upload to GEE as Image/FeatureCollection asset, use in gee_alabama_tree_cover_rf.js
 *    with LABEL_MODE = 'NAIP_POLYGONS'.
 *
 * This script does Option A: generates a set of polygon tiles, each with an nlcd_hint (0 or 1)
 * so you can confirm or correct in QGIS and set forest_label.
 *
 * Run in Code Editor → run Export task → label in QGIS → upload as asset.
 */

// ----- 1) Alabama AOI -----
var alabama = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('STUSPS', 'AL'));
var region = alabama.geometry();

// ----- 2) NLCD forest mask -----
var nlcd = ee.Image('USGS/NLCD_RELEASES/2021_REL/NLCD/2021')
  .select('landcover')
  .clip(region);
var forestMask = ee.Image(0)
  .where(nlcd.eq(41).or(nlcd.eq(42)).or(nlcd.eq(43)), 1)
  .rename('forest');

// ----- 3) Create a grid of polygons (tiles) -----
// Tile size in meters; larger = more pixels per polygon, fewer polygons to label.
var TILE_SIZE_M = 300;   // 300 m ≈ 30×30 pixels at 10 m
var N_FOREST_TILES = 80;  // number of "likely forest" tiles
var N_NONFOREST_TILES = 80;
var SEED = 42;

// Sample random points and create fixed-size tiles around them.
function sampleTile(forestOrNonforest, n, seed) {
  var mask = (forestOrNonforest === 'forest')
    ? forestMask.eq(1)
    : forestMask.eq(0);
  var pts = ee.Image(1).updateMask(mask).rename('one').sample({
    region: region,
    scale: 30,
    numPixels: n,
    seed: seed,
    geometries: true,
    tileScale: 4
  });
  var half = TILE_SIZE_M / 2;
  return pts.map(function(f) {
    var pt = f.geometry().centroid();
    var tile = pt.buffer(half).bounds();
    return ee.Feature(tile, {
      subset: forestOrNonforest,
      nlcd_hint: forestOrNonforest === 'forest' ? 1 : 0,
      forest_label: null  // set in QGIS: 0 or 1
    });
  });
}

var forestTiles = sampleTile('forest', N_FOREST_TILES, SEED);
var nonForestTiles = sampleTile('nonforest', N_NONFOREST_TILES, SEED + 1);
var allTiles = forestTiles.merge(nonForestTiles);

print('Candidate polygons to label:', allTiles.size());
Map.centerObject(alabama, 6);
Map.addLayer(alabama, { color: 'white' }, 'Alabama', true);
Map.addLayer(allTiles, { color: 'yellow', strokeWidth: 1 }, 'Polygon candidates', true);

// ----- 4) Export -----
Export.table.toDrive({
  collection: allTiles,
  description: 'alabama_polygon_candidates_naip',
  fileFormat: 'GeoJSON'
});

print('Run the Export task, then in QGIS: load NAIP, open the GeoJSON, set forest_label = 0 or 1 for each polygon, save, upload to GEE as asset.');
