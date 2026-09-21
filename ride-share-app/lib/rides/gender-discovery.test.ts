import { describe, expect, it } from "vitest";

import {
  canRequestSameGenderRide,
  filterRidesByDriverGender,
  shouldFilterRidesByDriverGender,
  usableDiscoveryGender,
} from "./gender-discovery";

const rides = [
  { id: "matching-any", driver_id: "driver-woman", gender_preference: "any" },
  {
    id: "matching-restricted",
    driver_id: "driver-woman-2",
    gender_preference: "same_as_driver",
  },
  { id: "nonmatching", driver_id: "driver-man", gender_preference: "any" },
  { id: "undisclosed", driver_id: "driver-private", gender_preference: "any" },
  { id: "imported", driver_id: null, gender_preference: "any" },
];

const driverGenders = new Map([
  ["driver-woman", "woman" as const],
  ["driver-woman-2", "woman" as const],
  ["driver-man", "man" as const],
  ["driver-private", "prefer_not_to_say" as const],
]);

describe("same-gender discovery filtering", () => {
  it("leaves every ride visible when the toggle is off", () => {
    expect(filterRidesByDriverGender(rides, driverGenders, "woman", false)).toEqual(rides);
  });

  it("includes matching drivers regardless of their ride request restriction", () => {
    expect(
      filterRidesByDriverGender(rides, driverGenders, "woman", true).map((ride) => ride.id),
    ).toEqual(["matching-any", "matching-restricted"]);
  });

  it("does not guess when the passenger gender is missing or undisclosed", () => {
    expect(filterRidesByDriverGender(rides, driverGenders, null, true)).toEqual(rides);
    expect(filterRidesByDriverGender(rides, driverGenders, "prefer_not_to_say", true)).toEqual(
      rides,
    );
  });

  it("treats only declared genders as usable", () => {
    expect(usableDiscoveryGender("non_binary")).toBe("non_binary");
    expect(usableDiscoveryGender("prefer_not_to_say")).toBeNull();
    expect(usableDiscoveryGender(null)).toBeNull();
  });

  it("allows restricted booking requests only when both profiles declare the same gender", () => {
    expect(canRequestSameGenderRide("woman", "woman")).toBe(true);
    expect(canRequestSameGenderRide("woman", "man")).toBe(false);
    expect(canRequestSameGenderRide("prefer_not_to_say", "prefer_not_to_say")).toBe(false);
    expect(canRequestSameGenderRide(null, null)).toBe(false);
  });

  it("only expands the feed query when gender filtering can be applied", () => {
    expect(shouldFilterRidesByDriverGender(true, "woman")).toBe(true);
    expect(shouldFilterRidesByDriverGender(true, "prefer_not_to_say")).toBe(false);
    expect(shouldFilterRidesByDriverGender(true, null)).toBe(false);
    expect(shouldFilterRidesByDriverGender(false, "woman")).toBe(false);
  });
});
