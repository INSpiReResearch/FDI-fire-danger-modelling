# =============================================================================
# Combine yearly GEE daily sample CSVs
# Fire Danger Index modelling workflow
#
# Purpose:
#   Combines 12 monthly Google Earth Engine CSV exports into one yearly dataset,
#   performs basic checks, removes invalid weather rows, and saves combined and
#   cleaned yearly outputs.
#
# Note:
#   Large CSV files should not be committed to GitHub.
# =============================================================================

library(readr) 
library(dplyr)
library(purrr)
library(stringr)

# ---- User settings ----

year_to_process <- 2021

base_dir <- "C:/Users/Minenhle.Ngubane/Downloads/FDI_daily_samples"

data_dir <- file.path(base_dir, year_to_process)

# ---- List files ----

all_files <- list.files(
  path = data_dir,
  full.names = TRUE
)

cat("All files found:", length(all_files), "\n")
print(basename(all_files))

# Select only monthly CSV files.
# Excludes combined/clean outputs so they are not accidentally re-read.
files <- all_files[
  grepl("\\.csv$", basename(all_files), ignore.case = TRUE) &
    !grepl("combined|clean", basename(all_files), ignore.case = TRUE)
]

cat("\nMonthly CSV files selected:", length(files), "\n")
print(basename(files))

# Stop if not 12 monthly files.
if (length(files) != 12) {
  stop("Expected 12 monthly CSV files. Check for missing months or duplicate files.")
}

# ---- Combine monthly files ----

df_year <- files %>%
  map_dfr(read_csv, show_col_types = FALSE)

# Convert date column properly.
df_year <- df_year %>%
  mutate(date_str = as.Date(date_str))

# ---- Basic checks ----

cat("\nRows:", nrow(df_year), "\n")
cat("Columns:", ncol(df_year), "\n")

cat("\nDate range:\n")
print(range(df_year$date_str, na.rm = TRUE))

cat("\nUnique dates:\n")
print(length(unique(df_year$date_str)))

cat("\nSample type counts:\n")
print(table(df_year$sample_type))

cat("\nFire label counts:\n")
print(table(df_year$fire_label))

cat("\nSample type by fire label:\n")
print(table(df_year$sample_type, df_year$fire_label, useNA = "ifany"))

cat("\nWeather summaries:\n")
print(summary(df_year$temp_max_c))
print(summary(df_year$wind_max_ms))
print(summary(df_year$rh_min_pct))
print(summary(df_year$vpd_max_kpa))
print(summary(df_year$precip_mm))

# ---- Clean data ----
# Fix tiny negative rainfall values caused by floating-point precision.
# Remove invalid weather rows.

df_year_clean <- df_year %>%
  mutate(
    precip_mm = ifelse(precip_mm < 0, 0, precip_mm)
  ) %>%
  filter(
    temp_max_c > 0,
    wind_max_ms > 0,
    rh_min_pct > 0,
    vpd_max_kpa >= 0
  )

cat("\nOriginal rows:", nrow(df_year), "\n")
cat("Clean rows:", nrow(df_year_clean), "\n")
cat("Rows removed:", nrow(df_year) - nrow(df_year_clean), "\n")

cat("\nClean sample type by fire label:\n")
print(table(df_year_clean$sample_type, df_year_clean$fire_label, useNA = "ifany"))

# ---- Save outputs ----
# Outputs are saved in a combined_outputs folder so they do not sit with monthly files.

out_dir <- file.path(data_dir, "combined_outputs")
dir.create(out_dir, showWarnings = FALSE)

write_csv(
  df_year,
  file.path(out_dir, paste0("INSpiRe_KZN_daily_samples_combined_", year_to_process, ".csv"))
)

write_csv(
  df_year_clean,
  file.path(out_dir, paste0("INSpiRe_KZN_daily_samples_combined_", year_to_process, "_clean.csv"))
)

cat("\nDone. Combined and cleaned", year_to_process, "files saved in combined_outputs folder.\n")
