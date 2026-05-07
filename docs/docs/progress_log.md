# Progress Log

## 2020

Status: Extracted and combined.

Checks completed:

- Monthly Google Earth Engine CSV exports completed for January to December 2020.
- Monthly files combined in R.
- Date range confirmed: 2020-01-01 to 2020-12-31.
- Unique dates confirmed: 366.
- Fire/no-fire label structure confirmed:
  - `sample_type = fire` corresponds to `fire_label = 1`.
  - `sample_type = no_fire` corresponds to `fire_label = 0`.
- Cleaned yearly file generated.

## 2021

Status: Extracted and combined.

Checks completed:

- Monthly Google Earth Engine CSV exports completed for January to December 2021.
- Monthly files combined in R.
- Date range confirmed: 2021-01-01 to 2021-12-31.
- Unique dates confirmed: 365.
- Fire/no-fire label structure confirmed.

## Next steps

- Complete yearly combination for 2022.
- Complete yearly combination for 2023.
- Complete yearly combination for 2024.
- Combine all cleaned yearly files into one master training dataset.
- Conduct exploratory data analysis.
- Train baseline Logistic Regression and Random Forest models.
- Evaluate model performance using ROC-AUC, PR-AUC and confusion matrices.
- Convert fire occurrence probability into Fire Occurrence Index and Fire Danger Index classes.
