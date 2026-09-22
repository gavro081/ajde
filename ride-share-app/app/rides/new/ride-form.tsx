"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { departureInstant, type OfferValues } from "@/lib/rides/offer-values";

import type { Tables } from "@/lib/supabase/database.types";
import { RIDE_TAGS, type RideDraft } from "@/lib/rides/ride-draft";
import type { FuelPriceConfig } from "@/lib/rides/fuel-price-config";
import { calculateRideEstimate } from "@/lib/rides/ride-estimate";
import { DateTimeField } from "@/components/date-time-field";
import { RIDE_LIMITS } from "@/lib/rides/ride-limits";

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
  const priceRef = useRef<HTMLInputElement>(null);
  const [priceFilled, setPriceFilled] = useState(false);
  useEffect(() => {
    if (!priceFilled) return;
    const timer = setTimeout(() => setPriceFilled(false), 1600);
    return () => clearTimeout(timer);
  }, [priceFilled]);
  /** Applies the suggested price, then brings the field into view and briefly highlights it. */
  function applySuggestedPrice(price: number) {
    setPricePerSeatMkd(price.toString());
    setPriceFilled(true);
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    priceRef.current?.scrollIntoView?.({ behavior: smooth ? "smooth" : "auto", block: "center" });
  }
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
  const selectedCarCapacity = carMode === "existing" ? selectedExistingCar?.seats_total : Number(values.carSeatsTotal) || undefined;
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
      onInvalidCapture={(event) => {
        // Reveal invalid optional fields before the browser tries to focus them.
        const details = (event.target as HTMLElement).closest("details");
        if (details) details.open = true;
      }}
      className="ride-form space-y-5"
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
              max={Math.min(selectedCarCapacity ?? RIDE_LIMITS.seats.max, RIDE_LIMITS.seats.max)}
              min={RIDE_LIMITS.seats.min}
              step={1}
              name="seatsTotal"
              placeholder={`1–${Math.min(selectedCarCapacity ?? RIDE_LIMITS.seats.max, RIDE_LIMITS.seats.max)}`}
              aria-invalid={Boolean(state.fieldErrors.seatsTotal) || undefined}
              aria-describedby={state.fieldErrors.seatsTotal ? "seats-hint seats-error" : "seats-hint"}
              onChange={(event) => setSeatsTotal(event.target.value)}
              required
              type="number"
              value={seatsTotal}
            />
            <span id="seats-hint" className="sr-only">Choose how many seats to offer for this ride</span>
            <FieldError id="seats-error" errors={state.fieldErrors.seatsTotal} />
          </label>
          <label className="font-medium text-slate-800">
            Price per seat (MKD)
            <input
              ref={priceRef}
              className={`${inputClass} ${priceFilled ? "ring-4 ring-brand-200" : ""}`}
              min={RIDE_LIMITS.priceMkd.min}
              max={RIDE_LIMITS.priceMkd.max}
              title="0–3,000 MKD per seat; leave empty or enter 0 for a free ride"
              placeholder="Free"
              name="pricePerSeatMkd"
              aria-invalid={Boolean(state.fieldErrors.pricePerSeatMkd) || undefined}
              aria-describedby={state.fieldErrors.pricePerSeatMkd ? "price-hint price-error" : "price-hint"}
              onChange={(event) => setPricePerSeatMkd(event.target.value)}
              step={1}
              type="number"
              value={pricePerSeatMkd}
            />
            <span id="price-hint" className="mt-1 block text-[.75rem] font-normal text-slate-500">Leave empty or enter 0 to offer the ride free of charge.</span>
            <FieldError id="price-error" errors={state.fieldErrors.pricePerSeatMkd} />
          </label>
        </div>
        <p className="text-[.75rem] text-slate-500">Departure is in Skopje local time.</p>
        <details className="ride-form-options" open={Boolean(originPickupId || destinationPickupId || state.fieldErrors["origin.pickupPointId"] || state.fieldErrors["destination.pickupPointId"])}>
        <summary>Pickup & drop-off points <span className="font-normal text-slate-500">· optional</span></summary>
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
        </details>
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
                    maxLength={RIDE_LIMITS.modelLength}
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
                    minLength={1}
                    maxLength={RIDE_LIMITS.makeLength}
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
                    minLength={1}
                    maxLength={RIDE_LIMITS.modelLength}
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

      <details className="ride-form-options" open={Boolean(state.fieldErrors.distanceKm?.length)}>
      <summary>Estimate fuel costs & CO₂ savings</summary>
      <RideEstimatePanel
        consumption={estimateConsumption}
        distanceKm={distanceKm}
        fuelPrices={fuelPrices}
        fuelType={estimateFuelType}
        onDistanceChange={setDistanceKm}
        onUseSuggestion={applySuggestedPrice}
        seats={seatsTotal}
      />
      </details>

      <details className="ride-form-options" open={values.tags.length > 0 || values.genderPreference !== "any" || Boolean(state.fieldErrors.tags?.length || state.fieldErrors.genderPreference?.length)}>
        <summary>Preferences</summary>
        <fieldset>
          <legend className="font-medium text-slate-800">Ride</legend>
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

        <label className="mt-6 block font-medium text-slate-800">
          Passengers
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
      </details>

      <details className="ride-form-options" open={Boolean(values.notes || state.fieldErrors.notes?.length)}>
      <summary>Notes for passengers <span className="font-normal text-slate-500">· optional</span></summary>
      <label className="block font-medium text-slate-800">
        Notes
        <textarea
          className={`${inputClass} min-h-28 resize-y`}
          value={values.notes}
          onChange={(event) => onChange({ ...values, notes: event.target.value })}
          maxLength={RIDE_LIMITS.notesLength}
          name="notes"
          placeholder="Luggage, timing, or pickup details passengers should know"
        />
        <FieldError errors={state.fieldErrors.notes} />
      </label>
      </details>

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
        <p className="text-[.8125rem] text-slate-500 sm:mr-auto sm:max-w-xs">You approve each seat request.</p>
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
  const [tolls, setTolls] = useState("0");
  const tollsMkd = Number(tolls) > 0 ? Number(tolls) : 0;
  const hasSeats = Number(seats) > 0;
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
    Object.values(numericInput).every((value) => Number.isFinite(value) && value > 0) &&
    numericInput.distanceKm >= RIDE_LIMITS.distanceKm.min && numericInput.distanceKm <= RIDE_LIMITS.distanceKm.max &&
    numericInput.consumptionL100Km >= RIDE_LIMITS.consumptionL100Km.min && numericInput.consumptionL100Km <= RIDE_LIMITS.consumptionL100Km.max &&
    numericInput.seats <= RIDE_LIMITS.seats.max &&
    Number.isInteger(Number(tolls)) && Number(tolls) >= RIDE_LIMITS.tollsMkd.min && Number(tolls) <= RIDE_LIMITS.tollsMkd.max
  ) {
    try {
      estimate = calculateRideEstimate({ ...numericInput, fuelType: supportedFuel, tollsMkd });
    } catch {
      estimate = null;
    }
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5">
      <h2 className="font-semibold text-brand-950">Fair-price and CO₂ estimate</h2>
      <p className="mt-1 text-sm text-brand-900/75">
        Fuel and tolls are split across the offered passenger seats. The price remains editable.
      </p>
      <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
        <label className="block font-medium text-slate-800">
          Estimated route distance (km)
          <input
            className={inputClass}
            min={RIDE_LIMITS.distanceKm.min}
            max={RIDE_LIMITS.distanceKm.max}
            title="1–600 km"
            placeholder="1–600"
            name="distanceKm"
            onChange={(event) => onDistanceChange(event.target.value)}
            step="0.1"
            type="number"
            value={distanceKm}
          />
        </label>
        <label className="block font-medium text-slate-800">
          Tolls (MKD)
          <input
            className={inputClass}
            inputMode="numeric"
            min={RIDE_LIMITS.tollsMkd.min}
            max={RIDE_LIMITS.tollsMkd.max}
            title="0–2,000 MKD for the whole trip"
            onChange={(event) => setTolls(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            step="1"
            type="number"
            value={tolls}
          />
        </label>
      </div>
      {!hasSeats ? (
        <p className="mt-3 text-sm text-slate-500">Enter the number of available seats to get an estimate.</p>
      ) : null}

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
            label={tollsMkd > 0 ? "Fuel + tolls" : "Fuel cost"}
            value={`${Math.round(estimate.totalTripCostMkd)} MKD`}
          />
          <EstimateValue label="Suggested seat" value={`${estimate.pricePerSeatMkd} MKD`} />
          <EstimateValue
            label="Potential CO₂ saved"
            value={`${estimate.potentialCo2SavedKg.toFixed(1)} kg`}
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              className="btn-primary disabled:opacity-50"
              disabled={estimate.pricePerSeatMkd > RIDE_LIMITS.priceMkd.max}
              onClick={() => onUseSuggestion(estimate.pricePerSeatMkd)}
              type="button"
            >
              Use {estimate.pricePerSeatMkd} MKD suggestion
            </button>
            {estimate.pricePerSeatMkd > RIDE_LIMITS.priceMkd.max && <p className="mt-2 text-sm text-amber-800">This estimate exceeds the 3,000 MKD limit. Review the distance, consumption and tolls.</p>}
            <p className="mt-2 text-xs text-brand-900/70">
              Assumes {fuelPrice} MKD/L{tollsMkd > 0 ? `, ${Math.round(tollsMkd)} MKD in tolls` : ""} and {supportedFuel === "petrol" ? "2.31" : "2.68"} kg CO₂
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
          min={RIDE_LIMITS.consumptionL100Km.min}
          max={RIDE_LIMITS.consumptionL100Km.max}
          title="0.5–30 L/100 km"
          placeholder="0.5–30"
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
          max={RIDE_LIMITS.seats.max}
          min={RIDE_LIMITS.seats.min}
          step={1}
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
          maxLength={RIDE_LIMITS.colorLength}
        />
      </label>
      <label className="font-medium text-slate-800">
        Last 3 plate characters (optional)
        <input
          className={inputClass}
          value={values.plateLast3}
          onChange={(event) => onChange({ ...values, plateLast3: event.target.value })}
          maxLength={3}
          minLength={3}
          pattern="[A-Za-z0-9]{3}"
          title="Exactly 3 letters or numbers"
          name="plateLast3"
          placeholder="123"
        />
      </label>
    </>
  );
}
