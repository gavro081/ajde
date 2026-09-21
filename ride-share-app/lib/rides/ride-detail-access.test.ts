import { describe, expect, it } from "vitest";

import { canViewRideDetail } from "./ride-detail-access";

describe("ride detail access", () => {
  it("keeps active rides visible to authenticated students", () => {
    expect(canViewRideDetail({ rideStatus: "published", isDriver: false })).toBe(true);
    expect(canViewRideDetail({ rideStatus: "full", isDriver: false })).toBe(true);
  });

  it("keeps every lifecycle state visible to its driver", () => {
    expect(canViewRideDetail({ rideStatus: "draft", isDriver: true })).toBe(true);
    expect(canViewRideDetail({ rideStatus: "cancelled", isDriver: true })).toBe(true);
  });

  it("lets accepted passengers revisit completed and cancelled rides", () => {
    expect(
      canViewRideDetail({
        rideStatus: "completed",
        isDriver: false,
        bookingStatus: "accepted",
      }),
    ).toBe(true);
    expect(
      canViewRideDetail({
        rideStatus: "cancelled",
        isDriver: false,
        bookingStatus: "accepted",
      }),
    ).toBe(true);
  });

  it("does not expose historical rides to other booking states", () => {
    expect(
      canViewRideDetail({
        rideStatus: "completed",
        isDriver: false,
        bookingStatus: "requested",
      }),
    ).toBe(false);
    expect(
      canViewRideDetail({
        rideStatus: "cancelled",
        isDriver: false,
        bookingStatus: "cancelled",
      }),
    ).toBe(false);
  });
});
