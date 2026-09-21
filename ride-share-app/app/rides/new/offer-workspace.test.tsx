// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RideDraft } from "@/lib/rides/ride-draft";
import { OfferWorkspace } from "./offer-workspace";

const publish = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./actions", () => ({ createRide: publish }));
const blank: RideDraft = { source: "native", importId: null,
  origin: { cityId: null, pickupPointId: null, rawText: null }, destination: { cityId: null, pickupPointId: null, rawText: null },
  departureAt: null, distanceKm: null, seatsTotal: null, carId: null, car: null, pricePerSeatMkd: null,
  notes: null, tags: [], genderPreference: "any", confidence: null, fieldConfidence: [], warnings: [] };
const props = { userId: "driver-one", initialDraft: blank, submissionId: "20000000-0000-4000-8000-000000000001", isImportedDraft: false,
  cities: [{ id: 1, name_en: "Skopje", name_mk: "Скопје" }, { id: 3, name_en: "Bitola", name_mk: "Битола" }],
  pickupPoints: [], cars: [], carModels: [], fuelPrices: { petrol: 80, diesel: 75 } };
const trip = { draft: { ...blank, origin: { cityId: 1, pickupPointId: null, rawText: "skp" }, destination: { cityId: 3, pickupPointId: null, rawText: "bt" }, departureAt: "2026-09-26T14:00:00Z" },
  mentioned: ["origin", "destination", "departureDate", "departureTime"], dateLocal: "2026-09-26", timeLocal: "16:00" };
beforeEach(() => { sessionStorage.clear(); publish.mockReset(); router.replace.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("fills cities and Skopje departure before requesting kilometres with their names", async () => {
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    if (url.includes("interpret")) return Response.json({ trips: [trip] });
    expect(JSON.parse(String(options.body))).toEqual({ originCity: "Skopje", destinationCity: "Bitola" });
    expect(screen.getByLabelText("Departure city")).toHaveProperty("value", "1");
    expect(screen.getByLabelText("Destination city")).toHaveProperty("value", "3");
    return Response.json({ distanceKm: 174.3 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<OfferWorkspace {...props} />);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "going skp to bt 4pm saturday with a clio" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  await waitFor(() => expect(screen.getByLabelText("Departure")).toHaveProperty("value", "2026-09-26T16:00"));
  await waitFor(() => expect(screen.getByLabelText("Estimated route distance (km)")).toHaveProperty("value", "174.3"));
  expect(screen.getByLabelText("Available seats")).toHaveProperty("value", "");
  expect(screen.getByLabelText("Price per seat (MKD)")).toHaveProperty("value", "");
  expect(publish).not.toHaveBeenCalled();
});

it("keeps two recognized trips in separate tabs and stays with the siblings after publishing", async () => {
  const returning = { ...trip, draft: { ...trip.draft, origin: trip.draft.destination, destination: trip.draft.origin, departureAt: "2026-09-27T16:00:00Z", seatsTotal: 3, pricePerSeatMkd: 400 }, dateLocal: "2026-09-27", timeLocal: "18:00" };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("interpret") ? Response.json({ trips: [trip, returning] }) : Response.json({ distanceKm: 174.3 })));
  publish.mockResolvedValue({ status: "success", message: "Ride published.", fieldErrors: {}, rideId: "30000000-0000-4000-8000-000000000002" });
  render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "skp bt Saturday 4pm, back Sunday 6pm" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Keep my outbound note" } });
  fireEvent.click(screen.getAllByRole("tab")[1]);
  expect(screen.getByLabelText("Departure city")).toHaveProperty("value", "3");
  expect(screen.getByLabelText("Departure")).toHaveProperty("value", "2026-09-27T18:00");
  fireEvent.submit(screen.getByRole("button", { name: "Publish ride" }).closest("form")!);
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(1));
  expect(router.replace).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Keep my outbound note");
  expect(screen.getByRole("button", { name: "Publish ride" })).toBeTruthy();
});

it("allows direct form edits after filling and protects manual km from stale lookups", async () => {
  let resolveRoute: (value: Response) => void = () => {};
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    if (url.includes("interpret")) return Response.json({ trips: [trip] });
    if (JSON.parse(String(options.body)).originCity === "Bitola") return new Promise<Response>(resolve => { resolveRoute = resolve; });
    return Response.json({ distanceKm: 174.3 });
  }));
  render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "skp bt Saturday 4pm" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  await waitFor(() => expect(screen.getByLabelText("Estimated route distance (km)")).toHaveProperty("value", "174.3"));
  fireEvent.change(screen.getByLabelText("Estimated route distance (km)"), { target: { value: "180" } });
  expect(screen.queryByLabelText("Correct this ride")).toBeNull();
  expect(screen.queryByRole("button", { name: "Update this draft" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Departure city"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Destination city"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Departure"), { target: { value: "2026-09-27T17:00" } });
  fireEvent.change(screen.getByLabelText("Estimated route distance (km)"), { target: { value: "185" } });
  expect(screen.getByLabelText("Departure")).toHaveProperty("value", "2026-09-27T17:00");
  await act(async () => { resolveRoute(Response.json({ distanceKm: 190 })); });
  expect(screen.getByLabelText("Estimated route distance (km)")).toHaveProperty("value", "185");
});

it("recovers every current field and manual km in the same user's session without exposing them to another user", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ distanceKm: 174.3 })));
  const first = render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Departure city"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Destination city"), { target: { value: "3" } });
  await waitFor(() => expect(screen.getByLabelText("Estimated route distance (km)")).toHaveProperty("value", "174.3"));
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "A suitcase and a guitar" } });
  fireEvent.change(screen.getByLabelText("Estimated route distance (km)"), { target: { value: "180" } });
  fireEvent.change(screen.getByLabelText("Available seats"), { target: { value: "2" } });
  await screen.findByText("Saved for this session");
  first.unmount();
  const restored = render(<OfferWorkspace {...props} />);
  await waitFor(() => expect(screen.getByLabelText("Notes")).toHaveProperty("value", "A suitcase and a guitar"));
  expect(screen.getByLabelText("Available seats")).toHaveProperty("value", "2");
  expect(screen.getByLabelText("Estimated route distance (km)")).toHaveProperty("value", "180");
  restored.rerender(<OfferWorkspace {...props} userId="another-driver" />);
  await waitFor(() => expect(screen.getByLabelText("Notes")).toHaveProperty("value", ""));
  expect(screen.getByLabelText("Departure city")).toHaveProperty("value", "");
});

it("preserves manual fields and description on interpretation failure and offers Retry", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Interpretation failed." }, { status: 502 })));
  render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Do not lose this" } });
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "skp bt" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  await screen.findByRole("button", { name: "Retry" });
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Do not lose this");
  expect(screen.getByLabelText("Describe your rides")).toHaveProperty("value", "skp bt");
});

it("does not overwrite edits made while interpretation was in flight", async () => {
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "skp bt" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Newer edit" } });
  await act(async () => { finish(Response.json({ trips: [trip] })); });
  await screen.findByText("The form changed. Retry to apply your description.");
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Newer edit");
  expect(screen.getByLabelText("Departure city")).toHaveProperty("value", "");
});

it("routes an imported draft, ignores pickup edits, and allows manual km after provider failure", async () => {
  const fetcher = vi.fn(async () => Response.json({ error: "Road distance is unavailable." }, { status: 502 }));
  vi.stubGlobal("fetch", fetcher);
  render(<OfferWorkspace {...props} initialDraft={{ ...trip.draft, distanceKm: 170, source: "imported", importId: "40000000-0000-4000-8000-000000000001" }} isImportedDraft
    pickupPoints={[{ id: 11, city_id: 1, name_en: "Mavrovka", name_mk: "Мавровка" }]} />);
  await screen.findByRole("button", { name: "Retry distance" });
  fireEvent.change(screen.getByLabelText("Estimated route distance (km)"), { target: { value: "180" } });
  fireEvent.change(screen.getByLabelText("Pickup point"), { target: { value: "11" } });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Estimated route distance (km)")).toHaveProperty("value", "180");
  expect(screen.getByLabelText("Departure city")).toHaveProperty("value", "1");
});

it("retains incomplete dates in extra tabs, supports keyboard navigation, append and discard", async () => {
  const incomplete = { ...trip, draft: { ...trip.draft, departureAt: null }, timeLocal: null };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("interpret") ? Response.json({ trips: [trip, incomplete] }) : Response.json({ distanceKm: 174 })));
  render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "Saturday 4pm and another Saturday trip" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
  fireEvent.keyDown(screen.getAllByRole("tab")[0], { key: "ArrowRight" });
  expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText(/Recognized 2026-09-26/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Create more drafts" }));
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(4));
  fireEvent.click(screen.getByRole("button", { name: "Discard this draft" }));
  expect(screen.getAllByRole("tab")).toHaveLength(3);
});

it("removes published tabs from recovery and redirects to My trips when the final draft publishes", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("interpret") ? Response.json({ trips: [trip, trip] }) : Response.json({ distanceKm: 174 })));
  publish.mockResolvedValue({ status: "success", message: "Published", fieldErrors: {}, rideId: "30000000-0000-4000-8000-000000000002" });
  const view = render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "two trips" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
  const ids = screen.getAllByRole("tab").map(tab => tab.id);
  fireEvent.submit(screen.getByRole("button", { name: "Publish ride" }).closest("form")!);
  await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(1));
  expect(router.replace).not.toHaveBeenCalled();
  view.unmount();
  render(<OfferWorkspace {...props} />);
  await waitFor(() => expect(screen.getAllByRole("tab").map(tab => tab.id)).toEqual([ids[1]]));
  expect(screen.getByRole("button", { name: "Publish ride" })).toBeTruthy();
  fireEvent.submit(screen.getByRole("button", { name: "Publish ride" }).closest("form")!);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/trips"));
  expect(screen.queryByRole("tab")).toBeNull();
  expect(sessionStorage.getItem(`ride-offers:v1:${props.userId}:native`)).toBeNull();
  expect(publish).toHaveBeenCalledTimes(2);

});

it("handles corrupt and unavailable storage without claiming recovery or losing editing", async () => {
  sessionStorage.setItem(`ride-offers:v1:${props.userId}:native`, "broken");
  const failing = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
  render(<OfferWorkspace {...props} />);
  await screen.findByText(/Session recovery is unavailable/);
  expect(screen.queryByText("Saved for this session")).toBeNull();
  expect(screen.getByText(/Saved drafts could not be restored/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Still editable" } });
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Still editable");
  failing.mockRestore();
});

it("keeps a failed publication editable and redirects only after a successful retry", async () => {
  publish.mockResolvedValueOnce({ status: "error", message: "Please retry", fieldErrors: {} })
    .mockResolvedValueOnce({ status: "success", message: "Published", fieldErrors: {}, rideId: "30000000-0000-4000-8000-000000000003" });
  render(<OfferWorkspace {...props} />);
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Keep this on failure" } });
  fireEvent.submit(screen.getByRole("button", { name: "Publish ride" }).closest("form")!);
  await screen.findByText("Please retry");
  expect(screen.getAllByRole("tab")).toHaveLength(1);
  expect(screen.getByLabelText("Notes")).toHaveProperty("value", "Keep this on failure");
  expect(router.replace).not.toHaveBeenCalled();
  fireEvent.submit(screen.getByRole("button", { name: "Publish ride" }).closest("form")!);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/trips"));
});
