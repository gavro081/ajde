# Shared city-to-city road routing (#5)

The existing authenticated `POST /api/rides/distance` endpoint now calls
[`roadDistanceKm`](../../ride-share-app/lib/rides/road-distance.ts). The shared
server-only operation accepts the authenticated Supabase client plus canonical
origin and destination city IDs. It resolves reference coordinates from `cities`,
requests the application-wide `try_ride_routing_request` permit, and calls OSRM.
The checker can use this same operation without calling the HTTP endpoint.

```ts
const result = await roadDistanceKm(supabase, originCityId, destinationCityId);
// { ok: true, distanceKm } or
// { ok: false, error, status, retryAfterMs?, retryAfterSeconds? }
```

The endpoint retains its existing authentication and normalized English/Macedonian
city-name resolution. The shared operation independently resolves coordinates by
ID, so callers cannot supply model-generated coordinates. This introduces one
additional small catalog read for the existing name-based endpoint. Pickup and
drop-off points never affect the estimate, following the
[city-to-city distance ADR](../adr/0001-city-to-city-road-distance.md).

Preserved behavior includes the eight-second timeout, non-commercial application
User-Agent, no-store fetch, positive finite OSRM distance validation, and rounding
to tenths of a kilometre. Permit denial returns HTTP 429 with `retryAfterMs: 1300`
and `Retry-After: 2`; catalog/permit errors return 503 and provider failures return
502 with existing manual-entry messages. This operation is independent of
`AI_IMPORT_PIPELINE_ENABLED` and remains available in every flag state.

Deterministic tests exercise the public operation and HTTP endpoint with fake
database/provider boundaries. They cover canonical coordinates, name resolution,
successful rounding, invalid/same-city input, authentication, catalog and permit
failures, retry details, provider failures, malformed results, and the actual
eight-second abort behavior under a fake clock. Endpoint success is verified with
the flag missing, false, invalid, and true. These tests do not claim live OSRM
availability or model capability.
