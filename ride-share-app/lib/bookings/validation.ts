import { z } from "zod";

export const bookingRequestSchema = z.object({
  rideId: z.string().uuid(),
  seats: z.coerce.number().int().min(1).max(8),
  message: z.string().trim().max(1000).transform((value) => value || null),
});

export const bookingDecisionSchema = z.object({
  bookingId: z.string().uuid(),
  decision: z.enum(["accepted", "declined"]),
});

export const bookingCancelSchema = z.object({ bookingId: z.string().uuid() });

export function requestEligibility(input: {
  passengerId: string;
  driverId: string | null;
  departureAt: string;
  status: string;
  requestedSeats: number;
  availableSeats: number;
}) {
  if (!input.driverId) return "This imported ride needs a driver before it can accept bookings.";
  if (input.passengerId === input.driverId) return "You cannot request a seat on your own ride.";
  if (new Date(input.departureAt) <= new Date()) return "This ride has already departed.";
  if (input.status !== "published") return "This ride is not accepting seat requests.";
  if (input.requestedSeats > input.availableSeats) return "There are not enough seats available.";
  return null;
}
