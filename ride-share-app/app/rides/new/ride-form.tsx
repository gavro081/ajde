"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { departureInstant, type OfferValues } from "@/lib/rides/offer-values";

import type { Tables } from "@/lib/supabase/database.types";
import { RIDE_TAGS, type RideDraft } from "@/lib/rides/ride-draft";
import type { FuelPriceConfig } from "@/lib/rides/fuel-price-config";
import { calculateRideEstimate } from "@/lib/rides/ride-estimate";
import { DateTimeField } from "@/components/date-time-field";

import { saveCar, type CreateRideFormState } from "./actions";

type City = Pick<Tables<"cities">, "id" | "name_en" | "name_mk">;
type PickupPoint = Pick<Tables<"pickup_points">, "id" | "city_id" | "name_en" | "name_mk">;
export type Car = Pick<
  Tables<"cars">,
  | "id"
  | "make"
  | "model"
  | "fuel_type"
  | "consumption_l_100km"
  | "color"
  | "plate_last3"
  | "seats_total"
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

export type RideFormProps = {
  cars: Car[];
  carModels: CarModel[];
  cities: City[];
  fuelPrices: FuelPriceConfig;
  pickupPoints: PickupPoint[];
  initialDraft: RideDraft;
  submissionId: string;
  isImportedDraft: boolean;
  values: OfferValues;
  onChange: (values: OfferValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  state: CreateRideFormState;
  pending: boolean;
  onCarSaved: (car: Car) => void;
  onCarSaving: (saving: boolean) => void;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

const tagLabels: Record<(typeof RIDE_TAGS)[number], string> = {
  flexible_pickup: "Flexible pickup",
  luggage_space: "Luggage space",
  music: "Music welcome",
  no_smoking: "No smoking",
  pets_allowed: "Pets allowed",
  quiet_ride: "Quiet ride",
};

function FieldError({ errors, id }: { errors?: string[]; id?: string }) {
  if (!errors?.length) return null;
  return <p id={id} className="mt-1 text-sm text-red-700">{errors[0]}</p>;
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
  values, onChange, onSubmit, state, pending, onCarSaved, onCarSaving,
}: RideFormProps) {
  const [savingCar, startSavingCar] = useTransition();
  const [carMessage, setCarMessage] = useState("");
  const [carSaveError, setCarSaveError] = useState(false);
  const carFieldsRef = useRef<HTMLFieldSetElement>(null);
  const carChangeRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "error") formRef.current?.querySelector<HTMLElement>('[role="alert"]')?.focus();
  }, [state]);
  const [choosingCar, setChoosingCar] = useState(false);
  const { originCityId, destinationCityId, originPickupId, destinationPickupId, departureLocal, distanceKm, seatsTotal, pricePerSeatMkd, carMode, catalogQuery, catalogModelId, consumption, existingCarId, manualFuelType } = values;
  const setOriginPickupId = (value: OfferValues["originPickupId"]) => onChange({ ...values, originPickupId: value });
  const setDestinationPickupId = (value: OfferValues["destinationPickupId"]) => onChange({ ...values, destinationPickupId: value });
  const setDepartureLocal = (value: OfferValues["departureLocal"]) => onChange({ ...values, departureLocal: value });
  const setDistanceKm = (value: OfferValues["distanceKm"]) => onChange({ ...values, distanceKm: value });
  const setSeatsTotal = (value: OfferValues["seatsTotal"]) => onChange({ ...values, seatsTotal: value });
  const setPricePerSeatMkd = (value: OfferValues["pricePerSeatMkd"]) => onChange({ ...values, pricePerSeatMkd: value });
  const setCarMode = (value: OfferValues["carMode"]) => onChange({ ...values, carMode: value });
  const setCatalogQuery = (value: OfferValues["catalogQuery"]) => onChange({ ...values, catalogQuery: value });
  const setConsumption = (value: OfferValues["consumption"]) => onChange({ ...values, consumption: value });
  const setExistingCarId = (value: OfferValues["existingCarId"]) => onChange({ ...values, existingCarId: value });
  const setManualFuelType = (value: OfferValues["manualFuelType"]) => onChange({ ...values, manualFuelType: value });

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
  const selectedCarCapacity = carMode === "existing" ? selectedExistingCar?.seats_total : undefined;
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

  function handleSaveCar() {
    if (!formRef.current || savingCar) return;
    const fields = carFieldsRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
    for (const field of fields ?? []) {
      if (!field.reportValidity()) return;
    }
    const data = new FormData(formRef.current);
    setCarMessage("");
    onCarSaving(true);
    startSavingCar(async () => {
      try {
        const result = await saveCar(data);
        if (!result.ok) {
          setCarSaveError(true);
          setCarMessage(result.message);
          return;
        }
        onCarSaved(result.car);
        setChoosingCar(false);
        setCarSaveError(false);
        setCarMessage("Car saved. It’s ready for this ride and future rides.");
        requestAnimationFrame(() => carChangeRef.current?.focus());
      } catch {
        setCarSaveError(true);
        setCarMessage("We could not save your car. Please try again.");
      } finally {
        onCarSaving(false);
      }
    });
  }

  const departureAt = departureInstant(departureLocal);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      // React resets forms after a resolved action, including validation failures.
      // Keep every entered value until the successful save navigates away.
      onReset={(event) => event.preventDefault()}
      className="ride-form space-y-8"
      aria-busy={pending || savingCar}
    >
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

      <section className="space-y-4" aria-labelledby="route-heading">
        <h2 id="route-heading" className="font-semibold">Your ride</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="font-medium text-slate-800">
            From
            <select
              className={inputClass}
              name="originCityId"
              aria-invalid={Boolean(state.fieldErrors["origin.cityId"]) || undefined}
              aria-describedby={state.fieldErrors["origin.cityId"] ? "origin-error" : undefined}
              required
              value={originCityId}
              onChange={(event) => {
                onChange({ ...values, originCityId: event.target.value, originPickupId: "" });
              }}
            >
              <option value="">Choose a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name_en} / {city.name_mk}
                </option>
              ))}
            </select>
            <FieldError id="origin-error" errors={state.fieldErrors["origin.cityId"]} />
          </label>
          <label className="font-medium text-slate-800">
            To
            <select
              className={inputClass}
              name="destinationCityId"
              aria-invalid={Boolean(state.fieldErrors["destination.cityId"]) || undefined}
              aria-describedby={state.fieldErrors["destination.cityId"] ? "destination-error" : undefined}
              required
              value={destinationCityId}
              onChange={(event) => {
                onChange({ ...values, destinationCityId: event.target.value, destinationPickupId: "" });
              }}
            >
              <option value="">Choose a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name_en} / {city.name_mk}
                </option>
              ))}
            </select>
            <FieldError id="destination-error" errors={state.fieldErrors["destination.cityId"]} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="font-medium text-slate-800 col-span-2">
            <span id="departure-label">Departure</span>
            <DateTimeField
              labelledBy="departure-label"
              className={inputClass}
              invalid={Boolean(state.fieldErrors.departureAt)}
              describedBy={state.fieldErrors.departureAt ? "departure-error" : undefined}
              disabled={pending || savingCar}
              value={departureLocal}
              onChange={setDepartureLocal}
            />
            <FieldError id="departure-error" errors={state.fieldErrors.departureAt} />
            {departureLocal && !departureAt && <p className="mt-2 text-sm text-amber-800">Recognized {departureLocal.split("T").filter(Boolean).join(" ")}. Complete the departure date and time.</p>}
          </div>
          <label className="font-medium text-slate-800">
            Available seats
            <input
              className={inputClass}
              max={selectedCarCapacity ?? 8}
              min={1}
              name="seatsTotal"
              aria-invalid={Boolean(state.fieldErrors.seatsTotal) || undefined}
              aria-describedby={state.fieldErrors.seatsTotal ? "seats-hint seats-error" : "seats-hint"}
              onChange={(event) => setSeatsTotal(event.target.value)}
              required
              type="number"
              value={seatsTotal}
            />
            <span id="seats-hint" className="mt-1 block text-xs font-normal text-slate-500">Choose how many seats to offer for this ride</span>
            <FieldError id="seats-error" errors={state.fieldErrors.seatsTotal} />
          </label>
          <label className="font-medium text-slate-800">
            Price per seat (MKD)
            <input
              className={inputClass}
              min={0}
              name="pricePerSeatMkd"
              aria-invalid={Boolean(state.fieldErrors.pricePerSeatMkd) || undefined}
              aria-describedby={state.fieldErrors.pricePerSeatMkd ? "price-error" : undefined}
              onChange={(event) => setPricePerSeatMkd(event.target.value)}
              required
              step={1}
              type="number"
              value={pricePerSeatMkd}
            />
            <FieldError id="price-error" errors={state.fieldErrors.pricePerSeatMkd} />
          </label>
        </div>
        <p className="text-xs text-slate-500">Enter departure in Skopje local time, wherever your device is located.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="font-medium text-slate-800">
            Pickup point
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
            Drop-off point
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
        </div>
      </section>

      <fieldset ref={carFieldsRef} disabled={pending || savingCar} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <legend className="px-2 font-semibold text-slate-900">Your car</legend>
        {carMode === "existing" && selectedExistingCar && !choosingCar ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">{selectedExistingCar.make} {selectedExistingCar.model}</p>
              <p className="mt-1 text-sm text-slate-500">
                Saved car{selectedExistingCar.color ? ` · ${selectedExistingCar.color}` : ""}
                {selectedExistingCar.plate_last3 ? ` · •••${selectedExistingCar.plate_last3}` : ""}
              </p>
            </div>
            <button ref={carChangeRef} type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50" onClick={() => setChoosingCar(true)}>Change</button>
            <input type="hidden" name="carId" value={existingCarId} />
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2">
              {cars.length > 0 ? (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    carMode === "existing"
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => setCarMode("existing")}
                  aria-pressed={carMode === "existing"}
                  type="button"
                >
                  Saved car
                </button>
              ) : null}
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  carMode === "catalog"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setCarMode("catalog")}
                aria-pressed={carMode === "catalog"}
                type="button"
              >
                Find model
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  carMode === "manual"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
                onClick={() => setCarMode("manual")}
                aria-pressed={carMode === "manual"}
                type="button"
              >
                Enter manually
              </button>
            </div>

            {carMode === "existing" ? (
              <label className="mt-5 block font-medium text-slate-800">
                Your saved cars
                <select
                  className={inputClass}
                  name="carId"
                  onChange={(event) => {
                    setExistingCarId(event.target.value);
                    if (event.target.value) setChoosingCar(false);
                    setCarMessage("");
                  }}
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
                      const model = carModels.find((item) => item.id.toString() === nextId);
                      onChange({ ...values, catalogModelId: nextId, consumption: model?.consumption_l_100km.toString() ?? "" });
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
                  values={values}
                  onChange={onChange}
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
                    value={values.carMake}
                    onChange={(event) => onChange({ ...values, carMake: event.target.value })}
                    maxLength={80}
                    name="carMake"
                    required
                  />
                </label>
                <label className="font-medium text-slate-800">
                  Model
                  <input
                    className={inputClass}
                    value={values.carModel}
                    onChange={(event) => onChange({ ...values, carModel: event.target.value })}
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
                    <option value="">Choose fuel</option>
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
                  values={values}
                  onChange={onChange}
                  onConsumptionChange={setConsumption}
                />
              </div>
            ) : null}
            {carMode !== "existing" ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button className="btn-secondary disabled:opacity-50" type="button" onClick={handleSaveCar} disabled={savingCar || pending}>
                  {savingCar ? "Saving car…" : "Save car"}
                </button>
                <p className="text-sm text-slate-500">Save once and reuse on future rides.</p>
              </div>
            ) : selectedExistingCar ? (
              <button className="mt-4 text-sm font-semibold text-brand-700" type="button" onClick={() => setChoosingCar(false)}>Done</button>
            ) : null}
          </div>
        )}
        <input name="carMode" type="hidden" value={carMode} />
        {carMessage ? <p role={carSaveError ? "alert" : "status"} className={`mt-3 text-sm ${carSaveError ? "text-red-700" : "text-brand-700"}`}>{carMessage}</p> : null}
        <FieldError errors={state.fieldErrors.carId} />
      </fieldset>

      <details className="card-options" open={Boolean(distanceKm || state.fieldErrors.distanceKm?.length)}>
      <summary>Estimate fuel costs & CO₂ savings</summary>
      <RideEstimatePanel
        consumption={estimateConsumption}
        distanceKm={distanceKm}
        fuelPrices={fuelPrices}
        fuelType={estimateFuelType}
        onDistanceChange={setDistanceKm}
        onUseSuggestion={(price) => setPricePerSeatMkd(price.toString())}
        seats={seatsTotal}
      />
      </details>

      <fieldset className="form-section">
        <legend className="pr-3 text-lg font-semibold text-slate-800">Ride preferences</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {RIDE_TAGS.map((tag) => (
            <label
              className="flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700"
              key={tag}
            >
              <input
                checked={values.tags.includes(tag)}
                onChange={(event) => onChange({ ...values, tags: event.target.checked ? [...values.tags, tag] : values.tags.filter(t => t !== tag) })}
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
          value={values.genderPreference}
          onChange={(event) => onChange({ ...values, genderPreference: event.target.value === "same_as_driver" ? "same_as_driver" : "any" })}
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
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
          maxLength={2_000}
          name="notes"
          placeholder="Luggage, timing, or pickup details passengers should know"
        />
        <FieldError errors={state.fieldErrors.notes} />
      </label>

      {state.message ? (
        <div
          aria-live="polite"
          role={state.status === "error" ? "alert" : "status"}
          tabIndex={-1}
          className={`rounded-xl border p-4 text-sm ${
            state.status === "success"
              ? "border-brand-300 bg-brand-50 text-brand-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {state.message}
          {state.rideId ? <span className="ml-1">Opening My trips…</span> : null}
          {Object.keys(state.fieldErrors).length ? <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(state.fieldErrors).map(([field, errors]) => <li key={field}>{errors[0]}</li>)}</ul> : null}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
        <p className="text-sm text-slate-500 sm:mr-auto sm:max-w-xs">Drafts are private. Published rides are visible to students, and you approve each seat request.</p>
        <button
          className="btn-secondary disabled:opacity-50"
          disabled={pending || savingCar || state.status === "success"}
          name="intent"
          type="submit"
          value="save_draft"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button
          className="btn-primary disabled:opacity-50"
          disabled={pending || savingCar || state.status === "success"}
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
    <section className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5">
      <h2 className="font-semibold text-brand-950">Fair-price and CO₂ estimate</h2>
      <p className="mt-1 text-sm text-brand-900/75">
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
          The {supportedFuel} price estimate is unavailable right now. Enter your price per seat above.
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
              className="btn-primary"
              onClick={() => onUseSuggestion(estimate.pricePerSeatMkd)}
              type="button"
            >
              Use {estimate.pricePerSeatMkd} MKD suggestion
            </button>
            <p className="mt-2 text-xs text-brand-900/70">
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
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

type NewCarFieldsProps = {
  consumption: string;
  values: OfferValues;
  onChange: (values: OfferValues) => void;
  onConsumptionChange: (value: string) => void;
};

function NewCarFields({
  consumption,
  values, onChange,
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
          value={values.carSeatsTotal}
          onChange={(event) => onChange({ ...values, carSeatsTotal: event.target.value })}
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
          value={values.carColor}
          onChange={(event) => onChange({ ...values, carColor: event.target.value })}
          name="carColor"
        />
      </label>
      <label className="font-medium text-slate-800">
        Last 3 plate characters (optional)
        <input
          className={inputClass}
          value={values.plateLast3}
          onChange={(event) => onChange({ ...values, plateLast3: event.target.value })}
          maxLength={3}
          name="plateLast3"
          placeholder="123"
        />
      </label>
    </>
  );
}
