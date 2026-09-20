alter table public.car_models
  add column engine_size_l numeric(3, 1),
  add constraint car_models_engine_size_l_check
    check (engine_size_l is null or engine_size_l > 0);

comment on column public.car_models.engine_size_l is
  'Engine displacement in litres; stored separately from the model name.';

with normalized (make, old_model, fuel_type, model, engine_size_l) as (
  values
    ('Volkswagen', 'Golf 4 1.9 TDI', 'diesel'::public.fuel_type, 'Golf 4', 1.9),
    ('Volkswagen', 'Golf 5 1.9 TDI', 'diesel'::public.fuel_type, 'Golf 5', 1.9),
    ('Volkswagen', 'Golf 6 2.0 TDI', 'diesel'::public.fuel_type, 'Golf 6', 2.0),
    ('Volkswagen', 'Golf 7 1.6 TDI', 'diesel'::public.fuel_type, 'Golf 7', 1.6),
    ('Volkswagen', 'Polo 1.4 TDI', 'diesel'::public.fuel_type, 'Polo', 1.4),
    ('Volkswagen', 'Passat B6 2.0 TDI', 'diesel'::public.fuel_type, 'Passat B6', 2.0),
    ('Volkswagen', 'Touran 1.9 TDI', 'diesel'::public.fuel_type, 'Touran', 1.9),

    ('Opel', 'Corsa C 1.2', 'petrol'::public.fuel_type, 'Corsa C', 1.2),
    ('Opel', 'Corsa D 1.3 CDTI', 'diesel'::public.fuel_type, 'Corsa D', 1.3),
    ('Opel', 'Astra G 1.6', 'petrol'::public.fuel_type, 'Astra G', 1.6),
    ('Opel', 'Astra H 1.7 CDTI', 'diesel'::public.fuel_type, 'Astra H', 1.7),
    ('Opel', 'Insignia 2.0 CDTI', 'diesel'::public.fuel_type, 'Insignia', 2.0),
    ('Opel', 'Zafira B 1.9 CDTI', 'diesel'::public.fuel_type, 'Zafira B', 1.9),

    ('Renault', 'Clio II 1.2', 'petrol'::public.fuel_type, 'Clio II', 1.2),
    ('Renault', 'Clio III 1.5 dCi', 'diesel'::public.fuel_type, 'Clio III', 1.5),
    ('Renault', 'Megane II 1.5 dCi', 'diesel'::public.fuel_type, 'Megane II', 1.5),
    ('Renault', 'Megane III 1.5 dCi', 'diesel'::public.fuel_type, 'Megane III', 1.5),

    ('Toyota', 'Yaris 1.3', 'petrol'::public.fuel_type, 'Yaris', 1.3),
    ('Toyota', 'Yaris Hybrid', 'hybrid'::public.fuel_type, 'Yaris Hybrid', 1.5),

    ('Skoda', 'Octavia II 1.9 TDI', 'diesel'::public.fuel_type, 'Octavia II', 1.9),
    ('Skoda', 'Fabia II 1.4 TDI', 'diesel'::public.fuel_type, 'Fabia II', 1.4),
    ('Skoda', 'Superb II 2.0 TDI', 'diesel'::public.fuel_type, 'Superb II', 2.0),

    ('Fiat', 'Punto 1.2', 'petrol'::public.fuel_type, 'Punto', 1.2),
    ('Fiat', 'Grande Punto 1.3 MultiJet', 'diesel'::public.fuel_type, 'Grande Punto', 1.3),
    ('Fiat', 'Panda 1.2', 'petrol'::public.fuel_type, 'Panda', 1.2),

    ('Hyundai', 'i30 1.6 CRDi', 'diesel'::public.fuel_type, 'i30', 1.6),
    ('Hyundai', 'Getz 1.5 CRDi', 'diesel'::public.fuel_type, 'Getz', 1.5),

    ('Kia', 'Ceed 1.6 CRDi', 'diesel'::public.fuel_type, 'Ceed', 1.6),
    ('Kia', 'Rio 1.4', 'petrol'::public.fuel_type, 'Rio', 1.4),

    ('Ford', 'Focus II 1.6 TDCi', 'diesel'::public.fuel_type, 'Focus II', 1.6),
    ('Ford', 'Focus III 1.6 TDCi', 'diesel'::public.fuel_type, 'Focus III', 1.6),
    ('Ford', 'Fiesta 1.4 TDCi', 'diesel'::public.fuel_type, 'Fiesta', 1.4),

    ('Honda', 'Civic 1.8', 'petrol'::public.fuel_type, 'Civic', 1.8),
    ('Honda', 'Jazz 1.4', 'petrol'::public.fuel_type, 'Jazz', 1.4),

    ('Seat', 'Ibiza 1.4 TDI', 'diesel'::public.fuel_type, 'Ibiza', 1.4),
    ('Seat', 'Leon 1.9 TDI', 'diesel'::public.fuel_type, 'Leon', 1.9),

    ('Peugeot', '206 1.4 HDi', 'diesel'::public.fuel_type, '206', 1.4),
    ('Peugeot', '207 1.6 HDi', 'diesel'::public.fuel_type, '207', 1.6),
    ('Peugeot', '308 1.6 HDi', 'diesel'::public.fuel_type, '308', 1.6),

    ('Citroen', 'C3 1.4 HDi', 'diesel'::public.fuel_type, 'C3', 1.4),
    ('Citroen', 'C4 1.6 HDi', 'diesel'::public.fuel_type, 'C4', 1.6),

    ('Dacia', 'Sandero 1.5 dCi', 'diesel'::public.fuel_type, 'Sandero', 1.5),
    ('Dacia', 'Duster 1.5 dCi', 'diesel'::public.fuel_type, 'Duster', 1.5),

    ('Chevrolet', 'Aveo 1.2', 'petrol'::public.fuel_type, 'Aveo', 1.2),
    ('Nissan', 'Micra 1.2', 'petrol'::public.fuel_type, 'Micra', 1.2),
    ('Nissan', 'Qashqai 1.5 dCi', 'diesel'::public.fuel_type, 'Qashqai', 1.5),
    ('Mazda', '3 1.6 Diesel', 'diesel'::public.fuel_type, '3', 1.6),
    ('Mercedes-Benz', 'A-Class A180 CDI', 'diesel'::public.fuel_type, 'A-Class A180', 2.0),
    ('BMW', '1 Series 116d', 'diesel'::public.fuel_type, '1 Series 116d', 2.0),
    ('Suzuki', 'Swift 1.3', 'petrol'::public.fuel_type, 'Swift', 1.3)
)
update public.car_models as car_model
set
  model = normalized.model,
  engine_size_l = normalized.engine_size_l
from normalized
where car_model.make = normalized.make
  and car_model.model = normalized.old_model
  and car_model.fuel_type = normalized.fuel_type;

do $$
begin
  if exists (select 1 from public.car_models where engine_size_l is null) then
    raise exception 'Every car model must have an engine size before engine_size_l becomes required';
  end if;
end;
$$;

alter table public.car_models
  alter column engine_size_l set not null;
