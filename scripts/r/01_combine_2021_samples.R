library(readr)
library(dplyr)
library(purrr)
library(stringr)

data_dir <- "C:/Users/Minenhle.Ngubane/Downloads/FDI_daily_samples/2021"

# List all files in the 2021 folder
all_files <- list.files(
  path = data_dir,
  full.names = TRUE
)

cat("All files found:", length(all_files), "\n")
print(basename(all_files))

# Select only monthly CSV files
files <- all_files[
  grepl("\\.csv$", basename(all_files), ignore.case = TRUE) &
    !grepl("combined|clean", basename(all_files), ignore.case = TRUE)
]

cat("\nMonthly CSV files selected:", length(files), "\n")
print(basename(files))

# Stop if not 12 monthly files
if (length(files) != 12) {
  stop("Expected 12 monthly CSV files. Check for missing months or duplicate files.")
}

# Combine monthly files
df_2021 <- files %>%
  map_dfr(read_csv, show_col_types = FALSE)

# Convert date column properly
df_2021 <- df_2021 %>%
  mutate(date_str = as.Date(date_str))

cat("\nRows:", nrow(df_2021), "\n")
cat("Columns:", ncol(df_2021), "\n")

cat("\nDate range:\n")
print(range(df_2021$date_str, na.rm = TRUE))

cat("\nUnique dates:\n")
print(length(unique(df_2021$date_str)))

cat("\nSample type counts:\n")
print(table(df_2021$sample_type))

cat("\nFire label counts:\n")
print(table(df_2021$fire_label))

cat("\nSample type by fire label:\n")
print(table(df_2021$sample_type, df_2021$fire_label, useNA = "ifany"))

cat("\nWeather summaries:\n")
print(summary(df_2021$temp_max_c))
print(summary(df_2021$wind_max_ms))
print(summary(df_2021$rh_min_pct))
print(summary(df_2021$vpd_max_kpa))
print(summary(df_2021$precip_mm))

# Clean tiny negative rainfall and invalid weather rows
df_2021_clean <- df_2021 %>%
  mutate(
    precip_mm = ifelse(precip_mm < 0, 0, precip_mm)
  ) %>%
  filter(
    temp_max_c > 0,
    wind_max_ms > 0,
    rh_min_pct > 0,
    vpd_max_kpa >= 0
  )

cat("\nOriginal rows:", nrow(df_2021), "\n")
cat("Clean rows:", nrow(df_2021_clean), "\n")
cat("Rows removed:", nrow(df_2021) - nrow(df_2021_clean), "\n")

cat("\nClean sample type by fire label:\n")
print(table(df_2021_clean$sample_type, df_2021_clean$fire_label, useNA = "ifany"))

# Create output folder so combined files do not sit with monthly files
out_dir <- file.path(data_dir, "combined_outputs")
dir.create(out_dir, showWarnings = FALSE)

write_csv(
  df_2021,
  file.path(out_dir, "INSpiRe_KZN_daily_samples_combined_2021.csv")
)

write_csv(
  df_2021_clean,
  file.path(out_dir, "INSpiRe_KZN_daily_samples_combined_2021_clean.csv")
)

cat("\nDone. Combined and cleaned 2021 files saved in combined_outputs folder.\n")

