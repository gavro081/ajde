export type OwnedTripShare = { id: string; token: string; expiresAt: string };
export type ShareResult = { ok: true; share: OwnedTripShare } | { ok: false; error: string };

export type SharedItinerary = {
  origin: string;
  destination: string;
  pickup: string | null;
  dropoff: string | null;
  departureAt: string;
  driver: { name: string; photoUrl: string } | null;
  car: { make: string; model: string; color: string | null } | null;
};
