# HOS Trip Planner

Plan a truck driver's trip and get back a route map plus federally-compliant ELD daily log sheets. Enter where you are, where you're picking up and dropping off, and how many hours you've already worked this cycle — the app computes an Hours-of-Service-legal schedule (driving, breaks, rest, fuel) and draws the official daily logs for every day of the trip.

**Live demo:** _coming soon_

## What it does

Given four inputs — current location, pickup, drop-off, and current cycle hours used — the app:

- Computes an HOS-compliant schedule for a property-carrying driver on the 70-hour / 8-day cycle
- Draws the route on a map with a colored legend and per-stop markers (pickup, drop-off, fuel, break, rest); hover a marker for its arrival time, duration, and cumulative miles
- Lets you set each location by search, "use my location", or tapping the map directly
- Toggles between the map and full ELD daily logs — one per day, with the duty-status line on the standard 24-hour grid, per-status totals, and that day's driven miles

## Tech stack

- **Frontend:** Next.js (App Router, TypeScript) + Material UI, on Vercel
- **Backend:** Django + Django REST Framework (Python 3.12, managed with uv), containerized with Docker
- **Map / geo (all open-source, keyless):** MapLibre GL via `react-map-gl`, CARTO
  Dark Matter base tiles, [Photon](https://photon.komoot.io) geocoding, and
  [OSRM](https://project-osrm.org) routing. Public instances by default,
  overridable via env vars (see below) for self-hosting.

## Architecture

The browser only ever talks to the Next.js app. A server-side route handler in Next.js proxies API calls to the Django backend, so the backend needs no CORS or TLS of its own. The HOS engine is pure, deterministic Python with no framework dependencies, which keeps it easy to test. The app is stateless — no database.

```
Browser ──▶ Next.js (Vercel) ──▶ [server-side proxy] ──▶ Django / DRF (Docker)
                                                            └─ HOS engine (pure Python)
```

## Hours of Service rules implemented

Based on the U.S. FMCSA Hours of Service regulations. Property-carrying driver, 70 hr / 8 day, no adverse conditions:

- 11-hour driving limit per duty period
- 14-hour driving window (breaks don't pause it)
- 30-minute break after 8 cumulative hours of driving
- 70 on-duty hours per rolling 8 days (seeded by current cycle used)
- 10 consecutive hours off resets the daily clocks (logged as sleeper berth)
- 34-hour restart when the 70-hour cycle is exhausted mid-trip

Assumptions: 1 hour on-duty each for pickup and drop-off; a fuel stop at least every 1,000 miles.

## Local development

**Backend**

```bash
cd backend
uv sync
uv run python manage.py runserver
uv run pytest
```

**Frontend**

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest
```

The frontend talks only to itself; its server-side route handlers proxy to the
backend at `BACKEND_URL` (default `http://localhost:8000`), so run the backend
alongside it for live planning.

### Environment variables

All optional — sensible public defaults are used when unset.

| Variable | Side | Default | Purpose |
| --- | --- | --- | --- |
| `BACKEND_URL` | frontend | `http://localhost:8000` | Django backend the proxy forwards to |
| `NEXT_PUBLIC_MAP_STYLE_URL` | frontend | CARTO Dark Matter | MapLibre style URL |
| `PHOTON_URL` | frontend | `https://photon.komoot.io` | geocoding service (proxied by Next.js) |
| `OSRM_URL` | backend | `https://router.project-osrm.org` | routing service (called by Django) |

## Project structure

```
backend/    Django + DRF; hos/engine.py holds the HOS logic
frontend/   Next.js + MUI
docs/adr/   architecture decision records
tasks/      task breakdown
```
