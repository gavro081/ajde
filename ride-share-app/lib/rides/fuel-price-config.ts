import "server-only";

export type FuelPriceConfig = {
  petrol: number | null;
  diesel: number | null;
};

function positivePrice(value: string | undefined) {
  if (!value?.trim()) return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function fuelPriceConfig(): FuelPriceConfig {
  return {
    petrol: positivePrice(process.env.FUEL_PRICE_PETROL_MKD_L),
    diesel: positivePrice(process.env.FUEL_PRICE_DIESEL_MKD_L),
  };
}
