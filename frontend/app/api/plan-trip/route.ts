const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Forward the trip request to the Django backend (server-to-server, so no CORS
// or TLS needed) and return its response verbatim — validation 400s propagate.
// If the backend itself is unreachable, return a clean 502 JSON (not a raw 500)
// so the UI can tell the user the service is down rather than "Server error: 500".
export async function POST(request: Request) {
  const body = await request.text();
  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/api/plan-trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return Response.json(
      { error: "The planning service is unavailable. Please try again shortly." },
      { status: 502 },
    );
  }
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
