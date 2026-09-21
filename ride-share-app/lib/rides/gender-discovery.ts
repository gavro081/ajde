export type DiscoveryGender = "woman" | "man" | "non_binary" | "prefer_not_to_say" | null;
export type UsableDiscoveryGender = Exclude<DiscoveryGender, "prefer_not_to_say" | null>;

export function usableDiscoveryGender(
  gender: DiscoveryGender | undefined,
): UsableDiscoveryGender | null {
  return gender && gender !== "prefer_not_to_say" ? gender : null;
}

export function canRequestSameGenderRide(
  driverGender: DiscoveryGender | undefined,
  passengerGender: DiscoveryGender | undefined,
) {
  const usableDriverGender = usableDiscoveryGender(driverGender);
  const usablePassengerGender = usableDiscoveryGender(passengerGender);

  return usableDriverGender !== null && usableDriverGender === usablePassengerGender;
}

export function filterRidesByDriverGender<T extends { driver_id: string | null }>(
  rides: readonly T[],
  driverGenders: ReadonlyMap<string, DiscoveryGender>,
  passengerGender: DiscoveryGender | undefined,
  enabled: boolean,
) {
  if (!enabled) return [...rides];
  const usablePassengerGender = usableDiscoveryGender(passengerGender);
  if (!usablePassengerGender) return [...rides];

  return rides.filter((ride) => {
    if (!ride.driver_id) return false;
    return usableDiscoveryGender(driverGenders.get(ride.driver_id)) === usablePassengerGender;
  });
}
