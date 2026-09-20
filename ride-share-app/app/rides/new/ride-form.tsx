"use client";

import { useActionState, useMemo, useState } from "react";

import type { Tables } from "@/lib/supabase/database.types";
import { RIDE_TAGS, type RideDraft } from "@/lib/rides/ride-draft";

import { createRide, type CreateRideFormState } from "./actions";

type City = Pick<Tables<"cities">, "id" | "name_en" | "name_mk">;
type PickupPoint = Pick<Tables<"pickup_points">, "id" | "city_id" | "name_en" | "name_mk">;
type Car = Pick<Tables<"cars">, "id" | "make" | "model" | "color" | "plate_last3">;
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
  pickupPoints: PickupPoint[];
  initialDraft: RideDraft;
  submissionId: string;
  usingDevelopmentFixture: boolean;
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
  pickupPoints,
  initialDraft,
  submissionId,
  usingDevelopmentFixture,
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

  let departureAt = "";
  if (departureLocal) {
    const parsedDeparture = new Date(departureLocal);
    if (!Number.isNaN(parsedDeparture.getTime())) departureAt = parsedDeparture.toISOString();
  }

  const source = usingDevelopmentFixture ? initialDraft.source : "native";

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="importId" value={initialDraft.importId ?? ""} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="departureAt" value={departureAt} />

      {usingDevelopmentFixture ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Development-only imported draft loaded. It can be reviewed, but cannot be saved until a
          real import record exists.
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
            defaultValue={initialDraft.seatsTotal ?? ""}
            max={8}
            min={1}
            name="seatsTotal"
            required
            type="number"
          />
          <FieldError errors={state.fieldErrors.seatsTotal} />
        </label>

        <label className="font-medium text-slate-800">
          Price per seat (MKD)
          <input
            className={inputClass}
            defaultValue={initialDraft.pricePerSeatMkd ?? ""}
            min={0}
            name="pricePerSeatMkd"
            required
            step={1}
            type="number"
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
              defaultValue={initialDraft.carId ?? ""}
              name="carId"
              required
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
                defaultValue={initialDraft.car?.fuelType ?? "petrol"}
                name="fuelType"
                required
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
