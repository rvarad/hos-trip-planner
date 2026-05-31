# HOS Trip Planner

A trip planner for U.S. property-carrying truck drivers. The user enters trip
details; the app returns an HOS-compliant schedule rendered as a route map and
filled-in ELD daily log sheets.

Scope: a focused MVP — favor a clean, working core over breadth.

## Working protocol (follow every session)

- We work ONE subtask per session. I'll name the task file and subtask.
- Read this file (automatic) and the named task file before doing anything.
- Before writing code, post your step-by-step plan for the subtask and WAIT for my approval.
- TDD: write the failing test first, then the code to pass it.
- Done = code + a test + `uv run pytest` green + one small focused commit with a clear message.
- When done: tick the subtask's checkbox in its task file, update tasks/README.md
  status, then STOP and report. Do not start the next subtask.
- Never add dependencies, edit migrations, or change the HOS engine without my approval.
- Committed files (README, CLAUDE.md, ADRs, tasks/) describe a standalone project —
  do not reference any company or hiring process in anything you commit.

## Commands

- Backend dev: cd backend && uv run python manage.py runserver
- Backend tests: cd backend && uv run pytest
- Add a dep: cd backend && uv add <pkg> (ask first)
- Frontend dev: cd frontend && npm run dev
- Frontend build: cd frontend && npm run build

## Architecture

- Frontend: Next.js (App Router, TS) + MUI, on Vercel.
- Backend: Django 5 + DRF, Python 3.12 via uv, in Docker on an OCI ARM VM.
- Browser → Next.js only. A Next.js server-side route handler proxies to the backend
  at http://VM-IP:8000. Server-to-server, so NO CORS and NO TLS on the backend.
- No database — stateless compute.
- Monorepo: /frontend, /backend.
- Data flow: form → Next.js proxy → POST /api/plan-trip → engine → JSON timeline → map + logs.

## Code layout

- backend/hos/engine.py — HOS compliance engine. PURE Python: no Django imports,
  no I/O, no clock reads. Deterministic.
- backend/hos/rules.py — HOS constants and limit checks.
- backend/hos/views.py — DRF endpoints; thin, delegate to the engine.
- frontend/ — Next.js app; the form and log-sheet rendering live here.

## Conventions

- Engine works in integer minutes-from-trip-start; format to clock time only at the edges.
- Type hints on every engine function; docstrings name the HOS rule each implements.
- DRF serializers for every request/response shape; no hand-built dicts in views.
- Python deps via uv (pyproject.toml + uv.lock, both committed).
- Multi-arch Docker base images only.

## HOS rules the engine enforces (property carrier, 70hr/8day, no adverse conditions)

- 11-hour driving limit per duty period.
- 14-hour driving window from going on duty; breaks do NOT pause it.
- 30-minute break after 8 cumulative hours of driving.
- 70 on-duty hours per rolling 8 days; "current cycle used" seeds the counter.
- 10 consecutive hours off duty resets the 11h and 14h clocks.
- Assumptions: pickup & drop-off = 1h on-duty each; fuel stop every 1,000 miles.

## Reference material & test fixtures

Source documents live in reference/ (local only, gitignored). See reference/README.md
for the file mapping. The HOS engine's tests (T3) use the FMCSA worked examples there
as ground truth: feed the scenario, assert the engine reproduces the published hours,
break placement, and day count.
