// Mirrors supabase/migrations/20260920123000_seed_cities_and_skopje_pickup_points.sql
// (plus the transport-centre aliases), so the model sees the same vocabulary as production.

export const CITY = {
  skopje: 1, kumanovo: 2, bitola: 3, prilep: 4, tetovo: 5,
  shtip: 6, veles: 7, ohrid: 8, strumica: 9, gostivar: 10,
} as const;

export const cities = [
  { id: 1, name_mk: "Скопје", name_en: "Skopje", aliases: ["скопје", "skopje", "skoplje", "shkup"] },
  { id: 2, name_mk: "Куманово", name_en: "Kumanovo", aliases: ["куманово", "kumanovo"] },
  { id: 3, name_mk: "Битола", name_en: "Bitola", aliases: ["битола", "bitola", "monastir"] },
  { id: 4, name_mk: "Прилеп", name_en: "Prilep", aliases: ["прилеп", "prilep"] },
  { id: 5, name_mk: "Тетово", name_en: "Tetovo", aliases: ["тетово", "tetovo", "tetovë", "tetova"] },
  { id: 6, name_mk: "Штип", name_en: "Shtip", aliases: ["штип", "shtip", "stip", "štip"] },
  { id: 7, name_mk: "Велес", name_en: "Veles", aliases: ["велес", "veles"] },
  { id: 8, name_mk: "Охрид", name_en: "Ohrid", aliases: ["охрид", "ohrid", "ohër", "oher"] },
  { id: 9, name_mk: "Струмица", name_en: "Strumica", aliases: ["струмица", "strumica"] },
  { id: 10, name_mk: "Гостивар", name_en: "Gostivar", aliases: ["гостивар", "gostivar"] },
];

export const pickupPoints = [
  { id: 101, city_id: 1, name_mk: "Мавровка", name_en: "Mavrovka", aliases: ["мавровка", "mavrovka", "mavrovka mall", "тц мавровка", "кај мавровка"] },
  { id: 102, city_id: 1, name_mk: "Скопје Сити Мол", name_en: "Skopje City Mall", aliases: ["сити мол", "city mall", "skopje city mall", "скопје сити мол", "кај сити мол"] },
  { id: 103, city_id: 1, name_mk: "Порта Влае", name_en: "Porta Vlae", aliases: ["порта влае", "porta vlae", "влае", "vlae"] },
  { id: 104, city_id: 1, name_mk: "Автокоманда", name_en: "Avtokomanda", aliases: ["автокоманда", "avtokomanda", "на автокоманда"] },
  { id: 105, city_id: 1, name_mk: "Рамстор Мол", name_en: "Ramstore Mall", aliases: ["рамстор", "ramstore", "ramstore mall", "од рамстор", "кај рамстор"] },
  { id: 106, city_id: 1, name_mk: "Транспортен центар", name_en: "Transport Centre", aliases: ["транспортен центар", "transporten centar", "автобуска", "avtobuska", "железничка", "zeleznicka", "bus station", "railway station", "главна станица", "glavna stanica", "main station"] },
  { id: 107, city_id: 1, name_mk: "Ист Гејт Мол", name_en: "East Gate Mall", aliases: ["ист гејт", "east gate", "east gate mall", "ист гејт мол"] },
];

/** Shape used by the Facebook/Viber post importer. */
export const parserCities = cities.map((city) => ({ id: city.id, nameMk: city.name_mk, nameEn: city.name_en, aliases: city.aliases }));
export const parserPickupPoints = pickupPoints.map((point) => ({
  id: point.id, cityId: point.city_id, nameMk: point.name_mk, nameEn: point.name_en, aliases: point.aliases,
}));

/** Shape used by the ride-feed search. */
export const searchCandidates = [
  ...parserCities.map((city) => ({ kind: "city" as const, cityId: null, ...city })),
  ...parserPickupPoints.map(({ cityId, ...point }) => ({ kind: "pickup_point" as const, cityId, ...point })),
];
