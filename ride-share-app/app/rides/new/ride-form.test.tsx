// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

const mocks = vi.hoisted(() => ({ saveCar: vi.fn(), createRide: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ saveCar: mocks.saveCar, createRide: mocks.createRide }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
import { OfferWorkspace } from "./offer-workspace";

const car = { id: "92000000-0000-4000-8000-000000000001", make: "Volkswagen", model: "Golf", fuel_type: "petrol" as const, consumption_l_100km: 6, color: "Blue", plate_last3: "123", seats_total: 4 };
const props: ComponentProps<typeof OfferWorkspace> = {
  userId: "car-driver",
  cars: [car], carModels: [{ id: 1, make: "Volkswagen", model: "Golf", engine_size_l: 1.4, fuel_type: "petrol", consumption_l_100km: 6, release_year: 2015 }],
  cities: [{ id: 1, name_en: "Skopje", name_mk: "Скопје" }, { id: 2, name_en: "Bitola", name_mk: "Битола" }],
  pickupPoints: [], fuelPrices: { petrol: 80, diesel: 70 }, submissionId: "92000000-0000-4000-8000-000000000002", isImportedDraft: false,
  initialDraft: { source: "native", importId: null, origin: { cityId: null, pickupPointId: null, rawText: null }, destination: { cityId: null, pickupPointId: null, rawText: null }, departureAt: null, distanceKm: null, seatsTotal: null, carId: null, car: null, pricePerSeatMkd: null, notes: null, tags: [], genderPreference: "any", confidence: null, fieldConfidence: [], warnings: [] },
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });

describe("ride car selection", () => {
  it("preselects a single saved car and submits its id from the compact summary", () => {
    const { container } = render(<OfferWorkspace {...props} />);
    expect(screen.getByText("Volkswagen Golf")).toBeTruthy();
    expect(screen.queryByLabelText("Your saved cars")).toBeNull();
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("carId")).toBe(car.id);
    expect(data.get("carMode")).toBe("existing");
    expect(screen.getByLabelText("Available seats", { exact: false })).toHaveProperty("value", "");
  });

  it("lets a driver choose between saved cars without entering vehicle details", () => {
    const otherCar = { ...car, id: "92000000-0000-4000-8000-000000000003", model: "Polo", seats_total: 3 };
    const { container } = render(<OfferWorkspace {...props} cars={[car, otherCar]} />);
    fireEvent.change(screen.getByLabelText("Your saved cars"), { target: { value: otherCar.id } });
    expect(screen.getByText("Volkswagen Polo")).toBeTruthy();
    expect(screen.getByLabelText("Available seats", { exact: false })).toHaveProperty("value", "");
    expect(new FormData(container.querySelector("form")!).get("carId")).toBe(otherCar.id);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect((screen.getByLabelText("Your saved cars") as HTMLSelectElement).value).toBe(otherCar.id);
  });

  it("saves a car with an empty ride and reuses it immediately and on a later visit", async () => {
    mocks.saveCar.mockResolvedValue({ ok: true, car });
    const view = render(<OfferWorkspace {...props} cars={[]} />);
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Total passenger seats"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save car" }));
    await waitFor(() => expect(screen.getByText("Car saved. It’s ready for this ride and future rides.")).toBeTruthy());
    expect(screen.getByLabelText("Available seats", { exact: false })).toHaveProperty("value", "");
    expect(mocks.saveCar).toHaveBeenCalledTimes(1);
    expect(mocks.createRide).not.toHaveBeenCalled();
    expect(mocks.saveCar.mock.calls[0][0].get("carModelId")).toBe("1");
    await waitFor(() => expect(new FormData(view.container.querySelector("form")!).get("carId")).toBe(car.id));
    view.unmount();
    render(<OfferWorkspace {...props} />);
    expect(screen.getByText("Volkswagen Golf")).toBeTruthy();
    expect(screen.queryByLabelText("Consumption (L/100 km)")).toBeNull();
  });

  it("keeps seat changes specific to the ride and preserves imported seat counts", () => {
    const view = render(<OfferWorkspace {...props} />);
    const seats = screen.getByLabelText("Available seats", { exact: false });
    fireEvent.change(seats, { target: { value: "2" } });
    expect(new FormData(view.container.querySelector("form")!).get("seatsTotal")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(seats).toHaveProperty("value", "2");
    expect(car.seats_total).toBe(4);
    expect(mocks.saveCar).not.toHaveBeenCalled();
    view.unmount();
    sessionStorage.clear();
    const fresh = render(<OfferWorkspace {...props} />);
    expect(screen.getByLabelText("Available seats", { exact: false })).toHaveProperty("value", "");
    fresh.unmount();
    sessionStorage.clear();
    render(<OfferWorkspace {...props} initialDraft={{ ...props.initialDraft, seatsTotal: 2 }} />);
    expect(screen.getByLabelText("Available seats", { exact: false })).toHaveProperty("value", "2");
  });

  it("retains entered car details when saving fails", async () => {
    mocks.saveCar.mockResolvedValue({ ok: false, message: "Could not save car." });
    render(<OfferWorkspace {...props} cars={[]} />);
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Color (optional)"), { target: { value: "Blue" } });
    fireEvent.change(screen.getByLabelText("Total passenger seats"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save car" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Could not save car.");
    expect(screen.getByLabelText("Color (optional)")).toHaveProperty("value", "Blue");
  });

  it("makes an inline saved car available to sibling drafts and preserves its selection on recovery", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ trips: [
      { draft: props.initialDraft, mentioned: [], dateLocal: null, timeLocal: null },
      { draft: props.initialDraft, mentioned: [], dateLocal: null, timeLocal: null },
    ] })));
    mocks.saveCar.mockResolvedValue({ ok: true, car });
    const view = render(<OfferWorkspace {...props} cars={[]} />);
    fireEvent.change(screen.getByLabelText("Describe your rides"), { target: { value: "Two trips" } });
    fireEvent.click(screen.getByRole("button", { name: "Fill form" }));
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Total passenger seats"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save car" }));
    await waitFor(() => expect(screen.getAllByRole("tab")[1]).toHaveProperty("disabled", false));
    fireEvent.click(screen.getAllByRole("tab")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Saved car" }));
    fireEvent.change(screen.getByLabelText("Your saved cars"), { target: { value: car.id } });
    expect(screen.getByText("Volkswagen Golf")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Available seats", { exact: false }), { target: { value: "2" } });
    view.unmount();
    const recovered = render(<OfferWorkspace {...props} />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(new FormData(recovered.container.querySelector("form")!).get("carId")).toBe(car.id);
    expect(screen.getByLabelText("Available seats", { exact: false })).toHaveProperty("value", "2");
    expect(mocks.saveCar).toHaveBeenCalledTimes(1);
  });
});
