import { featureToLocation } from "../geocode/route";

const PHOTON_URL = process.env.PHOTON_URL ?? "https://photon.komoot.io";

// Reverse-geocode a dropped pin to a label. The pin's own coordinates are kept
// (it shouldn't jump to the nearest address; OSRM snaps to roads at routing time).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  if (!lat || !lon) {
    return Response.json({ error: "lat and lon required" }, { status: 400 });
  }

  const upstream = new URL(`${PHOTON_URL}/reverse`);
  upstream.searchParams.set("lat", lat);
  upstream.searchParams.set("lon", lon);
  upstream.searchParams.set("lang", "en");

  let res: Response;
  try {
    res = await fetch(upstream, { headers: { "User-Agent": "hos-trip-planner" } });
  } catch {
    return Response.json({ error: "geocoding unavailable" }, { status: 502 });
  }
  if (!res.ok) {
    return Response.json({ error: "geocoding failed" }, { status: 502 });
  }

  const data = (await res.json()) as { features?: Parameters<typeof featureToLocation>[0][] };
  const feature = data.features?.[0];
  if (!feature) return Response.json({ result: null });

  const { label } = featureToLocation(feature);
  return Response.json({ result: { label, lat: Number(lat), lng: Number(lon) } });
}
