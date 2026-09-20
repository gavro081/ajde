alter table public.car_models
  add column co2_emissions_g_km numeric(6, 1),
  add column release_year smallint,
  add constraint car_models_co2_emissions_g_km_check
    check (co2_emissions_g_km is null or co2_emissions_g_km >= 0),
  add constraint car_models_release_year_check
    check (release_year is null or release_year between 1886 and 2100);

comment on column public.car_models.co2_emissions_g_km is
  'Official combined tailpipe CO2 emissions in grams per kilometre; zero is valid for battery-electric vehicles.';

comment on column public.car_models.release_year is
  'Four-digit model release year. Null means the catalog record is not tied to a known year.';
