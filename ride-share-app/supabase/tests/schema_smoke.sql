-- Run with:
-- psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/schema_smoke.sql
-- Every fixture is rolled back.

begin;

do $$
declare
  demo_profile_count integer;
  demo_ride_count integer;
begin
  select count(*) into demo_profile_count
  from public.profiles
  where id::text like '20000000-0000-4000-8000-%';

  select count(*) into demo_ride_count
  from public.rides
  where details @> '{"demo_seed": true}'::jsonb;

  if demo_profile_count <> 25 or demo_ride_count <> 50 then
    raise exception 'Expected 25 demo profiles and 50 demo rides, got % and %',
      demo_profile_count, demo_ride_count;
  end if;
end;
$$;

do $$
declare
  photo_bucket storage.buckets%rowtype;
  photo_policy_count integer;
begin
  select * into photo_bucket
  from storage.buckets
  where id = 'profile-photos';

  if not found
    or not photo_bucket.public
    or photo_bucket.file_size_limit <> 5242880
    or photo_bucket.allowed_mime_types <> array['image/jpeg', 'image/png', 'image/webp'] then
    raise exception 'Profile photo bucket is missing or misconfigured';
  end if;

  select count(*) into photo_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'Profile photos are publicly readable',
      'Users upload their own profile photos',
      'Users update their own profile photos',
      'Users delete their own profile photos'
    );

  if photo_policy_count <> 4 then
    raise exception 'Expected 4 profile-photo policies, got %', photo_policy_count;
  end if;
end;
$$;

do $$
declare
  seeded_city_count integer;
  seeded_pickup_count integer;
  pickup_outside_skopje_count integer;
begin
  select count(*)
  into seeded_city_count
  from public.cities
  where name_mk in (
    'Скопје', 'Куманово', 'Битола', 'Прилеп', 'Тетово',
    'Штип', 'Велес', 'Охрид', 'Струмица', 'Гостивар'
  );

  select count(*)
  into seeded_pickup_count
  from public.pickup_points pp
  join public.cities c on c.id = pp.city_id
  where c.name_mk = 'Скопје'
    and pp.name_mk in (
      'Мавровка', 'Скопје Сити Мол', 'Порта Влае', 'Автокоманда',
      'Рамстор Мол', 'Транспортен центар', 'Ист Гејт Мол'
    );

  select count(*)
  into pickup_outside_skopje_count
  from public.pickup_points pp
  join public.cities c on c.id = pp.city_id
  where pp.name_mk in (
      'Мавровка', 'Скопје Сити Мол', 'Порта Влае', 'Автокоманда',
      'Рамстор Мол', 'Транспортен центар', 'Ист Гејт Мол'
    )
    and c.name_mk <> 'Скопје';

  if seeded_city_count <> 10 then
    raise exception 'Expected 10 seeded cities, got %', seeded_city_count;
  end if;

  if seeded_pickup_count <> 7 or pickup_outside_skopje_count <> 0 then
    raise exception 'Expected 7 Skopje-only pickup points, got % in Skopje and % elsewhere',
      seeded_pickup_count,
      pickup_outside_skopje_count;
  end if;

  if not exists (
    select 1
    from public.pickup_points pp
    join public.cities c on c.id = pp.city_id
    where c.name_mk = 'Скопје'
      and pp.name_mk = 'Транспортен центар'
      and 'главна станица' = any(pp.aliases)
  ) then
    raise exception 'Expected the tuned Transport Centre station alias';
  end if;
end;
$$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');

insert into public.profiles (id, full_name, photo_url, university) values
  ('00000000-0000-0000-0000-000000000001', 'Test Driver', 'https://example.com/driver.jpg', 'UKIM'),
  ('00000000-0000-0000-0000-000000000002', 'Test Rider One', 'https://example.com/rider-1.jpg', 'UKIM'),
  ('00000000-0000-0000-0000-000000000003', 'Test Rider Two', 'https://example.com/rider-2.jpg', 'UKIM');

insert into public.cities (id, name_mk, name_en, lat, lng) values
  (900001, 'Тест Град 1', 'Test City 1', 41.99, 21.43),
  (900002, 'Тест Град 2', 'Test City 2', 41.74, 22.19);

insert into public.car_models (
  make,
  model,
  engine_size_l,
  fuel_type,
  consumption_l_100km,
  co2_emissions_g_km,
  release_year
) values (
  'Test Make',
  'Test Model',
  1.6,
  'petrol',
  6.5,
  150.0,
  2024
);

do $$
declare
  actual_co2 numeric;
  actual_engine_size numeric;
  actual_release_year smallint;
begin
  select co2_emissions_g_km, engine_size_l, release_year
  into actual_co2, actual_engine_size, actual_release_year
  from public.car_models
  where make = 'Test Make' and model = 'Test Model';

  if actual_co2 <> 150.0 or actual_engine_size <> 1.6 or actual_release_year <> 2024 then
    raise exception 'Expected car-model emissions/engine/year 150.0/1.6/2024, got %/%/%',
      actual_co2, actual_engine_size, actual_release_year;
  end if;
end;
$$;

insert into public.rides (
  id,
  driver_id,
  origin_city_id,
  dest_city_id,
  departure_at,
  seats_total,
  seats_available,
  status
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  900001,
  900002,
  now() + interval '1 day',
  3,
  3,
  'published'
);

insert into public.bookings (ride_id, passenger_id, seats, status, decided_at)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  2,
  'accepted',
  now()
);

do $$
declare
  actual_available smallint;
begin
  select seats_available into actual_available
  from public.rides
  where id = '10000000-0000-0000-0000-000000000001';

  if actual_available <> 1 then
    raise exception 'Expected 1 available seat, got %', actual_available;
  end if;
end;
$$;

insert into public.bookings (ride_id, passenger_id, seats, status, decided_at)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  1,
  'accepted',
  now()
);

do $$
declare
  actual_available smallint;
  actual_status public.ride_status;
begin
  select seats_available, status into actual_available, actual_status
  from public.rides
  where id = '10000000-0000-0000-0000-000000000001';

  if actual_available <> 0 or actual_status <> 'full' then
    raise exception 'Expected a full ride with 0 seats, got % with % seats',
      actual_status, actual_available;
  end if;
end;
$$;

update public.bookings
set status = 'cancelled'
where passenger_id = '00000000-0000-0000-0000-000000000003';

do $$
declare
  actual_available smallint;
  actual_status public.ride_status;
begin
  select seats_available, status into actual_available, actual_status
  from public.rides
  where id = '10000000-0000-0000-0000-000000000001';

  if actual_available <> 1 or actual_status <> 'published' then
    raise exception 'Expected a published ride with 1 seat, got % with % seats',
      actual_status, actual_available;
  end if;
end;
$$;

\ir communication_reputation.sql

rollback;
