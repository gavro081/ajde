"use client";

import { useState, useTransition } from "react";

import { cancelRide } from "@/lib/ride-completion/actions";

type CancelRideControlProps = {
  rideId: string;
  isFull: boolean;
  confirmedSeats: number;
};

export function CancelRideControl({ rideId, isFull, confirmedSeats }: CancelRideControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (result?.success) return <p role="status" className="mt-4 text-sm text-emerald-800">{result.message}</p>;

  function submitCancellation() {
    startTransition(async () => {
      try {
        const nextResult = await cancelRide(rideId, isFull ? acknowledged : false);
        setResult(nextResult);
        if (!nextResult.success) setConfirming(false);
      } catch {
        setResult({ success: false, message: "Could not cancel the ride. Please try again." });
      }
    });
  }

  return (
    <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4" aria-label="Cancel ride">
      <h2 className="font-semibold text-red-950">Cancel this ride</h2>
      <p className="mt-1 text-sm text-red-900">Passengers will see that the ride was cancelled and will need to make other plans.</p>
      {isFull ? <p className="mt-2 text-sm font-semibold text-red-950">This ride is full with {confirmedSeats} confirmed seat{confirmedSeats === 1 ? "" : "s"}. Cancelling affects every confirmed passenger.</p> : null}
      {!confirming ? <button type="button" onClick={() => setConfirming(true)} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">Cancel ride</button> : <div className="mt-3 space-y-3">
        {isFull ? <label className="flex gap-2 text-sm text-red-950"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />I understand that confirmed passengers will need other plans.</label> : null}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={pending || (isFull && !acknowledged)} onClick={submitCancellation} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Cancelling…" : "Confirm cancellation"}</button>
          <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Keep ride</button>
        </div>
      </div>}
      {result ? <p role="alert" className="mt-3 text-sm text-red-800">{result.message}</p> : null}
    </section>
  );
}
