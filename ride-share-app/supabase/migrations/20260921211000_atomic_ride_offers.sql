-- Deduplicate retries even when two requests reach different app instances.
create unique index rides_driver_submission_unique
  on public.rides (driver_id, (details ->> 'submission_id'))
  where details ->> 'submission_id' is not null;

create function public.create_ride_offer(p_offer jsonb, p_vehicle jsonb, p_submission_id uuid, p_publish boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved public.rides%rowtype;
  car public.cars%rowtype;
  catalog_model public.car_models%rowtype;
  candidate public.cars%rowtype;
  offered_seats integer := (p_offer ->> 'seatsTotal')::integer;
  price integer := (p_offer ->> 'pricePerSeatMkd')::integer;
  departure timestamptz := (p_offer ->> 'departureAt')::timestamptz;
  distance numeric := (p_offer ->> 'distanceKm')::numeric;
begin
  if actor is null or p_submission_id is null then raise exception 'Authentication and submission identity required' using errcode = '42501'; end if;
  -- Serializes this driver's ride/car creation together, including different draft tabs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ride-offer:' || actor::text, 0));
  select * into saved from public.rides where driver_id = actor and details ->> 'submission_id' = p_submission_id::text;
  if found then return jsonb_build_object('rideId', saved.id, 'carId', saved.car_id, 'status', saved.status); end if;

  if offered_seats is null or offered_seats not between 1 and 8 or price is null or price < 0
     or departure is null or not isfinite(departure) or departure <= clock_timestamp()
     or (distance is not null and (distance <= 0 or distance in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)))
     or coalesce(length(p_offer ->> 'notes'), 0) > 2000
     or p_offer ->> 'source' is null or p_offer ->> 'source' not in ('native', 'imported')
     or p_offer ->> 'genderPreference' is null or p_offer ->> 'genderPreference' not in ('any', 'same_as_driver') then
    raise exception 'Review required ride fields and departure time' using errcode = '23514';
  end if;
  if p_offer ->> 'source' = 'native' and p_offer ->> 'importId' is not null then raise exception 'Native rides cannot reference imports' using errcode = '23514'; end if;
  if p_offer ->> 'source' = 'imported' and not exists (
    select 1 from public.imports where id = (p_offer ->> 'importId')::uuid and created_by = actor
  ) then raise exception 'Import does not belong to this driver' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements_text(p_offer -> 'tags') as tag(value)
    where value not in ('flexible_pickup','luggage_space','music','no_smoking','pets_allowed','quiet_ride')) then
    raise exception 'Unsupported ride tag' using errcode = '23514';
  end if;

  if p_vehicle ->> 'mode' = 'existing' then
    select * into car from public.cars where id = (p_vehicle ->> 'carId')::uuid and owner_id = actor;
    if not found then raise exception 'Choose one of your saved cars' using errcode = '42501'; end if;
  elsif p_vehicle ->> 'mode' in ('catalog', 'manual') then
    candidate.owner_id := actor;
    if p_vehicle ->> 'mode' = 'catalog' then
      select * into catalog_model from public.car_models where id = (p_vehicle ->> 'carModelId')::bigint;
      if not found then raise exception 'Car model is unavailable' using errcode = '23503'; end if;
      candidate.car_model_id := catalog_model.id; candidate.make := catalog_model.make; candidate.model := catalog_model.model; candidate.fuel_type := catalog_model.fuel_type;
    else
      candidate.make := trim(p_vehicle ->> 'make'); candidate.model := trim(p_vehicle ->> 'model');
      candidate.fuel_type := (p_vehicle ->> 'fuelType')::public.fuel_type;
    end if;
    candidate.consumption_l_100km := (p_vehicle ->> 'consumptionL100Km')::numeric;
    candidate.seats_total := (p_vehicle ->> 'seatsTotal')::smallint;
    candidate.color := nullif(trim(p_vehicle ->> 'color'), '');
    candidate.plate_last3 := upper(nullif(trim(p_vehicle ->> 'plateLast3'), ''));
    if candidate.make is null or length(candidate.make) not between 1 and 80
      or candidate.model is null or length(candidate.model) not between 1 and 120
      or candidate.fuel_type is null or candidate.consumption_l_100km is null or candidate.consumption_l_100km <= 0
      or candidate.consumption_l_100km in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      or candidate.seats_total is null or candidate.seats_total not between 1 and 8 then
      raise exception 'Complete the vehicle details' using errcode = '23514';
    end if;
    select * into car from public.cars where owner_id = actor
      and car_model_id is not distinct from candidate.car_model_id
      and make = candidate.make and model = candidate.model and fuel_type = candidate.fuel_type
      and consumption_l_100km = candidate.consumption_l_100km and seats_total = candidate.seats_total
      and color is not distinct from candidate.color and plate_last3 is not distinct from candidate.plate_last3
      order by created_at, id limit 1;
    if not found then
      insert into public.cars (owner_id, car_model_id, make, model, fuel_type, consumption_l_100km, seats_total, color, plate_last3)
      values (actor, candidate.car_model_id, candidate.make, candidate.model, candidate.fuel_type,
        candidate.consumption_l_100km, candidate.seats_total, candidate.color, candidate.plate_last3) returning * into car;
    end if;
  else raise exception 'Choose a vehicle' using errcode = '23514'; end if;
  if offered_seats > car.seats_total then raise exception 'The ride offers more seats than the car has' using errcode = '23514'; end if;

  insert into public.rides (driver_id, car_id, origin_city_id, origin_pickup_id, dest_city_id, dest_pickup_id,
    departure_at, seats_total, seats_available, price_per_seat_mkd, notes, details, tags, gender_preference, status, source, import_id)
  values (actor, car.id, (p_offer #>> '{origin,cityId}')::bigint, (p_offer #>> '{origin,pickupPointId}')::bigint,
    (p_offer #>> '{destination,cityId}')::bigint, (p_offer #>> '{destination,pickupPointId}')::bigint,
    departure, offered_seats, offered_seats, price, p_offer ->> 'notes',
    jsonb_build_object('distance_km', distance, 'submission_id', p_submission_id),
    array(select jsonb_array_elements_text(p_offer -> 'tags')), (p_offer ->> 'genderPreference')::public.ride_gender_preference,
    case when p_publish then 'published'::public.ride_status else 'draft'::public.ride_status end,
    (p_offer ->> 'source')::public.ride_source, (p_offer ->> 'importId')::uuid) returning * into saved;
  return jsonb_build_object('rideId', saved.id, 'carId', car.id, 'status', saved.status);
end;
$$;
revoke all on function public.create_ride_offer(jsonb, jsonb, uuid, boolean) from public, anon;
grant execute on function public.create_ride_offer(jsonb, jsonb, uuid, boolean) to authenticated;
