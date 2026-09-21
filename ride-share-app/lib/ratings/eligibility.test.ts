import { describe, expect, it } from "vitest";

import { ratingEligibility } from "./eligibility";

const ride = { id: "ride", driver_id: "driver", status: "completed" as const };
const bookings = [{ ride_id: "ride", passenger_id: "passenger", status: "accepted" as const, seats: 2 }];

describe("ratingEligibility", () => {
  it("allows an accepted passenger to rate the completed ride's driver", () => {
    expect(ratingEligibility({ currentUserId: "passenger", ride, bookings, targetUserId: "driver", existingRatings: [] })).toBe("eligible");
  });

  it("allows the driver to rate each accepted passenger once, regardless of seats", () => {
    expect(ratingEligibility({ currentUserId: "driver", ride, bookings, targetUserId: "passenger", existingRatings: [] })).toBe("eligible");
    expect(ratingEligibility({ currentUserId: "driver", ride, bookings, targetUserId: "passenger", existingRatings: [{ ride_id: "ride", rater_id: "driver", ratee_id: "passenger" }] })).toBe("already_rated");
  });

  for (const currentUserId of ["driver", "passenger", "unrelated", null]) {
    for (const status of ["draft", "published", "full", "completed", "cancelled"] as const) {
      for (const bookingStatus of ["requested", "accepted", "declined", "cancelled"] as const) {
        it(`${currentUserId} with ${bookingStatus} booking on ${status} ride`, () => {
          const targetUserId = currentUserId === "driver" ? "passenger" : "driver";
          const eligible = (currentUserId === "driver" || currentUserId === "passenger") && status === "completed" && bookingStatus === "accepted";
          expect(ratingEligibility({ currentUserId, ride: { ...ride, status }, bookings: [{ ...bookings[0], status: bookingStatus }], targetUserId, existingRatings: [] })).toBe(eligible ? "eligible" : "ineligible");
        });
      }
    }
  }

  it("rejects self-rating, another passenger, forged targets/ride IDs, missing and unclaimed rides", () => {
    const facts = { currentUserId: "passenger", ride, bookings, targetUserId: "driver", existingRatings: [] };
    for (const targetUserId of ["passenger", "second-passenger", "stranger"]) {
      expect(ratingEligibility({ ...facts, targetUserId })).toBe("ineligible");
    }
    expect(ratingEligibility({ ...facts, ride: null })).toBe("ineligible");
    expect(ratingEligibility({ ...facts, ride: { ...ride, driver_id: null } })).toBe("ineligible");
    expect(ratingEligibility({ ...facts, ride: { ...ride, id: "forged-ride" } })).toBe("ineligible");
  });

  it("does not confuse reverse, other-target or other-ride ratings with a duplicate", () => {
    expect(ratingEligibility({ currentUserId: "passenger", ride, bookings, targetUserId: "driver", existingRatings: [
      { ride_id: "ride", rater_id: "driver", ratee_id: "passenger" },
      { ride_id: "other-ride", rater_id: "passenger", ratee_id: "driver" },
    ] })).toBe("eligible");
  });
});
