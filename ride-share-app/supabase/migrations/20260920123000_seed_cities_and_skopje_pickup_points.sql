insert into public.cities (name_mk, name_en, aliases, lat, lng) values
  ('Скопје', 'Skopje', array['скопје', 'skopje', 'skoplje', 'shkup'], 41.99646, 21.43141),
  ('Куманово', 'Kumanovo', array['куманово', 'kumanovo'], 42.13279, 21.71585),
  ('Битола', 'Bitola', array['битола', 'bitola', 'monastir'], 41.03226, 21.33553),
  ('Прилеп', 'Prilep', array['прилеп', 'prilep'], 41.34558, 21.55370),
  ('Тетово', 'Tetovo', array['тетово', 'tetovo', 'tetovë', 'tetova'], 42.00989, 20.97138),
  ('Штип', 'Shtip', array['штип', 'shtip', 'stip', 'štip'], 41.74583, 22.19583),
  ('Велес', 'Veles', array['велес', 'veles'], 41.71719, 21.77196),
  ('Охрид', 'Ohrid', array['охрид', 'ohrid', 'ohër', 'oher'], 41.11701, 20.80175),
  ('Струмица', 'Strumica', array['струмица', 'strumica'], 41.43763, 22.64288),
  ('Гостивар', 'Gostivar', array['гостивар', 'gostivar'], 41.79627, 20.90799)
on conflict (name_mk) do update set
  name_en = excluded.name_en,
  aliases = excluded.aliases,
  lat = excluded.lat,
  lng = excluded.lng;

with skopje as (
  select id
  from public.cities
  where name_mk = 'Скопје'
), points (name_mk, name_en, aliases, lat, lng) as (
  values
    (
      'Мавровка',
      'Mavrovka',
      array['мавровка', 'mavrovka', 'mavrovka mall', 'тц мавровка', 'кај мавровка'],
      42.00110,
      21.43850
    ),
    (
      'Скопје Сити Мол',
      'Skopje City Mall',
      array['сити мол', 'city mall', 'skopje city mall', 'скопје сити мол', 'кај сити мол'],
      42.00460,
      21.39160
    ),
    (
      'Порта Влае',
      'Porta Vlae',
      array['порта влае', 'porta vlae', 'влае', 'vlae'],
      42.00660,
      21.37470
    ),
    (
      'Автокоманда',
      'Avtokomanda',
      array['автокоманда', 'avtokomanda', 'на автокоманда'],
      42.00270,
      21.46620
    ),
    (
      'Рамстор Мол',
      'Ramstore Mall',
      array['рамстор', 'ramstore', 'ramstore mall', 'од рамстор', 'кај рамстор'],
      41.99250,
      21.42670
    ),
    (
      'Транспортен центар',
      'Transport Centre',
      array[
        'транспортен центар',
        'transporten centar',
        'автобуска',
        'avtobuska',
        'железничка',
        'zeleznicka',
        'bus station',
        'railway station'
      ],
      41.99080,
      21.44560
    ),
    (
      'Ист Гејт Мол',
      'East Gate Mall',
      array['ист гејт', 'east gate', 'east gate mall', 'ист гејт мол'],
      42.00060,
      21.46660
    )
)
insert into public.pickup_points (city_id, name_mk, name_en, aliases, lat, lng)
select skopje.id, points.name_mk, points.name_en, points.aliases, points.lat, points.lng
from skopje
cross join points
on conflict (city_id, name_mk) do update set
  name_en = excluded.name_en,
  aliases = excluded.aliases,
  lat = excluded.lat,
  lng = excluded.lng;
