# Possible duplicate ride offers (#8)

The checker now exposes a model-selectable `find_similar_rides` function alongside
road routing. It receives the draft's canonical origin/destination city IDs and
an ISO departure timestamp including a timezone offset. Equivalent timestamps
with different offsets are compared as instants. Missing departure, noncanonical
or reversed routes, different departures, and malformed arguments never execute
the tool. The existing four-round/six-execution budget is shared by every tool.

[`findSimilarRides`](../../ride-share-app/lib/ai/similar-rides-tool.ts) uses the
provided authenticated Supabase client, preserving that caller's access policies.
It queries `rides` on the same directed route, with status `published` or `full`,
and an inclusive three-hour window before and after the draft departure. Results
are ordered by departure then ID and limited to five. Returned database rows are
validated again for route, status, time window, and field shape before producing:

```ts
{ rides: [{ id, departureAt, pricePerSeatMkd, seatsAvailable }] }
```

Only these fields are retained in checker evidence. Database errors, thrown
exceptions, unexpected rows, and invalid/mixed error results become unavailable
evidence. A successful empty result remains distinct from a failed search.
The [checker](../../ride-share-app/lib/ai/check-ride-draft.ts) accepts duplicate
findings only when every citation names successful evidence and a cited similar
search contains matches. It writes conservative "possible duplicates" wording in
code, discarding unsupported model prose and preserving all draft fields.

The [review summary](../../ride-share-app/app/rides/import/similar-rides-summary.tsx)
shows route, departure in Europe/Skopje, per-seat MKD price (or unavailable), and
available seats. Links open matching ride offers separately so the current draft
remains available. The driver continues through the existing editable form and
decides whether to publish. A match never establishes that two posts describe the
same ride; this is a narrow route/time comparison, not semantic duplicate
detection. Results describe the database at checking time and can become stale.

Deterministic tests cover inclusive time boundaries, exclusion just outside the
window, route direction, allowed statuses, deterministic five-result limits,
caller-client use, invalid arguments/results, errors, missing departure,
equivalent timezone offsets, evidence provenance, shared budgets, successful
empty searches, and visible summary/link behavior. The integrated endpoint and
form-continuation tests remain part of the combined pipeline verification.
No live database or model accuracy claim is made by these fixture tests.
