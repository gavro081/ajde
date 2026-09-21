"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { RideForm, type RideFormProps } from "./ride-form";
import { createRide, type CreateRideFormState } from "./actions";
import { type OfferValues } from "@/lib/rides/offer-values";
import { emptyOfferDraft, offerInterpretationSchema } from "@/lib/rides/offer-interpretation";
import { applyOfferTrip, createOfferTab, editOfferTab, type OfferTab } from "@/lib/rides/offer-tabs";
import { OfferDistance, type UpdateOfferTab } from "./offer-distance";
import { offerRecoverySchema, validateRecoveredTab } from "@/lib/rides/offer-recovery";

export type OfferWorkspaceProps = Omit<RideFormProps, "values" | "onChange" | "onSubmit" | "state" | "pending"> & { userId: string };
const idle: CreateRideFormState = { status: "idle", message: "", fieldErrors: {} };

const subscribeHydration = () => () => {};
export function OfferWorkspace(props: OfferWorkspaceProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  return hydrated ? <WorkspaceSession key={`${props.userId}:${props.initialDraft.importId ?? "native"}`} {...props} /> : <p role="status">Restoring ride drafts…</p>;
}

function WorkspaceSession(props: OfferWorkspaceProps) {
  const storageKey = `ride-offers:v1:${props.userId}:${props.initialDraft.importId ?? "native"}`;
  const [initial] = useState(() => {
    const fresh = { tabs: [createOfferTab(props.initialDraft, props.submissionId)], activeId: props.submissionId, text: "", correction: "", filled: false, message: "" };
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
  const [correction, setCorrection] = useState(initial.correction);
  const [undo, setUndo] = useState<Record<string, OfferTab>>({});
  const [message, setMessage] = useState(initial.message);
  const [storageMessage, setStorageMessage] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [filled, setFilled] = useState(initial.filled);
  const [retry, setRetry] = useState<{ append: boolean; correct: boolean } | null>(null);
  const [states, setStates] = useState<Record<string, CreateRideFormState>>({});
  const [publishing, setPublishing] = useState<string[]>([]);
  const locks = useRef(new Set<string>());
  const interpretationEpoch = useRef(0);
  const tabsRef = useRef(tabs);
  useLayoutEffect(() => { tabsRef.current = tabs; }, [tabs]);
  const tab = tabs.find(item => item.id === activeId) ?? tabs[0];
  const update: UpdateOfferTab = useCallback((id, transform) => {
    setTabs(previous => previous.map(item => item.id === id ? transform(item) : item));
  }, []);
  useEffect(() => {
    let status: string;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, userId: props.userId, tabs, activeId, text, correction, filled }));
      status = "Saved for this session";
    } catch { status = "Session recovery is unavailable. Keep this page open until you publish."; }
    // This effect synchronizes browser storage and reports the external write result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageMessage(status);
  }, [storageKey, props.userId, tabs, activeId, text, correction, filled]);

  function change(values: OfferValues) {
    update(tab.id, previous => previous.publishedId ? previous : editOfferTab(previous, values));
  }
  async function fill(append = false, correct = false) {
    const target = tab;
    const epoch = ++interpretationEpoch.current;
    setInterpreting(true); setMessage(""); setRetry(null);
    try {
      const response = await fetch("/api/rides/interpret", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: correct ? correction : text, mode: correct ? "correct" : "create", ...(correct ? { current: target.values } : {}) }), signal: AbortSignal.timeout(25000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Interpretation failed. Retry or complete the form manually.");
      const result = offerInterpretationSchema.parse(body);
      if (epoch !== interpretationEpoch.current) throw new Error("The description changed. Retry to apply the new text.");
      if (correct && result.trips.length !== 1) throw new Error("Correct one trip, or use Create more drafts.");
      const current = tabsRef.current.find(item => item.id === target.id);
      if (!append && (!current || current.revision !== target.revision || current.publishedId || locks.current.has(target.id))) throw new Error("The form changed. Retry to apply your description.");
      if (!append && current) setUndo(previous => ({ ...previous, [target.id]: current }));
      const extra = result.trips.slice(append ? 0 : 1).map(trip => applyOfferTrip(createOfferTab(emptyOfferDraft(), crypto.randomUUID()), trip));
      setTabs(previous => append ? [...previous, ...extra] : [...previous.map(item => item.id === target.id && item.revision === target.revision && !item.publishedId ? applyOfferTrip(item, result.trips[0]) : item), ...extra]);
      if (append && extra[0]) setActiveId(extra[0].id);
      setFilled(true); setMessage("Details filled. Review each ride before publishing.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Interpretation failed. Retry."); setRetry({ append, correct }); }
    finally { setInterpreting(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = tab.id;
    if (locks.current.has(id) || tab.publishedId) return;
    locks.current.add(id);
    const data = new FormData(event.currentTarget); data.set("intent", "publish");
    setPublishing(previous => [...previous, id]);
    try {
      const result = await createRide(idle, data);
      setStates(previous => ({ ...previous, [id]: result }));
      if (result.status === "success" && result.rideId) update(id, previous => ({ ...previous, publishedId: result.rideId!, revision: previous.revision + 1 }));
    } catch {
      setStates(previous => ({ ...previous, [id]: { ...idle, status: "error", message: "Publication failed. Please retry." } }));
    } finally { locks.current.delete(id); setPublishing(previous => previous.filter(value => value !== id)); }
  }
  function label(item: OfferTab, index: number) {
    const origin = props.cities.find(city => String(city.id) === item.values.originCityId)?.name_en;
    const destination = props.cities.find(city => String(city.id) === item.values.destinationCityId)?.name_en;
    return `${origin ?? "Ride " + (index + 1)} → ${destination ?? "choose destination"} ${item.values.departureLocal.replace("T", " ")}${item.publishedId ? " · Published" : ""}`;
  }
  return <div className="space-y-6">
    {storageMessage && <p role="status" className="text-sm text-slate-600">{storageMessage}</p>}
    {tabs.map(item => <OfferDistance key={item.id} tab={item}
      origin={props.cities.find(city => String(city.id) === item.values.originCityId)?.name_en}
      destination={props.cities.find(city => String(city.id) === item.values.destinationCityId)?.name_en} update={update} />)}
    <label className="block font-medium">Describe your rides<textarea className="mt-2 block w-full rounded-xl border p-3" maxLength={6000} placeholder="Going skp to bt 4pm Saturday with a Clio" value={text} onChange={event => { setText(event.target.value); interpretationEpoch.current += 1; }} /></label>
    <button className="btn-primary" type="button" disabled={interpreting || !text.trim() || publishing.length > 0}
      onClick={() => { void fill(filled || Boolean(tab.publishedId)); }}>{interpreting ? "Filling…" : filled || tab.publishedId ? "Create more drafts" : "Fill form"}</button>
    {message && <p role="status">{message}</p>}
    {retry && <button type="button" className="btn-secondary" disabled={interpreting || publishing.length > 0 || Boolean(tab.publishedId)} onClick={() => { void fill(retry.append, retry.correct); }}>Retry</button>}
    <div role="tablist" aria-label="Ride drafts" className="flex flex-wrap gap-2">
      {tabs.map((item, index) => <button key={item.id} type="button" role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`}
        aria-selected={item.id === tab.id} tabIndex={item.id === tab.id ? 0 : -1}
        className={`rounded-xl border px-3 py-2 text-sm ${item.id === tab.id ? "bg-emerald-50 border-emerald-600" : ""}`}
        onClick={() => setActiveId(item.id)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); setActiveId(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }
        }}>{label(item, index)}</button>)}
    </div>
    <section role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}>
      {tab.publishedId ? <p role="status">Published. <a className="underline" href={`/rides/${tab.publishedId}`}>View ride</a></p> : <>
        <div className="mb-6 space-y-3 rounded-xl bg-slate-50 p-4">
          <label className="block font-medium">Correct this ride<input className="mt-2 block w-full rounded-lg border p-2" value={correction} maxLength={6000}
            placeholder="Actually Sunday at 5pm" onChange={event => { setCorrection(event.target.value); interpretationEpoch.current += 1; }} /></label>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" disabled={interpreting || publishing.includes(tab.id) || !correction.trim()} onClick={() => { void fill(false, true); }}>Update this draft</button>
            {undo[tab.id] && <button type="button" className="btn-secondary" disabled={publishing.includes(tab.id)} onClick={() => {
              const previous = undo[tab.id];
              update(tab.id, current => current.publishedId ? current : { ...previous, revision: current.revision + 1, distanceEpoch: current.distanceEpoch + 1 });
              setUndo(current => { const next = { ...current }; delete next[tab.id]; return next; });
              setMessage("Previous draft restored.");
            }}>Undo fill</button>}
          </div>
        </div>
        {tab.warnings.length > 0 && <div role="status" className="mb-4 rounded-xl bg-amber-50 p-3"><p>Review these details:</p><ul>{tab.warnings.map((warning, i) => <li key={i}>{warning.message}</li>)}</ul></div>}
        {tab.distanceMessage && <p role="status" className="mb-3">{tab.distanceMessage} {tab.distanceMode === "error" && <button type="button" className="underline" onClick={() => update(tab.id, previous => ({ ...previous, distanceMode: "auto", distanceEpoch: previous.distanceEpoch + 1 }))}>Retry distance</button>}</p>}
        <fieldset disabled={publishing.includes(tab.id)} className="min-w-0">
          <RideForm {...props} key={tab.id} submissionId={tab.id} initialDraft={{ ...emptyOfferDraft(), source: tab.source, importId: tab.importId }}
            isImportedDraft={tab.source === "imported"} values={tab.values} onChange={change} onSubmit={submit} pending={publishing.includes(tab.id)} state={states[tab.id] ?? idle} />
        </fieldset>
        {tabs.length > 1 && <button className="mt-4 text-sm underline" type="button" disabled={publishing.includes(tab.id)} onClick={() => {
          const remaining = tabs.filter(item => item.id !== tab.id); setTabs(remaining); setActiveId(remaining[0].id);
        }}>Discard this draft</button>}
      </>}
    </section>
    <p className="text-xs text-slate-500">City-to-city routing by <a href="https://project-osrm.org/" className="underline">OSRM</a>, data © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>. <a href="https://www.openstreetmap.org/fixthemap" className="underline">Fix the map</a>. Estimates may differ from your journey.</p>
  </div>;
}
