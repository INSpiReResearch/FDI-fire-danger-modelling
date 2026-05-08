// =============================================================================
// INSpiRe Project — Fire Danger Index (FDI) Daily Data Extraction
// KwaZulu-Natal (KZN), South Africa
// Google Earth Engine (GEE) Script — DAILY RESOLUTION
// VERSION 6.3 — STRATIFIED MEMORY-SAFE CSV EXPORT VERSION
//
// Purpose:
//   Export daily point samples for R/Python modelling without hitting GEE memory
//   limits. This version disables heavy map layers and annual GeoTIFF exports.
//
// How to run:
//   1. Run one month at a time.
//   2. Export CSV only.
//   3. Start with nSamplesPerDay = 300. If recieve memory errors continue, reduce to 200.
//   4. Repeat for 2020–2025 and January–December.
//
// Main changes from previous version:
//   - Monthly run default instead of full May–September.
//   - nSamplesPerDay reduced to 300.
//   - GeoTIFF exports disabled.
//   - Map visualisation disabled except KZN boundary.
//   - Heavy print statements removed.
//   - SRTM reduced to 1 km before terrain focal calculations.
//   - Sampling uses tileScale: 8.
//   - lon/lat added to CSV output.
//   - GHSL SMOD corrected to GHS_SMOD_V2-0/2020.
//   - MODIS products updated to Collection 061.
//   - GEDI L4B MU correctly renamed as aboveground biomass density.
//   - Daily wind, RH and VPD calculated hourly first, then aggregated.
//   - ERA5-Land precipitation/radiation switched to *_hourly bands to avoid
//     overestimating daily totals from accumulated bands.
//
// Author:    Minenhle Ngubane
// Project:   Fire danger modelling research workflow
// Note:      This script is for research and workflow development and does not
//            represent an official operational fire danger warning system.


// =============================================================================
// 0. CONFIGURATION
// =============================================================================

var CONFIG = {

  // ---- Change this each run: 2020, 2021, 2022, 2023, 2024 ----
  exportYear: 2020,

  // ---- Run ONE MONTH at a time to avoid GEE memory errors ----
  // January example. Change month-by-month: 02-01/02-28, 03-01/03-31, etc.
  // Keep this as a monthly period even though the project now covers all months.
  seasonStart: '02-01',
  seasonEnd:   '02-29',

  // Sampling
  nSamplesPerDay: 300,
  fireRatio:      0.40,
  seed:           42,

  // Sentinel-2 rolling window: 10 days either side of target date
  s2WindowDays:   10,

  // Export settings
  exportScale:    1000,
  crs:            'EPSG:32736',
  driveFolder:    'INSpiRe_GEE_Daily_Outputs',

  // SANLC 2022 GEE asset path
  sanlcAsset:     'users/minenhlengubane12/SA_NLC_2022_GEO',
  useSANLC:       true,

  // Prevailing moisture-bearing wind direction for KZN
  // Easterly from Indian Ocean = 90 degrees
  prevailingWindDir: 90
};

var yearStr = String(CONFIG.exportYear);
var runTag = yearStr + '_' +
  CONFIG.seasonStart.replace(/-/g, '') + '_' +
  CONFIG.seasonEnd.replace(/-/g, '');

var seasonStartDate = ee.Date(yearStr + '-' + CONFIG.seasonStart);
var seasonEndDate   = ee.Date(yearStr + '-' + CONFIG.seasonEnd).advance(1, 'day');
var nDays           = seasonEndDate.difference(seasonStartDate, 'day');
var bufferStart     = seasonStartDate.advance(-30, 'day');
var bufferEnd       = seasonEndDate.advance(30, 'day');

print('=== INSpiRe Daily FDI v6.1 Memory-Safe CSV Version — All-Month Workflow ===');
print('Run tag:', runTag);
print('Processing year:', CONFIG.exportYear);
print('Start:', seasonStartDate);
print('End:', ee.Date(yearStr + '-' + CONFIG.seasonEnd));
print('Requested samples per day:', CONFIG.nSamplesPerDay);


// =============================================================================
// 1. STUDY AREA
// =============================================================================

var provinces = ee.FeatureCollection('FAO/GAUL/2015/level1')
  .filter(ee.Filter.eq('ADM0_NAME', 'South Africa'));

var kzn = provinces.filter(ee.Filter.eq('ADM1_NAME', 'KwaZulu-Natal'));
var kznGeom = kzn.geometry();

Map.centerObject(kznGeom, 7);
Map.addLayer(kzn, {color: 'blue'}, 'KZN Boundary');


// =============================================================================
// 2. HELPER FUNCTIONS
// =============================================================================

function maskS2clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3)   // cloud shadow
    .and(scl.neq(8))      // medium probability cloud
    .and(scl.neq(9))      // high probability cloud
    .and(scl.neq(10));    // cirrus
  return image.updateMask(mask);
}

function scaleS2(image) {
  var scaled = image
    .select(['B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12'])
    .multiply(0.0001);
  return image.addBands(scaled, null, true);
}

function computeS2Indices(img) {
  var ndvi = img.normalizedDifference(['B8','B4']).rename('ndvi');

  var evi = img.expression(
    '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)',
    {
      NIR: img.select('B8'),
      RED: img.select('B4'),
      BLUE: img.select('B2')
    }
  ).rename('evi');

  var gvmi = img.expression(
    '(B8A + 0.1 - (B11 + 0.02)) / (B8A + 0.1 + (B11 + 0.02))',
    {
      B8A: img.select('B8A'),
      B11: img.select('B11')
    }
  ).rename('gvmi');

  var nbr = img.normalizedDifference(['B8','B12']).rename('nbr');

  return ndvi.addBands(evi).addBands(gvmi).addBands(nbr)
    .set('system:time_start', img.get('system:time_start'));
}

function zeroImage(bandNames) {
  return ee.Image.constant(ee.List.repeat(0, bandNames.length))
    .rename(bandNames)
    .clip(kznGeom);
}

function addLonLat(f) {
  var coords = f.geometry().coordinates();
  return f.set({
    lon: coords.get(0),
    lat: coords.get(1)
  });
}


// =============================================================================
// 3. STATIC LAYERS — MEMORY-SAFE 1 KM TERRAIN
// =============================================================================

print('--- Computing static layers at 1 km working scale ---');

// Reduce SRTM to the 1 km working grid first to reduce memory use.
var srtmRaw = ee.Image('USGS/SRTMGL1_003').clip(kznGeom);

var srtm1km = srtmRaw
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    maxPixels: 4096
  })
  .reproject({
    crs: CONFIG.crs,
    scale: CONFIG.exportScale
  })
  .clip(kznGeom);

var elevation = srtm1km.rename('elevation');
var slope     = ee.Terrain.slope(srtm1km).rename('slope');
var aspect    = ee.Terrain.aspect(srtm1km).rename('aspect');

// TWI proxy. This is a relative terrain-moisture proxy, not a full hydrological TWI.
var slopeRad = slope.multiply(Math.PI / 180);
var tanSlope = slopeRad.tan().max(0.001);
var flowProxy = elevation.focal_mean({radius: 3000, units: 'meters', kernelType: 'circle'});
var twi = flowProxy.divide(tanSlope).log().rename('twi');

var tpi_local = elevation.subtract(
  elevation.focal_mean({radius: 3000, units: 'meters', kernelType: 'circle'})
).rename('tpi_local');

var tpi_land = elevation.subtract(
  elevation.focal_mean({radius: 10000, units: 'meters', kernelType: 'circle'})
).rename('tpi_landscape');

var aspectRad = aspect.multiply(Math.PI / 180);
var prevWindRad = CONFIG.prevailingWindDir * Math.PI / 180;
var rainShadow = aspectRad.subtract(prevWindRad).cos().rename('rain_shadow');

var windExposure = tpi_local
  .divide(tpi_local.abs().max(1))
  .multiply(0.2)
  .add(1)
  .rename('wind_exposure');

// ERA5 grid mean elevation for lapse-rate correction in R.
// Important: do NOT reduce 30 m SRTM directly to 9 km because GEE may need
// ~80,000+ input pixels per output pixel. First reduce to 1 km, then aggregate
// the 1 km surface to the ERA5-scale grid.
var era5Elevation = srtm1km
  .reduceResolution({
    reducer: ee.Reducer.mean(),
    bestEffort: true,
    maxPixels: 256
  })
  .reproject({crs: 'EPSG:4326', scale: 9000})
  .rename('elevation_era5_grid')
  .unmask(0);

var terrainStack = elevation
  .addBands(slope)
  .addBands(aspect)
  .addBands(twi)
  .addBands(tpi_local)
  .addBands(tpi_land)
  .addBands(rainShadow)
  .addBands(windExposure)
  .addBands(era5Elevation)
  .unmask(0);


// ---- GHSL Built-up Surface ----
// Use the direct year image ID. Filtering the ImageCollection by a 'year'
// property can return null and cause Image.select null errors.
var ghslBuiltup = ee.Image('JRC/GHSL/P2023A/GHS_BUILT_S/2020')
  .select('built_surface')
  .rename('ghsl_buildup')
  .unmask(0)
  .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
  .clip(kznGeom);

// ---- GHSL Settlement Model ----
// Use the direct year image ID.
var ghslSmod = ee.Image('JRC/GHSL/P2023A/GHS_SMOD_V2-0/2020')
  .select('smod_code')
  .rename('ghsl_smod')
  .unmask(0)
  .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
  .clip(kznGeom);

// ---- GEDI L4B Aboveground Biomass Density ----
// Note: this is NOT RH98 canopy height. MU = mean AGBD in Mg/ha.
var gedi = ee.Image('LARSE/GEDI/GEDI04_B_002')
  .select('MU')
  .rename('gedi_agbd_mg_ha')
  .unmask(0)
  .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
  .clip(kznGeom);


// ---- SANLC 2022 + derived layers ----
var sanlcClass, flammability, wuiInterface, wuiIntermix, agriInterface;

if (CONFIG.useSANLC) {

  var sanlcRaw = ee.Image(CONFIG.sanlcAsset);
  var sanlcBandName = sanlcRaw.bandNames().get(0);

  sanlcClass = sanlcRaw
    .select([sanlcBandName])
    .rename('sanlc_class')
    .toInt()
    .unmask(0)
    .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
    .clip(kznGeom);

  var sanlcFrom = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20];
  var flamTo    = [80,95,90,70,10,60,85,80,75,40,30,50,20,5,5,0,0];

  flammability = sanlcClass
    .remap(sanlcFrom, flamTo, 50)
    .rename('flammability_score')
    .toInt()
    .unmask(50)
    .clip(kznGeom);

  var naturalVeg = sanlcClass.gte(2).and(sanlcClass.lte(5)).unmask(0);

  // WUI at 1 km needs a neighbourhood definition.
  // The previous threshold/logic was too strict because it only flagged built-up
  // pixels that also touched vegetation. For fire danger modelling, we want fuel
  // pixels close to settlements, because that is where ignition/exposure risk is
  // operationally more meaningful.

  // Fuel vegetation mask: natural vegetation + plantation fuels.
  // SANLC classes: 2 grassland, 3 shrubland/fynbos, 4 thicket/bushveld,
  // 5 indigenous forest, 7 pine, 8 eucalyptus, 9 wattle.
  var fuelVeg = sanlcClass
    .remap([2, 3, 4, 5, 7, 8, 9], [1, 1, 1, 1, 1, 1, 1], 0)
    .eq(1)
    .unmask(0);

  // Use any built surface at 1 km as settlement presence.
  // Later we can sensitivity-test thresholds such as >50 or >100.
  var builtupMask = ghslBuiltup.gt(0).unmask(0);

  // At a 1 km working grid, 500 m is too tight. A 1.5 km neighbourhood captures
  // the current and adjacent cells more reliably.
  var builtProximity = builtupMask
    .focal_max({radius: 1500, units: 'meters', kernelType: 'circle'})
    .unmask(0);

  // WUI interface for this FDI model: fuel/vegetated pixels close to settlement.
  wuiInterface = fuelVeg.and(builtProximity)
    .rename('wui_interface')
    .toInt()
    .unmask(0)
    .clip(kznGeom);

  // WUI intermix: local neighbourhood contains both settlement and fuel.
  var builtFraction = builtupMask
    .focal_mean({radius: 1500, units: 'meters', kernelType: 'circle'})
    .unmask(0);

  var fuelFraction = fuelVeg
    .focal_mean({radius: 1500, units: 'meters', kernelType: 'circle'})
    .unmask(0);

  wuiIntermix = builtFraction.gt(0.02).and(fuelFraction.gt(0.25))
    .rename('wui_intermix')
    .toInt()
    .unmask(0)
    .clip(kznGeom);

  var cultivated = sanlcClass.eq(12).unmask(0);
  var vegProx1km = naturalVeg
    .focal_max({radius: 1000, units: 'meters', kernelType: 'circle'})
    .unmask(0);

  agriInterface = cultivated.and(vegProx1km)
    .rename('agri_interface')
    .toInt()
    .unmask(0)
    .clip(kznGeom);

  print('SANLC enabled. Using band:', sanlcBandName);

} else {
  sanlcClass    = zeroImage(['sanlc_class']);
  flammability  = zeroImage(['flammability_score']);
  wuiInterface  = zeroImage(['wui_interface']);
  wuiIntermix   = zeroImage(['wui_intermix']);
  agriInterface = zeroImage(['agri_interface']);
  print('SANLC disabled. Using zero placeholders.');
}

var humanStaticStack = ghslBuiltup
  .addBands(ghslSmod)
  .addBands(sanlcClass)
  .addBands(flammability)
  .addBands(wuiInterface)
  .addBands(wuiIntermix)
  .addBands(agriInterface)
  .unmask(0);

print('Static layers prepared.');


// =============================================================================
// 4. PRE-LOAD DYNAMIC COLLECTIONS
// =============================================================================

var era5hourly = ee.ImageCollection('ECMWF/ERA5_LAND/HOURLY')
  .filterDate(bufferStart, bufferEnd)
  .filterBounds(kznGeom)
  .select([
    'temperature_2m',
    'dewpoint_temperature_2m',
    'u_component_of_wind_10m',
    'v_component_of_wind_10m',
    'total_precipitation_hourly',
    'volumetric_soil_water_layer_1',
    'surface_solar_radiation_downwards_hourly'
  ]);

var s2collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate(bufferStart, bufferEnd)
  .filterBounds(kznGeom)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
  .map(maskS2clouds)
  .map(scaleS2)
  .map(computeS2Indices);

var modisNDVI_season = ee.ImageCollection('MODIS/061/MOD13A2')
  .filterDate(bufferStart, bufferEnd)
  .filterBounds(kznGeom)
  .select('NDVI')
  .map(function(img) {
    // Do not clip MODIS images here. Clipping before reprojection can cause
    // SR-ORG:6974 to EPSG transform errors during table export.
    return img.multiply(0.0001)
      .set('system:time_start', img.get('system:time_start'));
  });

var modisNDVI_allYears = ee.ImageCollection('MODIS/061/MOD13A2')
  .filterDate('2020-01-01', '2025-01-01')
  .filterBounds(kznGeom)
  .select('NDVI')
  .map(function(img) {
    // Do not clip MODIS images here. Reproject derived outputs later instead.
    return img.multiply(0.0001)
      .set('system:time_start', img.get('system:time_start'));
  });

var ndvi_peak = modisNDVI_allYears.max()
  .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});
var ndvi_min  = modisNDVI_allYears.min()
  .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

var modisFireTerra = ee.ImageCollection('MODIS/061/MOD14A1')
  .filterDate(bufferStart, bufferEnd)
  .filterBounds(kznGeom)
  .select(['FireMask','MaxFRP']);

var modisFireAqua = ee.ImageCollection('MODIS/061/MYD14A1')
  .filterDate(bufferStart, bufferEnd)
  .filterBounds(kznGeom)
  .select(['FireMask','MaxFRP']);

var modisFireAll = modisFireTerra.merge(modisFireAqua);

var mcd64 = ee.ImageCollection('MODIS/061/MCD64A1')
  .filterDate(seasonStartDate.advance(-5, 'year'), bufferEnd)
  .filterBounds(kznGeom)
  .select('BurnDate');

var ntlCollection = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG')
  .filterDate(bufferStart, bufferEnd)
  .filterBounds(kznGeom)
  .select('avg_rad');

print('Dynamic collections loaded.');


// =============================================================================
// 5. DAILY ERA5-LAND AGGREGATION
// =============================================================================

function getDailyERA5(date) {
  var start = date;
  var end   = date.advance(1, 'day');
  var daily = era5hourly.filterDate(start, end);

  var weatherBands = [
    'temp_max_c','temp_min_c','temp_mean_c','dewpoint_c',
    'wind_max_ms','wind_mean_ms','precip_mm','soil_moisture',
    'solar_rad','vpd_kpa','vpd_max_kpa','rh_min_pct',
    'rh_mean_pct','dryness_increment'
  ];

  var result = ee.Algorithms.If(
    daily.size().gt(0),
    (function() {

      var dailyMet = daily.map(function(img) {
        var tempC = img.select('temperature_2m').subtract(273.15).rename('temp_c');
        var dewC  = img.select('dewpoint_temperature_2m').subtract(273.15).rename('dewpoint_c_hourly');

        var es = tempC.expression(
          '0.6108 * exp(17.27 * T / (T + 237.3))',
          {T: tempC}
        );

        var ea = dewC.expression(
          '0.6108 * exp(17.27 * Td / (Td + 237.3))',
          {Td: dewC}
        );

        var rh = ea.divide(es).multiply(100).clamp(0, 100).rename('rh_pct');
        var vpd = es.subtract(ea).max(0).rename('vpd_kpa_hourly');

        var wind = img.expression(
          'sqrt(u*u + v*v)',
          {
            u: img.select('u_component_of_wind_10m'),
            v: img.select('v_component_of_wind_10m')
          }
        ).rename('wind_ms');

        return img.addBands([tempC, dewC, rh, vpd, wind]);
      });

      var temp_max  = dailyMet.select('temp_c').max().rename('temp_max_c');
      var temp_min  = dailyMet.select('temp_c').min().rename('temp_min_c');
      var temp_mean = dailyMet.select('temp_c').mean().rename('temp_mean_c');
      var dewpt     = dailyMet.select('dewpoint_c_hourly').mean().rename('dewpoint_c');

      var wind_max  = dailyMet.select('wind_ms').max().rename('wind_max_ms');
      var wind_mean = dailyMet.select('wind_ms').mean().rename('wind_mean_ms');

      // Use the Earth Engine hourly precipitation band, not the accumulated
      // total_precipitation band, otherwise daily totals are overestimated.
      var precip = daily.select('total_precipitation_hourly')
        .sum()
        .multiply(1000)
        .rename('precip_mm');

      var soil_moist = daily.select('volumetric_soil_water_layer_1')
        .mean()
        .rename('soil_moisture');

      // Use the hourly radiation band to avoid summing cumulative forecast-step values.
      var solar = daily.select('surface_solar_radiation_downwards_hourly')
        .sum()
        .rename('solar_rad');

      var vpd = dailyMet.select('vpd_kpa_hourly').mean().rename('vpd_kpa');
      var vpd_max = dailyMet.select('vpd_kpa_hourly').max().rename('vpd_max_kpa');
      var rh_min = dailyMet.select('rh_pct').min().rename('rh_min_pct');
      var rh_mean = dailyMet.select('rh_pct').mean().rename('rh_mean_pct');

      var dryness = temp_max.subtract(10)
        .subtract(precip.multiply(5))
        .rename('dryness_increment');

      return temp_max.addBands(temp_min)
        .addBands(temp_mean)
        .addBands(dewpt)
        .addBands(wind_max)
        .addBands(wind_mean)
        .addBands(precip)
        .addBands(soil_moist)
        .addBands(solar)
        .addBands(vpd)
        .addBands(vpd_max)
        .addBands(rh_min)
        .addBands(rh_mean)
        .addBands(dryness)
        .clip(kznGeom);
    })(),
    zeroImage(weatherBands)
  );

  return ee.Image(result).set('system:time_start', start.millis());
}


// =============================================================================
// 6. DAILY SENTINEL-2 COMPOSITE
// =============================================================================

function getDailyS2(date) {
  var start = date.advance(-CONFIG.s2WindowDays, 'day');
  var end   = date.advance(CONFIG.s2WindowDays, 'day');
  var filtered = s2collection.filterDate(start, end);

  var fallback = zeroImage(['ndvi','evi','gvmi','nbr']);

  var composite = ee.Algorithms.If(
    filtered.size().gt(0),
    filtered.median().clip(kznGeom),
    fallback
  );

  return ee.Image(composite).set('system:time_start', date.millis());
}


// =============================================================================
// 7. DAILY MODIS NDVI / GRASS CURING
// =============================================================================

function getDailyMODISNDVI(date) {
  var fallback = zeroImage(['modis_ndvi','grass_curing','ndvi_anomaly']);

  var beforeCol = modisNDVI_season
    .filterDate(date.advance(-20, 'day'), date.advance(1, 'day'));
  var afterCol = modisNDVI_season
    .filterDate(date, date.advance(20, 'day'));

  var hasData = beforeCol.size().gt(0).and(afterCol.size().gt(0));

  var result = ee.Algorithms.If(
    hasData,
    (function() {
      var before = beforeCol.sort('system:time_start', false).first();
      var after  = afterCol.sort('system:time_start', true).first();

      var t1 = ee.Date(before.get('system:time_start'));
      var t2 = ee.Date(after.get('system:time_start'));
      var totalDiff = t2.difference(t1, 'day').max(1);
      var currentDiff = date.difference(t1, 'day');
      var fraction = currentDiff.divide(totalDiff).clamp(0, 1);

      var ndvi_interp = before
        .multiply(ee.Number(1).subtract(fraction))
        .add(after.multiply(fraction))
        .rename('modis_ndvi')
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var curing = ndvi_peak.subtract(ndvi_interp)
        .divide(ndvi_peak.subtract(ndvi_min).max(0.01))
        .multiply(100)
        .clamp(0, 100)
        .rename('grass_curing')
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var doy = date.getRelative('day', 'year').add(1);
      var doyStart = ee.Number(doy).subtract(10).max(1);
      var doyEnd   = ee.Number(doy).add(10).min(366);

      var climCol = modisNDVI_allYears
        .filter(ee.Filter.calendarRange(doyStart, doyEnd, 'day_of_year'));

      var ndvi_anom = ee.Algorithms.If(
        climCol.size().gt(0),
        ndvi_interp.subtract(
          climCol.mean().reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
        ).rename('ndvi_anomaly'),
        ee.Image.constant(0).rename('ndvi_anomaly').reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
      );

      return ndvi_interp.addBands(curing)
        .addBands(ee.Image(ndvi_anom).reproject({crs: CONFIG.crs, scale: CONFIG.exportScale}));
    })(),
    fallback
  );

  return ee.Image(result).set('system:time_start', date.millis());
}


// =============================================================================
// 8. DAILY FIRE LABEL
// =============================================================================

function getDailyFireLabel(date) {
  var start = date;
  var end = date.advance(1, 'day');
  var dayFire = modisFireAll.filterDate(start, end);

  var fireBands = ['fire_label','fire_high_conf','fire_any_conf','modis_fire_count','frp_mw'];

  var result = ee.Algorithms.If(
    dayFire.size().gt(0),
    (function() {
      var fireMaskMax = dayFire.select('FireMask').max();

      // Important: reproject MODIS-derived bands to the 1 km working CRS and do
      // not clip here. Clipping MODIS sinusoidal bands can trigger SR-ORG:6974
      // transform errors during table export.
      var fireLabel = fireMaskMax.gte(8)
        .rename('fire_label')
        .unmask(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var fireHighConf = fireMaskMax.eq(9)
        .rename('fire_high_conf')
        .unmask(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var fireAny = fireMaskMax.gte(7)
        .rename('fire_any_conf')
        .unmask(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var fireCount = dayFire.select('FireMask')
        .map(function(img) {
          return img.gte(8).rename('fire_px');
        })
        .sum()
        .rename('modis_fire_count')
        .unmask(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var frp = dayFire.select('MaxFRP')
        .max()
        .multiply(0.1)
        .rename('frp_mw')
        .unmask(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      return fireLabel.addBands(fireHighConf)
        .addBands(fireAny)
        .addBands(fireCount)
        .addBands(frp);
    })(),
    zeroImage(fireBands)
  );

  return ee.Image(result).set('system:time_start', start.millis());
}


// =============================================================================
// 9. DAILY TSLF AND BURN FREQUENCY
// =============================================================================

function getDailyTSLF(date) {
  var lookbackStart = date.advance(-5, 'year');
  var pastBurns = mcd64.filterDate(lookbackStart, date);

  var result = ee.Algorithms.If(
    pastBurns.size().gt(0),
    (function() {
      var burnMillisCol = pastBurns.map(function(img) {
        var burnDate = img.select('BurnDate');
        var burned = burnDate.gt(0);

        var year = ee.Number(ee.Date(img.get('system:time_start')).get('year'));
        var yearStart = ee.Date.fromYMD(year, 1, 1);

        // Cast to Double so every image in the collection has the same band type.
        // Without this, GEE can fail with a homogeneous ImageCollection error
        // because yearStart.millis() has a different Long range for each year.
        var millis = ee.Image.constant(yearStart.millis()).toDouble()
          .add(burnDate.subtract(1).toDouble().multiply(24 * 60 * 60 * 1000))
          .updateMask(burned)
          .rename('burn_millis')
          .toDouble();

        return millis;
      });

      var lastBurnMillis = ee.ImageCollection(burnMillisCol).max().toDouble();

      var tslfDays = ee.Image.constant(date.millis()).toDouble()
        .subtract(lastBurnMillis)
        .divide(24 * 60 * 60 * 1000)
        .rename('tslf_days')
        .unmask(1825)
        .min(1825)
        .max(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      var nBurns5yr = pastBurns.map(function(img) {
        return img.select('BurnDate').gt(0).rename('burned');
      }).sum()
        .rename('n_burns_5yr')
        .unmask(0)
        .reproject({crs: CONFIG.crs, scale: CONFIG.exportScale});

      return tslfDays.addBands(nBurns5yr.unmask(0));
    })(),
    ee.Image.constant([1825, 0]).rename(['tslf_days','n_burns_5yr']).reproject({crs: CONFIG.crs, scale: CONFIG.exportScale})
  );

  return ee.Image(result).set('system:time_start', date.millis());
}


// =============================================================================
// 10. DAILY NTL
// =============================================================================

function getDailyNTL(date) {
  var monthStart = date.update({day: 1});
  var monthEnd = monthStart.advance(1, 'month');
  var monthNTL = ntlCollection.filterDate(monthStart, monthEnd);

  var ntl = ee.Algorithms.If(
    monthNTL.size().gt(0),
    monthNTL.mean().rename('ntl_radiance').clip(kznGeom),
    ee.Image(0).rename('ntl_radiance').clip(kznGeom)
  );

  return ee.Image(ntl).set('system:time_start', date.millis());
}


// =============================================================================
// 11. ASSEMBLE DAILY PREDICTOR STACK
// =============================================================================

function buildDailyStack(date) {
  var dateObj = ee.Date(date);

  var weather  = getDailyERA5(dateObj);
  var s2veg    = getDailyS2(dateObj);
  var modisVeg = getDailyMODISNDVI(dateObj);
  var fire     = getDailyFireLabel(dateObj);
  var tslf     = getDailyTSLF(dateObj);
  var ntl      = getDailyNTL(dateObj);

  var stack = weather
    .addBands(s2veg.select(['ndvi','evi','gvmi','nbr']))
    .addBands(modisVeg.select(['modis_ndvi','grass_curing','ndvi_anomaly']))
    .addBands(fire.select(['fire_label','fire_high_conf','fire_any_conf','modis_fire_count','frp_mw']))
    .addBands(tslf.select(['tslf_days','n_burns_5yr']))
    .addBands(ntl.select(['ntl_radiance']))
    .addBands(terrainStack)
    .addBands(humanStaticStack)
    .addBands(gedi);
    // Do not unmask the final full stack. Static/absence variables are already
    // unmasked individually, while keeping weather masks allows stratifiedSample
    // with dropNulls:true to avoid edge pixels with invalid zero weather values.

  return stack
    .set('year', dateObj.get('year'))
    .set('month', dateObj.get('month'))
    .set('day', dateObj.get('day'))
    .set('doy', dateObj.getRelative('day','year').add(1))
    .set('date_str', dateObj.format('YYYY-MM-dd'))
    .set('system:time_start', dateObj.millis());
}


// =============================================================================
// 12. DAILY COLLECTION
// =============================================================================

print('--- Creating daily collection for CSV sampling only ---');

var dayOffsets = ee.List.sequence(0, nDays.subtract(1));

var dailyCollection = ee.ImageCollection(
  dayOffsets.map(function(offset) {
    var date = seasonStartDate.advance(offset, 'day');
    return buildDailyStack(date);
  })
);

// Avoid heavy inspection, e.g. dailyCollection.first().bandNames(), because it can
// trigger memory errors. The export below will evaluate lazily in batch mode.
print('Daily collection prepared. Heavy band inspection skipped.');


// =============================================================================
// 13. STRATIFIED DAILY SAMPLING — CSV EXPORT ONLY
// =============================================================================

print('--- Preparing daily stratified samples for CSV export ---');

var nFire = Math.round(CONFIG.nSamplesPerDay * CONFIG.fireRatio);
var nNoFire = Math.round(CONFIG.nSamplesPerDay * (1 - CONFIG.fireRatio));

// Use stratifiedSample instead of separate updateMask().sample() calls.
// This prevents fake 'fire' rows with blank predictor values on days where
// there are too few or no fire pixels. stratifiedSample only returns pixels
// that truly belong to the requested fire_label class.
var allSamples = dailyCollection.map(function(img) {

  var sampled = img.stratifiedSample({
    numPoints: 0,
    classBand: 'fire_label',
    classValues: [0, 1],
    classPoints: [nNoFire, nFire],
    region: kznGeom,
    scale: CONFIG.exportScale,
    seed: CONFIG.seed,
    geometries: true,
    tileScale: 8,
    dropNulls: true
  })
  .map(addLonLat)
  .map(function(f) {
    var fireClass = ee.Number(f.get('fire_label'));
    return f.set({
      sample_type: ee.Algorithms.If(fireClass.eq(1), 'fire', 'no_fire'),
      date_str: img.get('date_str'),
      year: img.get('year'),
      month: img.get('month'),
      day: img.get('day'),
      doy: img.get('doy')
    });
  });

  return sampled;
});

var allSamplesFlat = allSamples.flatten();

Export.table.toDrive({
  collection: allSamplesFlat,
  description: 'INSpiRe_KZN_Daily_Samples_v6_3_stratified_' + runTag,
  folder: CONFIG.driveFolder,
  fileNamePrefix: 'INSpiRe_KZN_daily_samples_v6_3_stratified_' + runTag,
  fileFormat: 'CSV',
  selectors: [
    // Metadata
    'date_str','year','month','day','doy','sample_type','lon','lat',

    // Fire labels — response and diagnostics. Do not use diagnostics as predictors in R.
    'fire_label','fire_high_conf','fire_any_conf','modis_fire_count','frp_mw',

    // Weather
    'temp_max_c','temp_min_c','temp_mean_c','dewpoint_c',
    'wind_max_ms','wind_mean_ms','precip_mm',
    'soil_moisture','solar_rad',
    'vpd_kpa','vpd_max_kpa','rh_min_pct','rh_mean_pct',
    'dryness_increment',

    // Vegetation
    'ndvi','evi','gvmi','nbr',
    'modis_ndvi','grass_curing','ndvi_anomaly',

    // Fire history
    'tslf_days','n_burns_5yr',

    // Human / ignition / landscape
    'ntl_radiance','ghsl_buildup','ghsl_smod',
    'sanlc_class','flammability_score',
    'wui_interface','wui_intermix','agri_interface',

    // Terrain
    'elevation','elevation_era5_grid',
    'slope','aspect','twi','tpi_local','tpi_landscape',
    'rain_shadow','wind_exposure',

    // GEDI biomass proxy
    'gedi_agbd_mg_ha'
  ]
});

print('CSV export prepared. Open the Tasks tab and click Run.');
print('Export folder:', CONFIG.driveFolder);
print('Export file prefix:', 'INSpiRe_KZN_daily_samples_v6_3_stratified_' + runTag);


// =============================================================================
// 14. GEOTIFF EXPORTS DISABLED
// =============================================================================
// GeoTIFF exports are intentionally disabled in this memory-safe version.
// First export the daily CSV samples. Once the model is trained, export only final
// prediction rasters or static layers separately.


// =============================================================================
// 15. MAP VISUALISATION DISABLED
// =============================================================================
// Heavy daily layers are intentionally not displayed to prevent memory errors.
// Keep only the KZN boundary map layer from Section 1.


// =============================================================================
// 16. ALL-MONTH RUN GUIDE
// =============================================================================
// The modelling period now covers the full year, not only May–September.
// Run these monthly periods for each year:
//   January:   seasonStart = '01-01', seasonEnd = '01-31'
//   February:  seasonStart = '02-01', seasonEnd = '02-28'
//              For leap year 2020, use seasonEnd = '02-29'
//   March:     seasonStart = '03-01', seasonEnd = '03-31'
//   April:     seasonStart = '04-01', seasonEnd = '04-30'
//   May:       seasonStart = '05-01', seasonEnd = '05-31'
//   June:      seasonStart = '06-01', seasonEnd = '06-30'
//   July:      seasonStart = '07-01', seasonEnd = '07-31'
//   August:    seasonStart = '08-01', seasonEnd = '08-31'
//   September: seasonStart = '09-01', seasonEnd = '09-30'
//   October:   seasonStart = '10-01', seasonEnd = '10-31'
//   November:  seasonStart = '11-01', seasonEnd = '11-30'
//   December:  seasonStart = '12-01', seasonEnd = '12-31'
//
// Do not run January–December in one GEE task. Run one month at a time.
// For 2020–2024, this will create 60 monthly CSV files.
//
// If memory errors continue:
//   1. Reduce nSamplesPerDay from 300 to 200.
//   2. Split a month into two periods, e.g. 01-01 to 01-15 and 01-16 to 01-31.
//   3. Temporarily set useSANLC = false to check whether the uploaded SANLC layer
//      is causing the issue.
//
// In R/Python, do not use these as predictors:
//   fire_label, fire_high_conf, fire_any_conf, modis_fire_count, frp_mw,
//   sample_type, date_str, lon, lat
// =============================================================================
