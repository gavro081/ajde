"use client";

import { useActionState, useMemo, useState } from "react";

import type { Tables } from "@/lib/supabase/database.types";
import { RIDE_TAGS, type RideDraft } from "@/lib/rides/ride-draft";
import type { FuelPriceConfig } from "@/lib/rides/fuel-price-config";
import { calculateRideEstimate } from "@/lib/rides/ride-estimate";

import { createRide, type CreateRideFormState } from "./actions";

type City = Pick<Tables<"cities">, "id" | "name_en" | "name_mk">;
type PickupPoint = Pick<Tables<"pickup_points">, "id" | "city_id" | "name_en" | "name_mk">;
type Car = Pick<
  Tables<"cars">,
  | "id"
  | "make"
  | "model"
  | "fuel_type"
  | "consumption_l_100km"
  | "color"
  | "plate_last3"
>;
type CarModel = Pick<
  Tables<"car_models">,
  | "id"
  | "make"
  | "model"
  | "engine_size_l"
  | "fuel_type"
  | "consumption_l_100km"
  | "release_year"
>;

type RideFormProps = {
  cars: Car[];
  carModels: CarModel[];
  cities: City[];
  fuelPrices: FuelPriceConfig;
  pickupPoints: PickupPoint[];
  initialDraft: RideDraft;
  submissionId: string;
  isImportedDraft: boolean;
};

const initialState: CreateRideFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const tagLabels: Record<(typeof RIDE_TAGS)[number], string> = {
  flexible_pickup: "Flexible pickup",
  luggage_space: "Luggage space",
  music: "Music welcome",
  no_smoking: "No smoking",
  pets_allowed: "Pets allowed",
  quiet_ride: "Quiet ride",
};

function dateTimeLocalValue(value: string | null) {
  return value?.slice(0, 16) ?? "";
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-sm text-red-700">{errors[0]}</p>;
}

export function RideForm({
  cars,
  carModels,
  cities,
  fuelPrices,
  pickupPoints,
  initialDraft,
  submissionId,
  isImportedDraft,
}: RideFormProps) {
  const [state, formAction, pending] = useActionState(createRide, initialState);
  const [originCityId, setOriginCityId] = useState(initialDraft.origin.cityId?.toString() ?? "");
  const [destinationCityId, setDestinationCityId] = useState(
    initialDraft.destination.cityId?.toString() ?? "",
  );
  const [originPickupId, setOriginPickupId] = useState(
    initialDraft.origin.pickupPointId?.toString() ?? "",
  );
  const [destinationPickupId, setDestinationPickupId] = useState(
    initialDraft.destination.pickupPointId?.toString() ?? "",
  );
  const [departureLocal, setDepartureLocal] = useState(
    dateTimeLocalValue(initialDraft.departureAt),
  );
  const [distanceKm, setDistanceKm] = useState(initialDraft.distanceKm?.toString() ?? "");
  const [seatsTotal, setSeatsTotal] = useState(initialDraft.seatsTotal?.toString() ?? "");
  const [pricePerSeatMkd, setPricePerSeatMkd] = useState(
    initialDraft.pricePerSeatMkd?.toString() ?? "",
  );
  const [carMode, setCarMode] = useState<"existing" | "catalog" | "manual">(
    initialDraft.carId && cars.some((car) => car.id === initialDraft.carId)
      ? "existing"
      : initialDraft.car?.carModelId
        ? "catalog"
        : cars.length > 0
          ? "existing"
          : "catalog",
  );
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogModelId, setCatalogModelId] = useState(
    initialDraft.car?.carModelId?.toString() ?? "",
  );
  const initialCatalogModel = carModels.find(
    (model) => model.id === initialDraft.car?.carModelId,
  );
  const [consumption, setConsumption] = useState(
    initialDraft.car?.consumptionL100Km?.toString() ??
      initialCatalogModel?.consumption_l_100km.toString() ??
      "",
  );
  const [existingCarId, setExistingCarId] = useState(initialDraft.carId ?? "");
  const [manualFuelType, setManualFuelType] = useState<string>(
    initialDraft.car?.fuelType ?? "petrol",
  );

  const originPickupPoints = useMemo(
    () => pickupPoints.filter((point) => point.city_id.toString() === originCityId),
    [originCityId, pickupPoints],
  );
  const destinationPickupPoints = useMemo(
    () => pickupPoints.filter((point) => point.city_id.toString() === destinationCityId),
    [destinationCityId, pickupPoints],
  );
  const filteredCarModels = useMemo(() => {
    const query = catalogQuery.trim().toLocaleLowerCase();
    if (!query) return carModels;
    return carModels.filter(
      (model) =>
        model.id.toString() === catalogModelId ||
        `${model.make} ${model.model} ${model.engine_size_l}`
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [carModels, catalogModelId, catalogQuery]);
  const selectedCatalogModel = carModels.find(
    (model) => model.id.toString() === catalogModelId,
  );
  const selectedExistingCar = cars.find((car) => car.id === existingCarId);
  const estimateFuelType =
    carMode === "existing"
      ? selectedExistingCar?.fuel_type
      : carMode === "catalog"
        ? selectedCatalogModel?.fuel_type
        : manualFuelType;
  const estimateConsumption =
    carMode === "existing"
      ? selectedExistingCar?.consumption_l_100km.toString() ?? ""
      : consumption;

  let departureAt = "";
  if (departureLocal) {
    const parsedDeparture = new Date(departureLocal);
    if (!Number.isNaN(parsedDeparture.getTime())) departureAt = parsedDeparture.toISOString();
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="source" value={initialDraft.source} />
      <input type="hidden" name="importId" value={initialDraft.importId ?? ""} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="departureAt" value={departureAt} />

      {isImportedDraft ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Imported details are only a starting point. Confirm every field before saving or
          publishing this ride.
        </div>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2">
        <label className="font-medium text-slate-800">
          Origin city
          <select
            className={inputClass}
            name="originCityId"
            required
            value={originCityId}
            onChange={(event) => {
              setOriginCityId(event.target.value);
              setOriginPickupId("");
            }}
          >
            <option value="">Choose a city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name_en} / {city.name_mk}
              </option>
            ))}
          </select>
          <FieldError errors={state.fieldErrors["origin.cityId"]} />
        </label>

        <label className="font-medium text-slate-800">
          Origin pickup
          <select
            className={inputClass}
            name="originPickupPointId"
            value={originPickupId}
            onChange={(event) => setOriginPickupId(event.target.value)}
          >
            <option value="">Decide with passengers</option>
            {originPickupPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name_en} / {point.name_mk}
              </option>
            ))}
          </select>
        </label>

        <label className="font-medium text-slate-800">
          Destination city
          <select
            className={inputClass}
            name="destinationCityId"
            required
            value={destinationCityId}
            onChange={(event) => {
              setDestinationCityId(event.target.value);
              setDestinationPickupId("");
            }}
          >
            <option value="">Choose a city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name_en} / {city.name_mk}
              </option>
            ))}
          </select>
          <FieldError errors={state.fieldErrors["destination.cityId"]} />
        </label>

        <label className="font-medium text-slate-800">
          Destination pickup
          <select
            className={inputClass}
            name="destinationPickupPointId"
            value={destinationPickupId}
            onChange={(event) => setDestinationPickupId(event.target.value)}
          >
            <option value="">Decide with passengers</option>
            {destinationPickupPoints.map((point) => (
              <option key={point.id} value={point.id}>
                {point.name_en} / {point.name_mk}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <label className="font-medium text-slate-800">
          Departure
          <input
            className={inputClass}
            name="departureLocal"
            type="datetime-local"
            required
            value={departureLocal}
            onChange={(event) => setDepartureLocal(event.target.value)}
          />
          <FieldError errors={state.fieldErrors.departureAt} />
        </label>

        <label className="font-medium text-slate-800">
          Available seats
          <input
            className={inputClass}
            max={8}
            min={1}
            name="seatsTotal"
            onChange={(event) => setSeatsTotal(event.target.value)}
            required
            type="number"
            value={seatsTotal}
          />
          <FieldError errors={state.fieldErrors.seatsTotal} />
        </label>

        <label className="font-medium text-slate-800">
          Price per seat (MKD)
          <input
            className={inputClass}
            min={0}
            name="pricePerSeatMkd"
            onChange={(event) => setPricePerSeatMkd(event.target.value)}
            required
            step={1}
            type="number"
            value={pricePerSeatMkd}
          />
          <FieldError errors={state.fieldErrors.pricePerSeatMkd} />
        </label>
      </section>

      <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <legend className="px-2 font-semibold text-slate-900">Car</legend>
        <div className="flex flex-wrap gap-2">
          {cars.length > 0 ? (
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                carMode === "existing"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
              onClick={() => setCarMode("existing")}
              type="button"
            >
              Saved car
            </button>
          ) : null}
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              carMode === "catalog"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => setCarMode("catalog")}
            type="button"
          >
            Find model
          </button>
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              carMode === "manual"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => setCarMode("manual")}
            type="button"
          >
            Enter manually
          </button>
        </div>

        <input name="carMode" type="hidden" value={carMode} />

        {carMode === "existing" ? (
          <label className="mt-5 block font-medium text-slate-800">
            Your saved cars
            <select
              className={inputClass}
              name="carId"
              onChange={(event) => setExistingCarId(event.target.value)}
              required
              value={existingCarId}
            >
              <option value="">Choose a car</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.make} {car.model}
                  {car.color ? ` · ${car.color}` : ""}
                  {car.plate_last3 ? ` · •••${car.plate_last3}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {carMode === "catalog" ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="font-medium text-slate-800 md:col-span-2">
              Search models
              <input
                className={inputClass}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Golf, Astra, Clio…"
                type="search"
                value={catalogQuery}
              />
            </label>
            <label className="font-medium text-slate-800 md:col-span-2">
              Model
              <select
                className={inputClass}
                name="carModelId"
                onChange={(event) => {
                  const nextId = event.target.value;
                  setCatalogModelId(nextId);
                  const model = carModels.find((item) => item.id.toString() === nextId);
                  setConsumption(model?.consumption_l_100km.toString() ?? "");
                }}
                required
                value={catalogModelId}
              >
                <option value="">Choose a model</option>
                {filteredCarModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.make} {model.model} · {model.engine_size_l}L {model.fuel_type}
                    {model.release_year ? ` · ${model.release_year}` : ""}
                  </option>
                ))}
              </select>
              {selectedCatalogModel ? (
                <p className="mt-2 text-sm text-slate-600">
                  Catalog estimate: {selectedCatalogModel.consumption_l_100km} L/100 km. Change it
                  below if you know your car&apos;s real consumption.
                </p>
              ) : null}
            </label>
            <NewCarFields
              consumption={consumption}
              initialDraft={initialDraft}
              onConsumptionChange={setConsumption}
            />
          </div>
        ) : null}

        {carMode === "manual" ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="font-medium text-slate-800">
              Make
              <input
                className={inputClass}
                defaultValue={initialDraft.car?.make ?? ""}
                maxLength={80}
                name="carMake"
                required
              />
            </label>
            <label className="font-medium text-slate-800">
              Model
              <input
                className={inputClass}
                defaultValue={initialDraft.car?.model ?? ""}
                maxLength={120}
                name="carModel"
                required
              />
            </label>
            <label className="font-medium text-slate-800">
              Fuel
              <select
                className={inputClass}
                name="fuelType"
                onChange={(event) => setManualFuelType(event.target.value)}
                required
                value={manualFuelType}
              >
                <option value="petrol">Petrol</option>
                <option value="diesel">Diesel</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
                <option value="lpg">LPG</option>
                <option value="other">Other</option>
              </select>
            </label>
            <NewCarFields
              consumption={consumption}
              initialDraft={initialDraft}
              onConsumptionChange={setConsumption}
            />
          </div>
        ) : null}
        <FieldError errors={state.fieldErrors.carId} />
      </fieldset>

      <RideEstimatePanel
        consumption={estimateConsumption}
        distanceKm={distanceKm}
        fuelPrices={fuelPrices}
        fuelType={estimateFuelType}
        onDistanceChange={setDistanceKm}
        onUseSuggestion={(price) => setPricePerSeatMkd(price.toString())}
        seats={seatsTotal}
      />

      <fieldset>
        <legend className="font-medium text-slate-800">Ride preferences</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {RIDE_TAGS.map((tag) => (
            <label
              className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700"
              key={tag}
            >
              <input
                defaultChecked={initialDraft.tags.includes(tag)}
                name="tags"
                type="checkbox"
                value={tag}
              />
              {tagLabels[tag]}
            </label>
          ))}
        </div>
        <FieldError errors={state.fieldErrors.tags} />
      </fieldset>

      <label className="block font-medium text-slate-800">
        Passenger preference
        <select
          className={inputClass}
          defaultValue={initialDraft.genderPreference ?? "any"}
          name="genderPreference"
          required
        >
          <option value="any">Anyone</option>
          <option value="same_as_driver">Same gender as me</option>
        </select>
        <FieldError errors={state.fieldErrors.genderPreference} />
      </label>

      <label className="block font-medium text-slate-800">
        Notes
        <textarea
          className={`${inputClass} min-h-28 resize-y`}
          defaultValue={initialDraft.notes ?? ""}
          maxLength={2_000}
          name="notes"
          placeholder="Luggage, timing, or pickup details passengers should know"
        />
        <FieldError errors={state.fieldErrors.notes} />
      </label>

      {state.message ? (
        <div
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm ${
            state.status === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {state.message}
          {state.rideId ? <span className="ml-1 font-mono">({state.rideId})</span> : null}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        <button
          className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 disabled:opacity-50"
          disabled={pending}
          name="intent"
          type="submit"
          value="save_draft"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button
          className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          disabled={pending}
          name="intent"
          type="submit"
          value="publish"
        >
          {pending ? "Publishing…" : "Publish ride"}
        </button>
      </div>
    </form>
  );
}

type RideEstimatePanelProps = {
  consumption: string;
  distanceKm: string;
  fuelPrices: FuelPriceConfig;
  fuelType: string | undefined;
  onDistanceChange: (value: string) => void;
  onUseSuggestion: (price: number) => void;
  seats: string;
};

function RideEstimatePanel({
  consumption,
  distanceKm,
  fuelPrices,
  fuelType,
  onDistanceChange,
  onUseSuggestion,
  seats,
}: RideEstimatePanelProps) {
  const supportedFuel = fuelType === "petrol" || fuelType === "diesel" ? fuelType : null;
  const fuelPrice = supportedFuel ? fuelPrices[supportedFuel] : null;
  const numericInput = {
    distanceKm: Number(distanceKm),
    consumptionL100Km: Number(consumption),
    fuelPriceMkdL: fuelPrice ?? 0,
    seats: Number(seats),
  };
  let estimate: ReturnType<typeof calculateRideEstimate> | null = null;

  if (
    supportedFuel &&
    fuelPrice &&
    Object.values(numericInput).every((value) => Number.isFinite(value) && value > 0)
  ) {
    try {
      estimate = calculateRideEstimate({ ...numericInput, fuelType: supportedFuel });
    } catch {
      estimate = null;
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
      <h2 className="font-semibold text-emerald-950">Fair-price and CO₂ estimate</h2>
      <p className="mt-1 text-sm text-emerald-900/75">
        Fuel cost is split across the offered passenger seats. The price remains editable.
      </p>
      <label className="mt-4 block max-w-xs font-medium text-slate-800">
        Estimated route distance (km)
        <input
          className={inputClass}
          min="0.1"
          name="distanceKm"
          onChange={(event) => onDistanceChange(event.target.value)}
          step="0.1"
          type="number"
          value={distanceKm}
        />
      </label>

      {!supportedFuel && fuelType ? (
        <p className="mt-4 text-sm text-amber-800">
          Automatic CO₂ estimates are currently available only for petrol and diesel cars; no
          emissions factor is assumed for {fuelType}.
        </p>
      ) : null}
      {supportedFuel && !fuelPrice ? (
        <p className="mt-4 text-sm text-amber-800">
          Add the verified {supportedFuel} pump price to the server environment to enable the
          estimate.
        </p>
      ) : null}

      {estimate && supportedFuel && fuelPrice ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <EstimateValue label="Fuel used" value={`${estimate.fuelLitres.toFixed(1)} L`} />
          <EstimateValue
            label="Fuel cost"
            value={`${Math.round(estimate.totalFuelCostMkd)} MKD`}
          />
          <EstimateValue label="Suggested seat" value={`${estimate.pricePerSeatMkd} MKD`} />
          <EstimateValue
            label="Potential CO₂ saved"
            value={`${estimate.potentialCo2SavedKg.toFixed(1)} kg`}
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              onClick={() => onUseSuggestion(estimate.pricePerSeatMkd)}
              type="button"
            >
              Use {estimate.pricePerSeatMkd} MKD suggestion
            </button>
            <p className="mt-2 text-xs text-emerald-900/70">
              Assumes {fuelPrice} MKD/L and {supportedFuel === "petrol" ? "2.31" : "2.68"} kg CO₂
              per litre. Potential savings assume every offered seat replaces one separate car on
              the same route.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EstimateValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

type NewCarFieldsProps = {
  consumption: string;
  initialDraft: RideDraft;
  onConsumptionChange: (value: string) => void;
};

function NewCarFields({
  consumption,
  initialDraft,
  onConsumptionChange,
}: NewCarFieldsProps) {
  return (
    <>
      <label className="font-medium text-slate-800">
        Consumption (L/100 km)
        <input
          className={inputClass}
          min="0.1"
          name="consumptionL100Km"
          onChange={(event) => onConsumptionChange(event.target.value)}
          required
          step="0.1"
          type="number"
          value={consumption}
        />
      </label>
      <label className="font-medium text-slate-800">
        Total passenger seats
        <input
          className={inputClass}
          defaultValue={initialDraft.car?.seatsTotal ?? 4}
          max={8}
          min={1}
          name="carSeatsTotal"
          required
          type="number"
        />
      </label>
      <label className="font-medium text-slate-800">
        Color (optional)
        <input
          className={inputClass}
          defaultValue={initialDraft.car?.color ?? ""}
          name="carColor"
        />
      </label>
      <label className="font-medium text-slate-800">
        Last 3 plate characters (optional)
        <input
          className={inputClass}
          defaultValue={initialDraft.car?.plateLast3 ?? ""}
          maxLength={3}
          name="plateLast3"
          placeholder="123"
        />
      </label>
    </>
  );
}
