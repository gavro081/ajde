update public.pickup_points
set aliases = array(
  select distinct alias
  from unnest(aliases || array['главна станица', 'glavna stanica', 'main station']) as alias
)
where name_mk = 'Транспортен центар'
  and city_id = (
    select id
    from public.cities
    where name_mk = 'Скопје'
  );

