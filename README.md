# FDI-fire-danger-modelling
Fire Danger Index modelling workflow using weather, vegetation, topographic, settlement and historical fire variables.

# Fire Danger Index Modelling Workflow

This repository documents and stores the working scripts, notes, and outputs for Fire Danger Index (FDI) modelling research
The repository is being developed gradually as the project evolves. It is intended to support organised version control for Google Earth Engine scripts, R(Python) modelling workflows, methodology notes, validation outputs, and project documentation.

## Project purpose

The purpose of this repository is to support the development of an improved Fire Danger Index modelling workflow using geospatial, meteorological, vegetation, topographic, settlement, and historical fire information.

The work aims to improve how fire danger is represented by combining fire-weather conditions with environmental variables that influence fire occurrence and fire behaviour.

## Main research focus

This repository currently focuses on:

* Fire and no-fire samples
* Monthly and daily predictor extraction (will eventually be hourly for more accuracy)
* Integration of weather, vegetation, topography, settlement, and historical fire variables
* Machine learning-based modelling (random forest and logistic regression)
* Fire Occurrence Index (FOI) / probability mapping
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
│   
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

The modelling workflow would include the following broad categories of variables:

### Meteorological variables

* Temperature: influences fuel drying and atmospheric fire-weather conditions
* Relative humidity: affects how quickly fine fuels dry or retain moisture
* Wind speed: influences fire spread and potential and oxygen supply
* Precipitation: affects short-term fuel moisture and suppreses fire likelihood
* Dew point temperature: provides information on atmospheric moisture conditions
* Vapour pressure deficit: represents atmospheric drying demand, useful for identifying conditions where vegetation and fine fuels may loose moisture more quickly

### Vegetation and fuel-related variables
(vegetation and fuel variables describe the amount, type and condition of burnable material on landscape)
* NDVI: provides an indication of vegetation greenness and live vegetation conditions
* GVMI: vegetation moisture condition
* EVI: supports vegetation monitoring, in areas where NDVI may saturate
* Land cover / land use classes:distinguishes different classes (grassland. forest, built-up etc)
* Vegetation / fuel groupings:assists in translating land-cover information into fire-relevant fuel categories. 
* Canopy height or fuel structure indicators: represents vertical and structural characteristics of vegetation
* GEDI above ground biomass density: provides proxy for fuel biomass and vegetation structure. 

### Topographic variables
(influences local microclimate, fuelmoisture, wind exposure and fire behaviour. terrain variables assist in capturing spatial differences that may not be fully represented by coarse weather datasets.)

* Elevation: influences temperature, RH, vegetation distribution
* Slope: affects fire spread rate
* Aspect: influences sun exposure (drying and moisture avaialability)
* Topographic Position Index: distinguishing ridges, slopes, valleys which influence exposure and moisture conditions
* Topographic Wetness Index: assists to identify areas where moisture may accumulate / where fuels may remain wetter for longer periods.

### Settlement and human-influence variables
(settlement-related variables help model represent potential ignition pressure and exposure)

* Built-up area: indicate presence and intensity of human settlement
* Settlement classification: distinguishing types of development (rural, peri-urban, urban)
* Wildland-Urban Interface/Intermix indicators: indicates areas where vegetation/fuels occure close to settlement (interface) and where vegetation is predominate within settlements (intermix) 
* Night-time lights: proxy for human activity and settlement intensity 

### Historical fire variables
(helps represent previous fire activity, landscape fire patterns and fuel effects)

* Active fire detections: fire/no-fire labels to train model
* Burned area history: shows previous fire occurence and fuel disturbance
* Previous fire occurrence patterns: time since last fire to help represent fuel recovery and fire history effects, number of previous burn to capture fire-prone areas
* Fire occurrence probability indicators: can be used to support fire occurence and FDI classification

## Modelling approach

The workflow supports model development using machine learning and statistical modelling approaches such as:

* Using Class-weighted random forest and logistic regression: classwt / class_weight (addressing imbalance of dataset, Improving sampling: 60% no fire and 40% fire to reduce bias towards the majority class (no fire) 
)

The model output may be represented as a continuous fire probability or Fire Occurrence Index, then into Fire Danger Index classes. 
## Example FDI class structure

The modelled fire probability may be grouped into five indicative classes, however thresholds can still be revised as model testing and validation continues:

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

Scripts, documentation, small figures, small tables, and approved sample data are stored here.

## Current status

This repository is in active development. Scripts, methods, thresholds, datasets, and outputs are eing edited and improved as the FDI workflow is being refined. 

## Author

Minenhle Ngubane



