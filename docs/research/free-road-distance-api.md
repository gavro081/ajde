# Free road-distance API research

Checked: 2026-09-21. Scope: hosted driving-route APIs for automatically filling the shared offer form's distance. No integration, account creation, or full city-distance matrix was performed.

## Recommendation

Use the public OSRM driving endpoint for the current, low-volume, non-commercial hackathon demo. A real request using this repository's Skopje and Bitola coordinates succeeded without an account or API key and returned **174.2556 km**. This establishes that live road-distance calculation is feasible now; it does not establish service reliability or coverage of every catalog pair. The public demo is explicitly for reasonable non-commercial use and has no uptime, latency, or data-update guarantees. [OSRM demo-server policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server)

For ongoing hosted use, investigate openrouteservice with its free account/key before committing to a production provider. It offers a free Standard key and worldwide driving directions, but current account terms and quotas should be confirmed during setup; its current plans/terms pages redirect to a JavaScript application that could not be rendered in this research environment. [HeiGIT API entry point](https://api.heigit.org/), [ORS services](https://openrouteservice.org/services/), [current plans](https://account.heigit.org/info/plans), [current terms](https://account.heigit.org/info/tos)

These are routing services: the returned distance follows the calculated road route. It should still be called an **estimated driving distance** in the product because the selected endpoints and route can differ from the driver's eventual journey. OSRM documents its route service as finding the fastest route; its table distances are distances along fastest routes, not minimum possible road length. [OSRM HTTP API](https://project-osrm.org/docs/v26.4.0/http)

## Comparison

| Provider | Hosted free access and setup | Published limits | Fit for this feature |
| --- | --- | --- | --- |
| OSRM public demo, operated by FOSSGIS | No key/account used in the successful check below. Worldwide car coverage. | Maximum one request per second; no heavy use or scraping; valid application User-Agent and applicable referrer; attribution and a fix-the-map link. | Small non-commercial demo with a manual fallback. It is a community demo without an availability guarantee, so it should not become an assumed production dependency. [Operator details](https://routing.openstreetmap.de/about.html), [demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) |
| openrouteservice / HeiGIT | Register a free account and obtain its Standard API key. Worldwide driving directions. | The operator's accessible staging plans page publishes 2,000 Directions requests/day and 40/minute; this is **not a verified reading of the current account dashboard**. Main restrictions page allows ordinary driving routes up to 6,000 km and 50 waypoints. | Worth considering for a continuing small deployment when free-key setup is acceptable. No authenticated route call was made, and no production SLA was verified. [Free key](https://api.heigit.org/), [published staging plans](https://staging.openrouteservice.org/plans/), [current restrictions](https://openrouteservice.org/restrictions/), [coverage](https://openrouteservice.org/services/) |
| GraphHopper hosted Directions API | Account and API key required; free signup requires no credit card. | Free plan: 500 credits/day, five locations/request, restricted profiles and no guarantees. A standard two-point route costs one credit. | Feasible for development, but less suitable for the requested free ongoing setup: pricing labels Free non-commercial; terms allow commercial development but require inquiry for commercial production. [Pricing](https://www.graphhopper.com/pricing/), [credit calculation](https://www.graphhopper.com/faq/what-is-one-credit/), [terms](https://www.graphhopper.com/terms/) |

## Empirical OSRM check

The request completed at **2026-09-21T18:01:25.4365966Z**, using `User-Agent: LightweightRideShareResearch/0.1`. It was an unauthenticated read-only GET. The initial restricted-network request could not connect; the same request succeeded after network approval. No API service outage is inferred from the first failure.

Input coordinates came from the existing city catalog seed, in OSRM's longitude,latitude order:

| City | Longitude | Latitude | Local provenance |
| --- | --- | --- | --- |
| Skopje | 21.43141 | 41.99646 | `ride-share-app/supabase/migrations/20260920123000_seed_cities_and_skopje_pickup_points.sql`, line 2 |
| Bitola | 21.33553 | 41.03226 | Same file, line 4 |

[Exact route request](https://router.project-osrm.org/route/v1/driving/21.43141,41.99646;21.33553,41.03226?overview=false&alternatives=false&steps=false):

```text
GET https://router.project-osrm.org/route/v1/driving/21.43141,41.99646;21.33553,41.03226?overview=false&alternatives=false&steps=false

HTTP status: 200
code: Ok
routes[0].distance: 174255.6 metres
routes[0].duration: 11643.3 seconds
routes[0].weight_name: routability
```

The returned road-snapped start was `[21.430728, 41.99705]`, 86.54359438 m from the input coordinate, on `Максим Горки`. The snapped destination was `[21.335607, 41.032222]`, 7.729620457 m from the input. Thus this measurement is between the road positions near the catalog city coordinates, not between unspecified pickup addresses.

The response did **not** contain `data_version`; its source-map timestamp is unknown. OSRM documents that this property is optional and represents the original OSM data timestamp when available. Save the checked-at time, input/snapped coordinates, endpoint, profile, raw metres, and optional data version if results later become cached reference data. That provenance recommendation is an engineering inference from the API contract. [OSRM response and waypoint documentation](https://project-osrm.org/docs/v26.4.0/http)

This check did not request route geometry, inspect the roads visually, test Bitola-to-Skopje, or test the other city pairs. It verifies a successful routable distance response, not that a particular route is the driver's preferred route.

## Attribution, persistence, and remaining setup

- For OSRM, display routing attribution and OpenStreetMap attribution, link the OSM copyright/license information, and include the operator-required fix-the-map link. The operator says requests are logged. Its complete German usage-policy page returned an access-denied challenge, so only the accessible operator summary and OSRM project policy were read. [Operator policy and privacy summary](https://routing.openstreetmap.de/about.html), [OSRM usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy), [OSM licensing](https://www.openstreetmap.org/copyright)
- ORS's accessible staging terms state API results use CC-BY 4.0 and require attribution, including OSM credit where applicable. A current operator forum reply says result reuse is permitted subject to its terms. Because the current canonical terms were not rendered, confirm the current wording when obtaining the key; do not treat the staging copy as final production approval. [Staging terms](https://staging.openrouteservice.org/terms-of-service/), [operator response on persistent results](https://ask.openrouteservice.org/t/persistent-storage-and-reuse-of-matrix-api-duration-results/8010), [current terms](https://account.heigit.org/info/tos)
- GraphHopper requires provider/OSM attribution as applicable. Its terms expressly allow temporary client-side caching and prohibit scraping/mass downloads unless otherwise agreed; they do not establish permission for a permanent shared city-distance database. [GraphHopper terms](https://www.graphhopper.com/terms/)

For the OSRM demo, no user credential setup remains. Implementation would still need a server-side routing call with a descriptive User-Agent, service-wide request limiting, explicit timeout/error handling, visible attribution, and retention of manual distance entry when routing fails. The form should only request distance once both canonical cities resolve; it should not ask the LLM to invent kilometres. These are implementation recommendations, not completed changes.

For ORS or GraphHopper, signup/key acquisition, review of current account terms, server secret configuration, and a successful authenticated route check remain. No accounts were created and no existing credentials were inspected.
