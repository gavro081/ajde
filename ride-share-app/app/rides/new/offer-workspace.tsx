"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RideForm, type RideFormProps, type Car } from "./ride-form";
import { createRide, type CreateRideFormState } from "./actions";
import { type OfferValues } from "@/lib/rides/offer-values";
import { emptyOfferDraft, offerInterpretationSchema } from "@/lib/rides/offer-interpretation";
import { applyOfferTrip, createOfferTab, editOfferTab, type OfferTab } from "@/lib/rides/offer-tabs";
import { OfferDistance, type UpdateOfferTab } from "./offer-distance";
import { offerRecoverySchema, validateRecoveredTab } from "@/lib/rides/offer-recovery";

export type OfferWorkspaceProps = Omit<RideFormProps, "values" | "onChange" | "onSubmit" | "state" | "pending" | "onCarSaved" | "onCarSaving"> & { userId: string };
const idle: CreateRideFormState = { status: "idle", message: "", fieldErrors: {} };

const subscribeHydration = () => () => {};
export function OfferWorkspace(props: OfferWorkspaceProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  return hydrated ? <WorkspaceSession key={`${props.userId}:${props.initialDraft.importId ?? "native"}`} {...props} /> : <p role="status">Restoring ride drafts…</p>;
}

function WorkspaceSession(props: OfferWorkspaceProps) {
  const router = useRouter();
  const [cars, setCars] = useState(props.cars);
  const [savingCar, setSavingCar] = useState(false);
  const storageKey = `ride-offers:v1:${props.userId}:${props.initialDraft.importId ?? "native"}`;
  const [initial] = useState(() => {
    const draft = !props.initialDraft.carId && !props.initialDraft.car && props.cars.length === 1
      ? { ...props.initialDraft, carId: props.cars[0].id }
      : props.initialDraft;
    const fresh = { tabs: [createOfferTab(draft, props.submissionId)], activeId: props.submissionId, text: "", filled: false, message: "" };
    if (!draft.carId && !draft.car && props.cars.length > 1) fresh.tabs[0].values.carMode = "existing";
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return fresh;
      const recovered = offerRecoverySchema.parse(JSON.parse(raw));
      if (recovered.userId !== props.userId) throw new Error("Different account");
      return { ...recovered, tabs: recovered.tabs.map(tab => validateRecoveredTab(tab, props)), message: "Your ride drafts were restored for this session." };
    } catch { return { ...fresh, message: "Saved drafts could not be restored. You can still complete the form manually." }; }
  });
  const [tabs, setTabs] = useState(initial.tabs);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [text, setText] = useState(initial.text);
  const [undo, setUndo] = useState<Record<string, OfferTab>>({});
  const [message, setMessage] = useState(initial.message);
  const [storageMessage, setStorageMessage] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [filled, setFilled] = useState(initial.filled);
  const [retry, setRetry] = useState<{ append: boolean } | null>(null);
  const [states, setStates] = useState<Record<string, CreateRideFormState>>({});
  const [publishing, setPublishing] = useState<string[]>([]);
  const locks = useRef(new Set<string>());
  const interpretationEpoch = useRef(0);
  const tabsRef = useRef(tabs);
  useLayoutEffect(() => { tabsRef.current = tabs; }, [tabs]);
  const drafts = useMemo(() => tabs.filter(item => !item.publishedId), [tabs]);
  const tab = drafts.find(item => item.id === activeId) ?? drafts[0];
  const update: UpdateOfferTab = useCallback((id, transform) => {
    setTabs(previous => previous.map(item => item.id === id ? transform(item) : item));
  }, []);
  useEffect(() => {
    let status: string;
    try {
      if (!drafts.length) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, userId: props.userId, tabs: drafts, activeId: tab.id, text, filled }));
      status = "Saved for this session";
    } catch { status = "Session recovery is unavailable. Keep this page open until you publish."; }
    // This effect synchronizes browser storage and reports the external write result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageMessage(status);
    if (!drafts.length) router.replace("/dashboard/trips?view=driver");
  }, [storageKey, props.userId, drafts, tab, text, filled, router]);

  function change(values: OfferValues) {
    update(tab.id, previous => previous.publishedId ? previous : editOfferTab(previous, values));
  }
  function carSaved(car: Car) {
    setCars(previous => [...previous.filter(item => item.id !== car.id), car]);
    update(tab.id, previous => editOfferTab(previous, { ...previous.values, carMode: "existing", existingCarId: car.id }));
  }
  async function fill(append = false) {
    const target = tab;
    const epoch = ++interpretationEpoch.current;
    setInterpreting(true); setMessage(""); setRetry(null);
    try {
      const response = await fetch("/api/rides/interpret", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: "create" }), signal: AbortSignal.timeout(25000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Interpretation failed. Retry or complete the form manually.");
      const result = offerInterpretationSchema.parse(body);
      if (epoch !== interpretationEpoch.current) throw new Error("The description changed. Retry to apply the new text.");
      const current = tabsRef.current.find(item => item.id === target.id);
      if (!append && (!current || current.revision !== target.revision || current.publishedId || locks.current.has(target.id))) throw new Error("The form changed. Retry to apply your description.");
      if (!append && current) setUndo(previous => ({ ...previous, [target.id]: current }));
      const extra = result.trips.slice(append ? 0 : 1).map(trip => applyOfferTrip(createOfferTab(emptyOfferDraft(), crypto.randomUUID()), trip));
      setTabs(previous => append ? [...previous, ...extra] : [...previous.map(item => item.id === target.id && item.revision === target.revision && !item.publishedId ? applyOfferTrip(item, result.trips[0]) : item), ...extra]);
      if (append && extra[0]) setActiveId(extra[0].id);
      setFilled(true); setMessage("Details filled. Edit the form directly and review each ride before publishing.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Interpretation failed. Retry."); setRetry({ append }); }
    finally { setInterpreting(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = tab.id;
    if (locks.current.has(id) || tab.publishedId || savingCar) return;
    locks.current.add(id);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter instanceof HTMLButtonElement && submitter.value === "save_draft" ? "save_draft" : "publish";
    const data = new FormData(event.currentTarget); data.set("intent", intent);
    setPublishing(previous => [...previous, id]);
    try {
      const result = await createRide(idle, data);
      setStates(previous => ({ ...previous, [id]: result }));
      if (result.status === "success" && result.rideId) {
        interpretationEpoch.current += 1;
        update(id, previous => ({ ...previous, publishedId: result.rideId!, revision: previous.revision + 1 }));
        setMessage(`${result.message} Continue with your remaining drafts.`);
      }
    } catch {
      setStates(previous => ({ ...previous, [id]: { ...idle, status: "error", message: "Publication failed. Please retry." } }));
    } finally { locks.current.delete(id); setPublishing(previous => previous.filter(value => value !== id)); }
  }
  function label(item: OfferTab, index: number) {
    const origin = props.cities.find(city => String(city.id) === item.values.originCityId)?.name_en;
    const destination = props.cities.find(city => String(city.id) === item.values.destinationCityId)?.name_en;
    return `${origin ?? "Ride " + (index + 1)} to ${destination ?? "choose destination"} ${item.values.departureLocal.replace("T", " ")}`;
  }
  if (!tab) return <p role="status">All rides saved. Opening My trips…</p>;
  return <div className="space-y-6">
    {storageMessage && <p role="status" className="text-sm text-slate-600">{storageMessage}</p>}
    {drafts.map(item => <OfferDistance key={item.id} tab={item}
      origin={props.cities.find(city => String(city.id) === item.values.originCityId)?.name_en}
      destination={props.cities.find(city => String(city.id) === item.values.destinationCityId)?.name_en} update={update} />)}
    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4 sm:p-5">
    <p className="eyebrow mb-2">Start with a description</p>
    <label className="block font-semibold text-slate-900">Describe your rides<textarea className="field mt-3 min-h-28 resize-y bg-white font-normal" maxLength={6000} placeholder="Going skp to bt 4pm Saturday with a Clio" value={text} onChange={event => { setText(event.target.value); interpretationEpoch.current += 1; }} /></label>
    <p className="field-help mb-4">Describe one trip or a return journey. Review and edit each draft below before publishing.</p>
    <button className="btn-primary disabled:opacity-50" type="button" disabled={savingCar || interpreting || !text.trim() || publishing.length > 0}
      onClick={() => { void fill(filled); }}>{interpreting ? "Filling…" : filled ? "Create more drafts" : "Fill form"}</button>
    </div>
    {message && <p role="status">{message}</p>}
    {retry && <button type="button" className="btn-secondary" disabled={savingCar || interpreting || publishing.length > 0 || Boolean(tab.publishedId)} onClick={() => { void fill(retry.append); }}>Retry</button>}
    <div role="tablist" aria-label="Ride drafts" className="flex flex-wrap gap-2">
      {drafts.map((item, index) => <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`}
        aria-selected={item.id === tab.id} tabIndex={item.id === tab.id ? 0 : -1}
        disabled={savingCar}
        className={`min-w-0 max-w-full rounded-full border px-4 py-2 text-left text-sm font-semibold break-words ${item.id === tab.id ? "bg-brand-600 border-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        onClick={() => setActiveId(item.id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % drafts.length : event.key === "ArrowLeft" ? (index + drafts.length - 1) % drafts.length : event.key === "Home" ? 0 : event.key === "End" ? drafts.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); setActiveId(drafts[next].id); document.getElementById(`tab-${drafts[next].id}`)?.focus(); }
        }}>{label(item, index)}</button>)}
    </div>
    <section role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}>
        {undo[tab.id] && <button type="button" className="btn-secondary mb-4" disabled={savingCar || publishing.includes(tab.id)} onClick={() => {
          const previous = undo[tab.id];
          update(tab.id, current => current.publishedId ? current : { ...previous, revision: current.revision + 1, distanceEpoch: current.distanceEpoch + 1 });
          setUndo(current => { const next = { ...current }; delete next[tab.id]; return next; });
          setMessage("Previous draft restored.");
        }}>Undo fill</button>}
        {tab.warnings.length > 0 && <div role="status" className="mb-4 rounded-xl bg-amber-50 p-3"><p>Review these details:</p><ul>{tab.warnings.map((warning, i) => <li key={i}>{warning.message}</li>)}</ul></div>}
        {tab.distanceMessage && <p role="status" className="mb-3">{tab.distanceMessage} {tab.distanceMode === "error" && <button type="button" className="underline" onClick={() => update(tab.id, previous => ({ ...previous, distanceMode: "auto", distanceEpoch: previous.distanceEpoch + 1 }))}>Retry distance</button>}</p>}
        <fieldset disabled={savingCar || publishing.includes(tab.id)} className="min-w-0">
          <RideForm {...props} cars={cars} onCarSaved={carSaved} onCarSaving={setSavingCar} key={tab.id} submissionId={tab.id} initialDraft={{ ...emptyOfferDraft(), source: tab.source, importId: tab.importId }}
            isImportedDraft={tab.source === "imported"} values={tab.values} onChange={change} onSubmit={submit} pending={publishing.includes(tab.id)} state={states[tab.id] ?? idle} />
        </fieldset>
        {drafts.length > 1 && <button className="mt-4 text-sm underline" type="button" disabled={savingCar || publishing.includes(tab.id)} onClick={() => {
          const remaining = drafts.filter(item => item.id !== tab.id); setTabs(previous => previous.filter(item => item.id !== tab.id)); setActiveId(remaining[0].id);
        }}>Discard this draft</button>}
    </section>
    <p className="text-xs text-slate-500">City-to-city routing by <a href="https://project-osrm.org/" className="underline">OSRM</a>, data © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>. <a href="https://www.openstreetmap.org/fixthemap" className="underline">Fix the map</a>. Estimates may differ from your journey.</p>
  </div>;
}
