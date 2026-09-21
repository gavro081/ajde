"use client";

import { useState, useTransition } from "react";

import { completeRide } from "@/lib/ride-completion/actions";

export function CompleteRideButton({ rideId }: { rideId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending || result?.success}
        onClick={() => startTransition(async () => {
          try {
            setResult(await completeRide(rideId));
          } catch {
            setResult({ success: false, message: "Could not complete the ride. Please try again." });
          }
        })}
        className="btn-primary disabled:opacity-60"
      >
        {pending ? "Marking completed…" : "Mark completed"}
      </button>
      {result ? <p role={result.success ? "status" : "alert"} className="mt-2 text-sm text-brand-700">{result.message}</p> : null}
    </div>
  );
}
