import { afterEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { roadDistanceKm } from "./road-distance";

afterEach(() => vi.unstubAllGlobals());

it("returns an editable city-to-city road estimate after receiving a routing permit", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: "Ok", routes: [{ distance: 174255.6 }] }));
  vi.stubGlobal("fetch", transport);
  const result = await roadDistanceKm({
    from: () => ({ select: async () => ({ data: [
      { id: 1, lat: 41.99646, lng: 21.43141 },
      { id: 3, lat: 41.03226, lng: 21.33553 },
    ], error: null }) }),
    rpc: async () => ({ data: true, error: null }),
  }, 1, 3);
  expect(result).toEqual({ ok: true, distanceKm: 174.3 });
  expect(transport.mock.calls[0][0]).toBe("https://router.project-osrm.org/route/v1/driving/21.43141,41.99646;21.33553,41.03226?overview=false&alternatives=false&steps=false");
});
