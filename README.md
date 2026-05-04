# FDI-fire-danger-modelling
Fire Danger Index modelling workflow using weather, vegetation, topographic, settlement and historical fire variables.

# Fire Danger Index Modelling Workflow

This repository documents and stores the working scripts, notes, and small outputs for Fire Danger Index (FDI) modelling research linked to the improvement of fire danger prediction and early warning workflows.

The repository will be developed gradually as the project evolves. It is intended to support organised version control for Google Earth Engine scripts, R/Python modelling workflows, methodology notes, validation outputs, and project documentation.

## Project purpose

The purpose of this repository is to support the development of an improved Fire Danger Index modelling workflow using geospatial, meteorological, vegetation, topographic, settlement, and historical fire information.

The work aims to improve how fire danger is represented by combining fire-weather conditions with landscape and environmental variables that influence fire occurrence and potential fire behaviour.

## Main research focus

This repository currently focuses on:

* Fire and no-fire sample generation
* Monthly and daily predictor extraction
* Integration of weather, vegetation, topography, settlement, and historical fire variables
* Machine learning-based fire occurrence modelling
* Fire Occurrence Index (FOI) or probability mapping
* Classification of modelled fire probability into Fire Danger Index classes
* Model evaluation using confusion matrices, ROC-AUC, PR-AUC, and other verification metrics
* Documentation of modelling decisions, assumptions, and thresholds

## Repository structure

```text
fdi-fire-danger-modelling/
│
├── README.md
├── .gitignore
│
├── scripts/
│   ├── gee/
│   │   ├── 01_sampling_all_months.js
│   │   ├── 02_export_predictors.js
│   │   └── 03_export_validation_data.js
│   │
│   ├── r/
│   │   ├── 01_train_models.R
│   │   ├── 02_map_predict.R
│   │   └── 03_model_evaluation.R
│   │
│   └── python/
│       └── optional_processing.py
│
├── docs/
│   ├── methodology_notes.md
│   ├── variable_descriptions.md
│   ├── threshold_notes.md
│   └── workflow_log.md
│
├── outputs/
│   ├── figures/
│   ├── tables/
│   └── maps_small/
│
└── data/
    ├── sample_data/
    └── README_data.md
```

## Main datasets and variables

The modelling workflow may include the following broad categories of variables:

### Meteorological variables

* Temperature
* Relative humidity
* Wind speed
* Precipitation
* Dew point temperature
* Vapour pressure deficit, where applicable

### Vegetation and fuel-related variables

* NDVI
* GVMI
* EVI, where applicable
* Land cover / land use classes
* Vegetation or fuel groupings
* Canopy height or fuel structure indicators, where available

### Topographic variables

* Elevation
* Slope
* Aspect
* Topographic Position Index, where applicable
* Topographic Wetness Index, where applicable

### Settlement and human-influence variables

* Built-up area
* Settlement classification
* Wildland-Urban Interface indicators
* Night-time lights, where applicable

### Historical fire variables

* Active fire detections
* Burned area history
* Previous fire occurrence patterns
* Fire occurrence probability indicators

## Modelling approach

The workflow will initially support model development using machine learning and statistical modelling approaches such as:

* Logistic Regression
* Random Forest
* Other classification models, where applicable

The model output may be represented as a continuous fire probability or Fire Occurrence Index, which can later be converted into Fire Danger Index classes using defined thresholds.

## Example FDI class structure

The modelled fire probability may be grouped into five indicative classes:

| Class | Interpretation | Example probability range |
| ----- | -------------- | ------------------------- |
| 1     | Low            | p < 0.40                  |
| 2     | Moderate       | 0.40 ≤ p < 0.65           |
| 3     | High           | 0.65 ≤ p < 0.85           |
| 4     | Very High      | 0.85 ≤ p < 0.95           |
| 5     | Extreme        | p ≥ 0.95                  |

These thresholds are working thresholds and may be revised as model testing and validation progress.

## Model evaluation

Model performance may be evaluated using:

* Confusion matrix
* Accuracy
* Sensitivity / recall
* Specificity
* Precision
* F1-score
* ROC-AUC
* PR-AUC
* Threshold testing
* Spatial map inspection

## Data management note

Large datasets should not be stored directly in this repository.

The following should not be uploaded:

* Large GeoTIFF files
* NetCDF files
* GRIB files
* Full ERA5 or ERA5-Land downloads
* Internal or restricted datasets
* API keys
* Credentials
* Private JSON files
* Large model outputs

Only scripts, documentation, small figures, small tables, and approved sample data should be stored here.

## Current status

This repository is in active development. Scripts, methods, thresholds, datasets, and outputs will be edited and improved as the FDI workflow is refined.

## Author

Minenhle Ngubane

Research focus: fire-weather, GIS, remote sensing, and fire danger modelling.

