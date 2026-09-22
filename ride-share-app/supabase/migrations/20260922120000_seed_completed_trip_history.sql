-- Repeatable seeded trip history: 35 more student profiles and 72 completed, past rides between
-- Skopje and the home cities, with accepted bookings. Unlike the future demo feed rides these are
-- NOT flagged `demo_seed`, so they count toward the homepage statistics; they are marked
-- `details.seeded_history` instead so they stay identifiable.

insert into auth.users (id)
select ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(26, 60) as n
on conflict (id) do nothing;

with first_names as (
  select array[
    'Aleksandar', 'Ivana', 'Kristijan', 'Simona', 'Viktor', 'Angela', 'Goran', 'Tamara', 'Dejan',
    'Katerina', 'Hristijan', 'Biljana', 'Ognen', 'Natasha', 'Blagoj', 'Frosina', 'Zoran'
  ] as names
), last_names as (
  select array[
    'Mitrevski', 'Dimova', 'Jovanovski', 'Stefanovska', 'Petkovski', 'Ristovska', 'Iliev', 'Trajkovska',
    'Nedelkovski', 'Andonova', 'Sokolov', 'Blazevska', 'Janev'
  ] as names
), history_students as (
  select
    n,
    ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    first_names.names[1 + ((n - 26) % 17)] || ' ' || last_names.names[1 + ((n - 26) % 13)] as full_name,
    (array['UKIM', 'FINKI', 'FEIT', 'UACS', 'University of Tourism and Management'])[1 + ((n - 1) % 5)] as university
  from generate_series(26, 60) as n
  cross join first_names
  cross join last_names
)
insert into public.profiles (id, full_name, photo_url, university, phone, instagram, gender, verified_at)
select
  id,
  full_name,
  'https://api.dicebear.com/9.x/initials/svg?seed=' || replace(full_name, ' ', '%20'),
  university,
  '+389 70 ' || lpad((100000 + n)::text, 6, '0'),
  '@student' || lpad(n::text, 2, '0'),
  case when full_name ~ '^(Ivana|Simona|Angela|Tamara|Katerina|Biljana|Natasha|Frosina) '
    then 'woman'::public.profile_gender else 'man'::public.profile_gender end,
  now()
from history_students
on conflict (id) do update set
  full_name = excluded.full_name,
  photo_url = excluded.photo_url,
  university = excluded.university,
  phone = excluded.phone,
  instagram = excluded.instagram,
  gender = excluded.gender,
  verified_at = excluded.verified_at;

-- Drivers are the original 25 demo students, skipping #19 whose car is a hybrid (no CO₂ estimate).
with drivers as (
  select array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25] as ids
), home_cities as (
  -- Approximate road distance from Skopje, in km, keyed by city id.
  select array[2, 3, 4, 5, 6, 7, 8, 9, 10] as ids,
         array[38, 170, 128, 45, 88, 55, 172, 150, 70] as km
), history_rides as (
  select
    n,
    drivers.ids[1 + ((n - 1) % 24)] as driver_n,
    home_cities.ids[1 + ((n - 1) % 9)] as home_id,
    home_cities.km[1 + ((n - 1) % 9)] as distance_km,
    -- Heading home on even rides, back to Skopje on odd ones.
    n % 2 = 0 as outbound
  from generate_series(1, 72) as n
  cross join drivers
  cross join home_cities
)
insert into public.rides (
  id, driver_id, car_id, origin_city_id, dest_city_id, departure_at,
  seats_total, seats_available, price_per_seat_mkd, notes, details, tags,
  gender_preference, status, source
)
select
  ('41000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(driver_n::text, 12, '0'))::uuid,
  ('30000000-0000-4000-8000-' || lpad(driver_n::text, 12, '0'))::uuid,
  case when outbound then 1 else home_id end,
  case when outbound then home_id else 1 end,
  timestamptz '2026-07-10 15:00:00+02' + (n - 1) * interval '1 day' - (n % 3) * interval '2 hours',
  4,
  4,
  greatest(100, round(distance_km * 2.5 / 50) * 50)::integer,
  'Message me with your pickup preference.',
  jsonb_build_object('seeded_history', true, 'distance_km', distance_km),
  array['luggage_space']::text[],
  'any'::public.ride_gender_preference,
  'completed',
  'native'
from history_rides
on conflict (id) do update set
  driver_id = excluded.driver_id,
  car_id = excluded.car_id,
  origin_city_id = excluded.origin_city_id,
  dest_city_id = excluded.dest_city_id,
  departure_at = excluded.departure_at,
  price_per_seat_mkd = excluded.price_per_seat_mkd,
  details = excluded.details,
  status = excluded.status;

-- One to three accepted passengers per ride, drawn from the 35 new students (never the driver).
-- A lone or paired first passenger sometimes books two seats; totals never exceed the 4 seats.
insert into public.bookings (id, ride_id, passenger_id, seats, status, decided_at, created_at)
select
  ('42000000-0000-4000-8000-' || lpad((n * 10 + j)::text, 12, '0'))::uuid,
  ('41000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad((26 + ((n * 3 + j * 11) % 35))::text, 12, '0'))::uuid,
  case when j = 0 and n % 3 <> 2 and n % 4 = 0 then 2 else 1 end,
  'accepted',
  timestamptz '2026-07-08 12:00:00+02' + (n - 1) * interval '1 day',
  timestamptz '2026-07-08 10:00:00+02' + (n - 1) * interval '1 day'
from generate_series(1, 72) as n
cross join lateral generate_series(0, n % 3) as j
on conflict (id) do update set
  seats = excluded.seats,
  status = excluded.status,
  decided_at = excluded.decided_at;
