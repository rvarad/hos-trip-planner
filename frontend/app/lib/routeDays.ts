/** Per-day slice of the route polyline, for the map's per-day hover info. */
export interface DayRoute {
  dateOffset: number;
  /** Ordered [lng, lat] pairs for this day's portion of the route. */
  coords: [number, number][];
  /** Miles driven that day (filled by the caller for the hover popup). */
  miles?: number;
  /** Driving minutes that day (filled by the caller for the hover popup). */
  driveMinutes?: number;
}

interface DayLike {
  date_offset: number;
  segments: { miles?: number }[];
}

const R_MILES = 3958.7613;

/** Great-circle distance in miles between two [lng, lat] points. */
function haversineMiles(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Split the route polyline into one slice per day, cutting at each day's
 * cumulative-driven-miles FRACTION of the trip total. Using fractions (not
 * absolute miles) keeps the cuts proportional regardless of any mismatch
 * between OSRM's reported miles and the polyline's own length. Adjacent slices
 * share the boundary point so the colored lines join seamlessly.
 */
export function splitRouteByDay(
  route: [number, number][] | undefined,
  days: DayLike[],
): DayRoute[] {
  if (!route || route.length < 2 || days.length === 0) {
    return route && route.length >= 2 && days.length
      ? [{ dateOffset: days[0].date_offset, coords: route }]
      : [];
  }
  if (days.length === 1) {
    return [{ dateOffset: days[0].date_offset, coords: route }];
  }

  const dayMiles = days.map((d) =>
    d.segments.reduce((sum, s) => sum + (s.miles ?? 0), 0),
  );
  const total = dayMiles.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return [{ dateOffset: days[0].date_offset, coords: route }];
  }

  // Cumulative polyline length at each vertex.
  const cum: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    cum.push(cum[i - 1] + haversineMiles(route[i - 1], route[i]));
  }
  const totalLen = cum[cum.length - 1];

  // Distance at the END of each day except the last — the cut points.
  const cuts: number[] = [];
  let acc = 0;
  for (let i = 0; i < days.length - 1; i++) {
    acc += dayMiles[i];
    cuts.push((acc / total) * totalLen);
  }

  const EPS = 1e-9;
  const result: DayRoute[] = [];
  let curr: [number, number][] = [route[0]];
  let bi = 0;
  for (let i = 1; i < route.length; i++) {
    while (bi < cuts.length && cuts[bi] <= cum[i] + EPS) {
      const target = cuts[bi];
      const segStart = cum[i - 1];
      const segEnd = cum[i];
      const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0;
      const pt: [number, number] = [
        route[i - 1][0] + (route[i][0] - route[i - 1][0]) * t,
        route[i - 1][1] + (route[i][1] - route[i - 1][1]) * t,
      ];
      curr.push(pt);
      result.push({ dateOffset: days[bi].date_offset, coords: curr });
      curr = [pt];
      bi++;
    }
    // Append the vertex unless a cut just landed exactly on it (avoid a dupe).
    const last = curr[curr.length - 1];
    if (!last || last[0] !== route[i][0] || last[1] !== route[i][1]) {
      curr.push(route[i]);
    }
  }
  result.push({ dateOffset: days[bi].date_offset, coords: curr });
  return result;
}
