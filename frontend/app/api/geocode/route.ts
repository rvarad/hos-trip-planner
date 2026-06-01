const PHOTON_URL = process.env.PHOTON_URL ?? "https://photon.komoot.io";

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

export type GeocodeResult = { label: string; lat: number; lng: number };

export function featureToLocation(feature: PhotonFeature): GeocodeResult {
  const [lng, lat] = feature.geometry.coordinates;
  const p = feature.properties ?? {};
  const primary = p.name || [p.housenumber, p.street].filter(Boolean).join(" ");
  const parts = [primary, p.city, p.state, p.country].filter(Boolean) as string[];
  const label = [...new Set(parts)].join(", ");
  return { label, lat, lng };
}

// Forward an autocomplete query to Photon (server-side, with a User-Agent for
// fair use) and return a clean { label, lat, lng }[] decoupled from Photon's schema.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ results: [] });

  const upstream = new URL(`${PHOTON_URL}/api`);
  upstream.searchParams.set("q", q);
  upstream.searchParams.set("limit", "5");
  upstream.searchParams.set("lang", "en");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  if (lat && lon) {
    upstream.searchParams.set("lat", lat);
    upstream.searchParams.set("lon", lon);
  }

  let res: Response;
  try {
    res = await fetch(upstream, { headers: { "User-Agent": "hos-trip-planner" } });
  } catch {
    return Response.json({ error: "geocoding unavailable" }, { status: 502 });
  }
  if (!res.ok) {
    return Response.json({ error: "geocoding failed" }, { status: 502 });
  }

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const results = (data.features ?? []).map(featureToLocation);
  return Response.json({ results });
}
