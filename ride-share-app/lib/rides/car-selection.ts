import { z } from "zod";
import { RIDE_LIMITS } from "./ride-limits";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().max(RIDE_LIMITS.colorLength, "Color must be 40 characters or fewer").nullable(),
);

const optionalPlate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null),
  z
    .string()
    .regex(/^[A-Za-z0-9]{3}$/, "Use the final 3 letters or numbers from the plate")
    .nullable(),
);

const consumption = z.coerce.number().min(RIDE_LIMITS.consumptionL100Km.min, "Consumption must be at least 0.5 L/100 km").max(RIDE_LIMITS.consumptionL100Km.max, "Consumption must be no more than 30 L/100 km");
const seatCount = z.coerce.number().int().min(RIDE_LIMITS.seats.min).max(RIDE_LIMITS.seats.max);

export const carSelectionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("existing"),
    carId: z.uuid(),
  }),
  z.object({
    mode: z.literal("catalog"),
    carModelId: z.coerce.number().int().positive(),
    consumptionL100Km: consumption,
    color: optionalText,
    plateLast3: optionalPlate,
    seatsTotal: seatCount,
  }),
  z.object({
    mode: z.literal("manual"),
    make: z.string().trim().min(1).max(RIDE_LIMITS.makeLength),
    model: z.string().trim().min(1).max(RIDE_LIMITS.modelLength),
    fuelType: z.enum(["petrol", "diesel", "hybrid", "electric", "lpg", "other"]),
    consumptionL100Km: consumption,
    color: optionalText,
    plateLast3: optionalPlate,
    seatsTotal: seatCount,
  }),
]);

export type CarSelection = z.infer<typeof carSelectionSchema>;

export function readCarSelection(formData: FormData) {
  const mode = formData.get("carMode");

  if (mode === "existing") {
    return carSelectionSchema.safeParse({ mode, carId: formData.get("carId") });
  }

  const shared = {
    mode,
    consumptionL100Km: formData.get("consumptionL100Km"),
    color: formData.get("carColor"),
    plateLast3: formData.get("plateLast3"),
    seatsTotal: formData.get("carSeatsTotal"),
  };

  if (mode === "catalog") {
    return carSelectionSchema.safeParse({
      ...shared,
      carModelId: formData.get("carModelId"),
    });
  }

  return carSelectionSchema.safeParse({
    ...shared,
    mode,
    make: formData.get("carMake"),
    model: formData.get("carModel"),
    fuelType: formData.get("fuelType"),
  });
}
