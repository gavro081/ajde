import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().nullable(),
);

const optionalPlate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null),
  z
    .string()
    .regex(/^[\p{L}\p{N}]{3}$/u, "Use the final 3 letters or numbers from the plate")
    .nullable(),
);

const positiveNumber = z.coerce.number().positive();
const seatCount = z.coerce.number().int().min(1).max(8);

export const carSelectionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("existing"),
    carId: z.uuid(),
  }),
  z.object({
    mode: z.literal("catalog"),
    carModelId: z.coerce.number().int().positive(),
    consumptionL100Km: positiveNumber,
    color: optionalText,
    plateLast3: optionalPlate,
    seatsTotal: seatCount,
  }),
  z.object({
    mode: z.literal("manual"),
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(120),
    fuelType: z.enum(["petrol", "diesel", "hybrid", "electric", "lpg", "other"]),
    consumptionL100Km: positiveNumber,
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
