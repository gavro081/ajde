import type { SearchQueryResult } from "@/lib/ai/search-query-schema";

export function SearchInterpretation({
  result,
  cityNames,
  manualOverride,
}: {
  result: SearchQueryResult;
  cityNames: ReadonlyMap<number, string>;
  manualOverride: boolean;
}) {
  const criteria = [
    result.originId ? `From ${cityNames.get(result.originId) ?? "unknown city"}` : null,
    result.destinationId ? `To ${cityNames.get(result.destinationId) ?? "unknown city"}` : null,
    formatBounds(result.departureAfter, result.departureBefore) ?? "Any upcoming date",
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="mt-3 rounded-3xl border border-white bg-white p-4" aria-label="Search interpretation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">
          {criteria.length ? criteria.join(" · ") : "No reliable filters were extracted"}
        </p>
        <span className="text-xs font-medium text-slate-500">
          {Math.round(result.confidence * 100)}% interpretation confidence
        </span>
      </div>
      {manualOverride ? (
        <p className="mt-2 text-xs text-emerald-800">Your manual filter changes take precedence over this interpretation.</p>
      ) : null}
      {result.warnings.length ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-900">
          {result.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>• {warning.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatBounds(after: string | null, before: string | null) {
  if (!after && !before) return null;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Skopje",
  });
  if (after && before) return `${formatter.format(new Date(after))} – ${formatter.format(new Date(before))}`;
  if (after) return `After ${formatter.format(new Date(after))}`;
  return `Before ${formatter.format(new Date(before as string))}`;
}
