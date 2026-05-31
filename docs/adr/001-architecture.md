# ADR 001: Core Architecture Decisions

Date: 2026-05-30  
Status: Accepted

## Next.js as proxy to backend VM

The browser never calls the Django backend directly. A Next.js server-side route
handler forwards API requests to the VM at `http://VM-IP:8000`.

**Why:** Running backend and frontend on separate origins would require CORS headers
and a TLS certificate on the backend (browsers block mixed content — HTTPS page
calling HTTP API). The server-side proxy eliminates both: the call is
server-to-server, so no CORS, no TLS, and the backend stays internal-only.

## Backend deployed in Mumbai (ap-mumbai-1 / bom1)

OCI ARM VM in the Mumbai region; Vercel deployment also targets `bom1`.

**Why:** Minimizes latency for the primary target audience.

## No database (stateless compute)

The backend holds no persistent state. Every request is self-contained: inputs in,
JSON timeline out. No migrations, no ORM calls in the engine.

**Why:** The MVP scope does not require persistence. Removing the database shrinks
the operational surface, speeds up Docker builds, and keeps the engine purely
testable without fixtures or teardown.

## Python dependency management with uv

All Python deps declared in `pyproject.toml`; `uv.lock` committed and used in
the Docker image via `uv sync --frozen --no-dev`.

**Why:** uv resolves and installs an order of magnitude faster than pip, produces
a reproducible lock file, and the `--frozen` flag guarantees the Docker build uses
exactly the locked versions.
