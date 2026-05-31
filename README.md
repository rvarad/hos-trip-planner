# HOS Trip Planner

Plan a truck driver's trip and get back a route map plus federally-compliant ELD daily log sheets. Enter where you are, where you're picking up and dropping off, and how many hours you've already worked this cycle — the app computes an Hours-of-Service-legal schedule (driving, breaks, rest, fuel) and draws the official daily logs for every day of the trip.

**Live demo:** _coming soon_

## What it does

Given four inputs — current location, pickup, drop-off, and current cycle hours used — the app:

- Computes an HOS-compliant schedule for a property-carrying driver on the 70-hour / 8-day cycle
- Shows the route on a map with markers for pickup, drop-off, rest breaks, and fuel stops
- Renders one ELD daily log per day, with the duty-status line drawn on the standard 24-hour grid plus per-status totals

## Tech stack

- **Frontend:** Next.js (App Router, TypeScript) + Material UI, on Vercel
- **Backend:** Django + Django REST Framework (Python 3.12, managed with uv), containerized with Docker
- **Routing / map:** free routing API _(TBD)_

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
- 10 consecutive hours off resets the daily clocks

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
npm run dev
```

## Project structure

```
backend/    Django + DRF; hos/engine.py holds the HOS logic
frontend/   Next.js + MUI
docs/adr/   architecture decision records
tasks/      task breakdown
```
