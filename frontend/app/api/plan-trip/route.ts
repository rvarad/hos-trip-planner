const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Forward the trip request to the Django backend (server-to-server, so no CORS
// or TLS needed) and return its response verbatim — validation 400s propagate.
export async function POST(request: Request) {
  const body = await request.text();
  const upstream = await fetch(`${BACKEND_URL}/api/plan-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
