-- Starter catalog of common low-to-mid-budget cars found on North Macedonian roads.
-- Values are representative combined figures for the named generation/engine, rounded for
-- ride-cost and CO2 estimates. The supplied co2.csv was used where it contained a close match;
-- older European-market models use representative manufacturer-cycle figures.

insert into public.car_models (
  make,
  model,
  fuel_type,
  consumption_l_100km,
  co2_emissions_g_km,
  release_year
)
values
  ('Volkswagen', 'Golf 4 1.9 TDI', 'diesel', 5.2, 139, 2000),
  ('Volkswagen', 'Golf 5 1.9 TDI', 'diesel', 5.3, 142, 2005),
  ('Volkswagen', 'Golf 6 2.0 TDI', 'diesel', 4.8, 129, 2010),
  ('Volkswagen', 'Golf 7 1.6 TDI', 'diesel', 4.1, 110, 2014),
  ('Volkswagen', 'Polo 1.4 TDI', 'diesel', 4.5, 121, 2007),
  ('Volkswagen', 'Passat B6 2.0 TDI', 'diesel', 5.8, 155, 2008),
  ('Volkswagen', 'Touran 1.9 TDI', 'diesel', 5.9, 158, 2007),

  ('Opel', 'Corsa C 1.2', 'petrol', 6.1, 141, 2003),
  ('Opel', 'Corsa D 1.3 CDTI', 'diesel', 4.5, 121, 2010),
  ('Opel', 'Astra G 1.6', 'petrol', 7.2, 166, 2002),
  ('Opel', 'Astra H 1.7 CDTI', 'diesel', 5.1, 137, 2008),
  ('Opel', 'Insignia 2.0 CDTI', 'diesel', 5.6, 150, 2012),
  ('Opel', 'Zafira B 1.9 CDTI', 'diesel', 6.1, 163, 2008),

  ('Renault', 'Clio II 1.2', 'petrol', 6.0, 139, 2004),
  ('Renault', 'Clio III 1.5 dCi', 'diesel', 4.5, 121, 2009),
  ('Renault', 'Megane II 1.5 dCi', 'diesel', 4.7, 126, 2007),
  ('Renault', 'Megane III 1.5 dCi', 'diesel', 4.2, 113, 2012),

  ('Toyota', 'Yaris 1.3', 'petrol', 5.4, 125, 2008),
  ('Toyota', 'Yaris Hybrid', 'hybrid', 3.7, 85, 2014),

  ('Skoda', 'Octavia II 1.9 TDI', 'diesel', 5.0, 134, 2008),
  ('Skoda', 'Fabia II 1.4 TDI', 'diesel', 4.6, 123, 2009),
  ('Skoda', 'Superb II 2.0 TDI', 'diesel', 5.5, 147, 2012),

  ('Fiat', 'Punto 1.2', 'petrol', 6.0, 139, 2005),
  ('Fiat', 'Grande Punto 1.3 MultiJet', 'diesel', 4.5, 121, 2009),
  ('Fiat', 'Panda 1.2', 'petrol', 5.2, 120, 2011),

  ('Hyundai', 'i30 1.6 CRDi', 'diesel', 4.5, 121, 2012),
  ('Hyundai', 'Getz 1.5 CRDi', 'diesel', 5.1, 137, 2007),

  ('Kia', 'Ceed 1.6 CRDi', 'diesel', 4.3, 115, 2012),
  ('Kia', 'Rio 1.4', 'petrol', 5.6, 129, 2013),

  ('Ford', 'Focus II 1.6 TDCi', 'diesel', 4.8, 129, 2008),
  ('Ford', 'Focus III 1.6 TDCi', 'diesel', 4.2, 113, 2013),
  ('Ford', 'Fiesta 1.4 TDCi', 'diesel', 4.2, 113, 2010),

  ('Honda', 'Civic 1.8', 'petrol', 7.0, 161, 2014),
  ('Honda', 'Jazz 1.4', 'petrol', 5.4, 125, 2012),

  ('Seat', 'Ibiza 1.4 TDI', 'diesel', 4.5, 121, 2009),
  ('Seat', 'Leon 1.9 TDI', 'diesel', 5.2, 139, 2008),

  ('Peugeot', '206 1.4 HDi', 'diesel', 4.3, 115, 2005),
  ('Peugeot', '207 1.6 HDi', 'diesel', 4.6, 123, 2009),
  ('Peugeot', '308 1.6 HDi', 'diesel', 4.5, 121, 2012),

  ('Citroen', 'C3 1.4 HDi', 'diesel', 4.4, 118, 2010),
  ('Citroen', 'C4 1.6 HDi', 'diesel', 4.5, 121, 2012),

  ('Dacia', 'Sandero 1.5 dCi', 'diesel', 4.8, 129, 2014),
  ('Dacia', 'Duster 1.5 dCi', 'diesel', 5.3, 142, 2014),

  ('Chevrolet', 'Aveo 1.2', 'petrol', 5.5, 127, 2011),
  ('Nissan', 'Micra 1.2', 'petrol', 5.0, 116, 2012),
  ('Nissan', 'Qashqai 1.5 dCi', 'diesel', 5.2, 139, 2012),
  ('Mazda', '3 1.6 Diesel', 'diesel', 4.7, 126, 2010),
  ('Mercedes-Benz', 'A-Class A180 CDI', 'diesel', 5.0, 134, 2011),
  ('BMW', '1 Series 116d', 'diesel', 4.5, 121, 2011),
  ('Suzuki', 'Swift 1.3', 'petrol', 5.5, 127, 2010)
on conflict (make, model, fuel_type) do update
set
  consumption_l_100km = excluded.consumption_l_100km,
  co2_emissions_g_km = excluded.co2_emissions_g_km,
  release_year = excluded.release_year;
