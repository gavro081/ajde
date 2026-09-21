"use client";

import { useState, useTransition } from "react";
import { createTripShare, revokeTripShare } from "@/lib/sharing/actions";
import type { OwnedTripShare } from "@/lib/sharing/types";

export function TripShareControls({ bookingId, expiresAt, expired }: { bookingId: string; expiresAt: string; expired: boolean }) {
  const [share, setShare] = useState<OwnedTripShare | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const result = await createTripShare(bookingId);
        if (!result.ok) { setError(result.error); return; }
        setShare(result.share);
        setUrl(`${window.location.origin}/trip/${result.share.token}`);
        setMessage("Trip link ready. Anyone with this link can see the limited itinerary.");
      } catch { setError("Unable to create a link. Please try again."); }
    });
  }

  async function copy() {
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Trip link copied.");
    } catch { setError("Could not copy automatically. Select and copy the link below."); }
  }

  function revoke() {
    if (!share) return;
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const result = await revokeTripShare(bookingId, share.id);
        if (!result.ok) { setError(result.error); return; }
        setShare(null);
        setUrl("");
        setMessage("Trip link revoked. New visits cannot open it.");
      } catch { setError("Unable to revoke the link. Please try again."); }
    });
  }

  return <section className="mt-4 rounded-xl border border-slate-200 p-4" aria-label="Share itinerary">
    <h2 className="font-semibold">Share itinerary with a parent</h2>
    <p className="mt-1 text-sm text-slate-600">A shared itinerary, not live tracking. Contacts and other passengers are not included.</p>
    <p className="mt-1 text-sm text-slate-600">{expired ? "Sharing has expired." : `Link access expires ${new Date(expiresAt).toLocaleString("en-GB", { timeZone: "Europe/Skopje" })} (Skopje time), 24 hours after departure.`}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      {!share ? <button type="button" disabled={pending || expired} onClick={create} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Creating…" : "Create or retrieve link"}</button> : <>
        <button type="button" disabled={pending || expired} onClick={copy} className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Copy link</button>
        <button type="button" disabled={pending} onClick={revoke} className="min-h-11 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{pending ? "Revoking…" : "Revoke link"}</button>
      </>}
    </div>
    {url ? <label className="mt-3 block text-sm">Trip link<input aria-label="Trip link" readOnly value={url} onFocus={event => event.target.select()} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm" /></label> : null}
    {message ? <p role="status" className="mt-2 text-sm text-emerald-800">{message}</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
  </section>;
}
