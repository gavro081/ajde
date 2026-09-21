"use client";
import { useEffect } from "react";
import type { OfferTab } from "@/lib/rides/offer-tabs";

export type UpdateOfferTab = (id: string, update: (current: OfferTab) => OfferTab) => void;

export function OfferDistance({ tab, origin, destination, update }: {
  tab: OfferTab; origin: string | undefined; destination: string | undefined; update: UpdateOfferTab;
}) {
  const { id, distanceEpoch, distanceMode, publishedId } = tab;
  useEffect(() => {
    if (!origin || !destination || origin === destination || distanceMode !== "auto" || publishedId) return;
    const controller = new AbortController();
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = (transform: (tab: OfferTab) => OfferTab) => {
      if (current) update(id, previous => previous.distanceEpoch === distanceEpoch && previous.distanceMode === "auto" && !previous.publishedId ? transform(previous) : previous);
    };
    apply(previous => ({ ...previous, distanceMessage: "Calculating city-to-city road distance…" }));
    async function request(attempt: number) {
      try {
        const response = await fetch("/api/rides/distance", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originCity: origin, destinationCity: destination }), signal: controller.signal });
        const result = await response.json();
        if (response.status === 429 && attempt < 30 && current) {
          timer = setTimeout(() => { void request(attempt + 1); }, 1300 + Math.random() * 300); return;
        }
        if (!response.ok || !Number.isFinite(result.distanceKm) || result.distanceKm <= 0) throw new Error("No valid route");
        apply(previous => ({ ...previous, values: { ...previous.values, distanceKm: String(result.distanceKm) }, distanceMode: "resolved", distanceMessage: "Estimated city-to-city driving distance filled." }));
      } catch {
        apply(previous => ({ ...previous, distanceMode: "error", distanceMessage: "Distance unavailable. Enter km manually or retry." }));
      }
    }
    void request(0);
    return () => { current = false; controller.abort(); if (timer) clearTimeout(timer); };
  }, [id, origin, destination, distanceEpoch, distanceMode, publishedId, update]);
  return null;
}
