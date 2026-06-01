export type ResolvedLocation = { label: string; lat: number; lng: number };

/** Autocomplete search via the /api/geocode proxy, optionally biased to a center. */
export async function searchLocations(
  q: string,
  center?: { lat: number; lng: number },
): Promise<ResolvedLocation[]> {
  const params = new URLSearchParams({ q });
  if (center) {
    params.set("lat", String(center.lat));
    params.set("lon", String(center.lng));
  }
  const res = await fetch(`/api/geocode?${params}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: ResolvedLocation[] };
  return data.results ?? [];
}

/** Reverse-geocode a dropped pin via the /api/reverse proxy. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ResolvedLocation | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
  const res = await fetch(`/api/reverse?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: ResolvedLocation | null };
  return data.result ?? null;
}
