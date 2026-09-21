"use client";

import { useEffect, useState } from "react";

import { RideCard } from "@/components/ride-card";
import {
  matchExplanationResponseSchema,
  MAX_EXPLAINED_RIDES,
} from "@/lib/ai/explain-match-schema";
import type { SearchQueryResult } from "@/lib/ai/search-query-schema";
import type { RideView } from "@/lib/rides/ride-view";

export function RideResults({
  rides,
  searchContext,
}: {
  rides: RideView[];
  searchContext: SearchQueryResult | null;
}) {
  const [loaded, setLoaded] = useState<{
    requestKey: string;
    explanations: Record<string, string>;
  }>({ requestKey: "", explanations: {} });
  const requestKey = JSON.stringify({
    rideIds: rides.slice(0, MAX_EXPLAINED_RIDES).map((ride) => ride.id),
    searchContext,
  });
  const explanations = loaded.requestKey === requestKey ? loaded.explanations : {};

  useEffect(() => {
    if (!searchContext || rides.length === 0) return;

    const controller = new AbortController();
    let active = true;
    const rideIds = rides.slice(0, MAX_EXPLAINED_RIDES).map((ride) => ride.id);

    async function load() {
      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rideIds, context: searchContext }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const parsed = matchExplanationResponseSchema.safeParse(await response.json());
        if (!parsed.success || !active) return;
        setLoaded({
          requestKey,
          explanations: Object.fromEntries(
            parsed.data.explanations.map((item) => [item.rideId, item.explanation]),
          ),
        });
      } catch {
        // Explanations are optional; cards remain complete without them.
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [requestKey, rides, searchContext]);

  return (
    <div className="mt-7 grid gap-7 lg:grid-cols-2">
      {rides.map((ride) => (
        <RideCard key={ride.id} ride={ride} explanation={explanations[ride.id]} />
      ))}
    </div>
  );
}
