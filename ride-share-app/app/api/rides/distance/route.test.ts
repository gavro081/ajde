import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ userId: "driver" as string | null, grant: true, rpc: vi.fn(), error: false }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: db.userId ? { id: db.userId, email: "test@students.finki.ukim.mk" } : null } }) },
  from: (table: string) => table === "profiles" ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { full_name: "Test", photo_url: "photo", university: "UKIM" }, error: null }) }) }) } : ({ select: async () => ({ data: [
    { id: 1, name_en: "Skopje", name_mk: "Скопје", lat: 41.99646, lng: 21.43141 },
    { id: 3, name_en: "Bitola", name_mk: "Битола", lat: 41.03226, lng: 21.33553 },
  ], error: db.error ? { message: "offline" } : null }) }),
  rpc: db.rpc,
}) }));
import { POST } from "./route";
const request = (body: unknown = { originCity: "Skopje", destinationCity: "Bitola" }) => new Request("http://localhost/api/rides/distance", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { db.userId = "driver"; db.grant = true; db.error = false; db.rpc.mockReset().mockImplementation(async () => ({ data: db.grant, error: null })); vi.unstubAllGlobals(); });
it("accepts two city-name strings, resolves catalog coordinates and returns road kilometres", async () => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: "Ok", routes: [{ distance: 174255.6 }] }));
  vi.stubGlobal("fetch", transport);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ distanceKm: 174.3 });
  expect(transport.mock.calls[0][0]).toContain("21.43141,41.99646;21.33553,41.03226");
});

it.each([{ originCity: "Atlantis", destinationCity: "Bitola" }, { originCity: "Skopje", destinationCity: "Skopje" }, { originCity: "", destinationCity: "Bitola" }, { originCity: 1, destinationCity: 3 }])("rejects invalid city inputs before calling the provider", async body => {
  const transport = vi.fn(); vi.stubGlobal("fetch", transport);
  expect((await POST(request(body))).status).toBe(400);
  expect(transport).not.toHaveBeenCalled(); expect(db.rpc).not.toHaveBeenCalled();
});

it("requires authentication and an application-wide routing permit", async () => {
  const transport = vi.fn(); vi.stubGlobal("fetch", transport);
  db.userId = null;
  expect((await POST(request())).status).toBe(401);
  db.userId = "driver"; db.grant = false;
  expect((await POST(request())).status).toBe(429);
  expect(transport).not.toHaveBeenCalled();
});

it.each([{ code: "NoRoute", routes: [] }, { code: "Ok", routes: [{ distance: -20 }] }, { code: "Ok", routes: [{ distance: "174255" }] }])("treats unusable provider output as a failure", async body => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
  expect((await POST(request())).status).toBe(502);
});

it("handles timeouts without returning a guessed distance", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("Timeout", "TimeoutError"); }));
  const result = await POST(request());
  expect(result.status).toBe(502);
  expect(await result.json()).not.toHaveProperty("distanceKm");
});
