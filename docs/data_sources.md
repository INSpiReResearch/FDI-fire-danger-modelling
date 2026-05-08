# Data Sources

This document lists the main public datasets used in the daily Fire Danger Index modelling workflow.

## Meteorological data

### ERA5-Land Hourly

Used for daily weather predictor extraction.

Main variables:

- 2 m temperature
- 2 m dewpoint temperature
- 10 m u-wind component
- 10 m v-wind component
- hourly total precipitation
- volumetric soil water layer 1 (soil moisture variable)
- hourly surface solar radiation downwards (affects how quickly fuels dry)

Derived variables include:

- daily maximum temperature
- daily minimum temperature
- daily mean temperature
- daily maximum wind speed
- daily mean wind speed
- daily rainfall total
- daily minimum relative humidity
- daily mean relative humidity
- daily mean vapour pressure deficit
- daily maximum vapour pressure deficit

## Fire occurrence data

### MODIS Active Fire: used to create daily fire/no-fire labels

### VIIRS active fire — planned enhancement: VIIRS active fire detections for better spatial resolution than MODIS, detecting smaller fire events. will test combined active fire label: MODIS & VIIRS detections) 
()

Products:

- MODIS Terra active fire
- MODIS Aqua active fire

Derived variables:

- `fire_label`
- `fire_high_conf`
- `fire_any_conf`
- `modis_fire_count`
- `frp_mw`

The `fire_label` is used as the response variable.

## Burned-area and fire-history data

### MODIS MCD64A1 Burned Area

Used to derive:

- time since last fire
- number of burns in the previous five years

## Vegetation data

### Sentinel-2 Surface Reflectance

Used to derive:

- NDVI
- EVI
- GVMI
- NBR

### MODIS NDVI

Used to derive:

- interpolated MODIS NDVI
- grass-curing proxy
- NDVI anomaly

## Terrain data

### SRTM

Used to derive:

- elevation
- slope
- aspect
- topographic wetness index
- local topographic position index
- landscape topographic position index
- rain-shadow index
- wind-exposure proxy

## Human settlement and land-cover data

### GHSL Built-up Surface

Used to represent built-up surface intensity.

### GHSL Settlement Model

Represents settlement classification.

### South African National Land Cover 2022

Represents land-cover class, fuel classes, flammability score, WUI interface, WUI intermix and agricultural interface.

## Night-time lights

### VIIRS Night-time Lights

A proxy for human activity and settlement intensity.

## Biomass / fuel structure proxy

### GEDI L4B Aboveground Biomass Density

## Biomass / fuel-structure proxy

### GEDI L4B Aboveground Biomass Density

GEDI L4B Aboveground Biomass Density is used as proxy for fuel biomass and vegetation structure.
The `MU` band represents estimated mean aboveground biomass density at 1km resolution (in Mg/ha), will assist when determining fuel availability 
