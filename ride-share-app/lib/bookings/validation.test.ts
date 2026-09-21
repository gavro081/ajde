import { describe, expect, it } from "vitest";

import { bookingRequestSchema, requestEligibility } from "./validation";

describe("booking validation", () => {
  it("normalizes a valid request", () => {
    const result = bookingRequestSchema.parse({
      rideId: "40000000-0000-4000-8000-000000000001",
      message: "  I have one bag.  ",
    });
    expect(result).toEqual({ rideId: "40000000-0000-4000-8000-000000000001", message: "I have one bag." });
  });

  it("ignores any submitted seat count and rejects invalid rides", () => {
    const result = bookingRequestSchema.parse({ rideId: "40000000-0000-4000-8000-000000000001", seats: "4", message: "" });
    expect(result).not.toHaveProperty("seats");
    expect(bookingRequestSchema.safeParse({ rideId: "bad", message: "" }).success).toBe(false);
  });

  it("blocks self-booking and insufficient capacity", () => {
    const common = { driverId: "user-1", departureAt: "2099-01-01T12:00:00Z", status: "published" };
    expect(requestEligibility({ ...common, passengerId: "user-1", requestedSeats: 1, availableSeats: 2 })).toContain("own ride");
    expect(requestEligibility({ ...common, passengerId: "user-2", requestedSeats: 1, availableSeats: 0 })).toContain("enough seats");
  });

  it("allows an eligible request", () => {
    expect(requestEligibility({ passengerId: "passenger", driverId: "driver", departureAt: "2099-01-01T12:00:00Z", status: "published", requestedSeats: 1, availableSeats: 1 })).toBeNull();
  });
});
