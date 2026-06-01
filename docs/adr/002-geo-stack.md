# ADR 002: Geo Provider Stack

Date: 2026-06-01  
Status: Accepted

## Pure OSS geo stack: MapLibre GL, Photon, OSRM

The geo features use an all open-source stack with no API key or billing account:
- **MapLibre GL JS** with free vector tiles for map rendering.
- **Photon** (Komoot) for geocoding — typed-address autocomplete and reverse
  geocoding of dropped pins.
- **OSRM** for routing — driving distance, duration, and route geometry.

**Why:** The project targets a free, self-containable stack. The Uber/Ola-style
"search or drop a pin" experience is mostly frontend interaction design (debounced
autocomplete, proximity bias, draggable pin), so an OSS geocoder's data quality is
sufficient for addresses and well-known places. Avoiding Google/Mapbox keeps the
deliverable key-free and reproducible.

## Public providers now, self-host later

During development the app uses the public instances — `photon.komoot.io` and
`router.project-osrm.org`. Both base URLs are read from environment variables
(`PHOTON_URL`, `OSRM_URL`); T12 self-hosts them and repoints the vars.

**Why:** The public instances need zero setup to build and demo against. But they
carry no SLA and their usage policies forbid heavy/production traffic. The env-var
seam means moving to self-hosted instances is a one-line configuration change, not
a code change.

## Routing runs in the backend

The Django `/api/plan-trip` view calls OSRM to turn the three locations into route
legs before running the engine; the browser never calls OSRM directly.

**Why:** The HOS engine needs per-leg distance and duration to schedule a trip, and
the backend is the compute hub — the browser only talks to the Next.js proxy
(ADR 001). Keeping routing server-side avoids spreading the routing concern, and a
keyless OSRM call has nothing to hide from the client anyway.

## Graceful fallback with an honesty flag

If an OSRM request fails (network error, timeout, non-200, or no route), the leg
falls back to a straight-line haversine estimate. The response carries a
trip-level `routing` field: `"osrm"` when every leg routed, `"estimated"` when any
leg fell back.

**Why:** A public demo server with no SLA should not hard-fail the whole plan. The
fallback keeps the app working, and the flag lets the frontend tell the user when
distances are approximate — degrading gracefully without hiding the degradation.
