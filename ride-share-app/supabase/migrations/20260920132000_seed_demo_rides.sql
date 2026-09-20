-- Repeatable Tier 1 demo data: 25 student profiles, one car each, and 50 future rides.
-- The synthetic Auth users cannot sign in; they only satisfy profile ownership foreign keys.

insert into auth.users (id)
select ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 25) as n
on conflict (id) do nothing;

with demo_students as (
  select
    n,
    ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id,
    (array[
      'Ana Petrova', 'Marko Stojanov', 'Elena Nikolova', 'Luka Trajkov', 'Sara Ilievska',
      'Filip Ristov', 'Mia Georgieva', 'David Kirov', 'Jana Spasovska', 'Stefan Angelov',
      'Eva Kostova', 'Nikola Naumov', 'Teodora Popova', 'Martin Velkov', 'Iva Simova',
      'Bojan Atanasov', 'Lena Miteva', 'Andrej Todorov', 'Nina Jakovska', 'Petar Krstev',
      'Marija Pavlova', 'Damjan Gjorgjiev', 'Klara Arsovska', 'Matej Zafirov', 'Sofija Koleva'
    ])[n] as full_name,
    (array['UKIM', 'FINKI', 'FEIT', 'UACS', 'University of Tourism and Management'])[1 + ((n - 1) % 5)] as university
  from generate_series(1, 25) as n
)
insert into public.profiles (id, full_name, photo_url, university, phone, instagram, gender, verified_at)
select
  id,
  full_name,
  'https://api.dicebear.com/9.x/initials/svg?seed=' || replace(full_name, ' ', '%20'),
  university,
  '+389 70 ' || lpad((100000 + n)::text, 6, '0'),
  '@student' || lpad(n::text, 2, '0'),
  case when n % 2 = 0 then 'man'::public.profile_gender else 'woman'::public.profile_gender end,
  now()
from demo_students
on conflict (id) do update set
  full_name = excluded.full_name,
  photo_url = excluded.photo_url,
  university = excluded.university,
  phone = excluded.phone,
  instagram = excluded.instagram,
  gender = excluded.gender,
  verified_at = excluded.verified_at;

with models as (
  select id, make, model, fuel_type, consumption_l_100km,
    row_number() over (order by id) as position
  from public.car_models
  order by id
  limit 25
)
insert into public.cars (
  id, owner_id, car_model_id, make, model, fuel_type,
  consumption_l_100km, color, plate_last3, seats_total
)
select
  ('30000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  models.id,
  models.make,
  models.model,
  models.fuel_type,
  models.consumption_l_100km,
  (array['white', 'silver', 'black', 'blue', 'red'])[1 + ((n - 1) % 5)],
  lpad((100 + n)::text, 3, '0'),
  4
from generate_series(1, 25) as n
join models on models.position = n
on conflict (id) do update set
  car_model_id = excluded.car_model_id,
  make = excluded.make,
  model = excluded.model,
  fuel_type = excluded.fuel_type,
  consumption_l_100km = excluded.consumption_l_100km,
  color = excluded.color,
  plate_last3 = excluded.plate_last3;

with city_catalog as (
  select array_agg(id order by id) as ids from public.cities
), demo_rides as (
  select
    n,
    ids[1 + ((n - 1) % array_length(ids, 1))] as origin_id,
    ids[1 + (n % array_length(ids, 1))] as destination_id
  from generate_series(1, 50) as n
  cross join city_catalog
)
insert into public.rides (
  id, driver_id, car_id, origin_city_id, dest_city_id, departure_at,
  seats_total, seats_available, price_per_seat_mkd, notes, details, tags,
  gender_preference, status, source
)
select
  ('40000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  ('20000000-0000-4000-8000-' || lpad((1 + ((n - 1) % 25))::text, 12, '0'))::uuid,
  ('30000000-0000-4000-8000-' || lpad((1 + ((n - 1) % 25))::text, 12, '0'))::uuid,
  origin_id,
  destination_id,
  current_date + (1 + (n % 14)) * interval '1 day' + (7 + (n % 12)) * interval '1 hour',
  1 + (n % 4),
  1 + (n % 4),
  250 + (n % 6) * 100,
  case when n % 3 = 0 then 'Small luggage is welcome. Please be on time.' else 'Message me with your pickup preference.' end,
  jsonb_build_object('demo_seed', true, 'distance_km', 45 + (n % 8) * 20),
  case when n % 2 = 0 then array['no_smoking']::text[] else array['luggage_space']::text[] end,
  case when n % 10 = 0 then 'same_as_driver'::public.ride_gender_preference else 'any'::public.ride_gender_preference end,
  'published',
  'native'
from demo_rides
on conflict (id) do update set
  departure_at = excluded.departure_at,
  seats_total = excluded.seats_total,
  seats_available = excluded.seats_available,
  price_per_seat_mkd = excluded.price_per_seat_mkd,
  notes = excluded.notes,
  details = excluded.details,
  tags = excluded.tags,
  gender_preference = excluded.gender_preference,
  status = excluded.status;
