import { type MapMarker } from "../components/MapView";

/** A timeline segment from the plan-trip response (richer than the log sheet's). */
export interface PlanSegment {
  start_min: number;
  end_min: number;
  status: string;
  description: string;
  start_location?: { label: string; lat: number; lng: number };
  end_location?: { label: string; lat: number; lng: number };
  miles: number;
}

// Map each engine stop description to a marker kind (colored in MapView). Driving
// segments ("Drive to …") are absent here on purpose — the route line covers them.
const STOP_KIND_BY_DESCRIPTION: Record<string, string> = {
  Pickup: "pickup",
  "Drop-off": "dropoff",
  "Fuel stop": "fuel",
  "30-min break": "break",
  "10-hour rest": "rest",
  "34-hour restart": "rest",
};

/**
 * Derive map markers from the flat HOS timeline: a "current" marker at the trip
 * start, then one marker per non-driving stop (pickup, drop-off, fuel, rest).
 */
export function markersFromSegments(segments: PlanSegment[]): MapMarker[] {
  const markers: MapMarker[] = [];

  const first = segments[0];
  if (first?.start_location) {
    markers.push({
      lat: first.start_location.lat,
      lng: first.start_location.lng,
      kind: "current",
      label: first.start_location.label,
      description: "Trip start",
      arrivalMin: first.start_min,
      durationMin: 0,
      milesSoFar: 0,
    });
  }

  // Accumulate driving miles as we walk the timeline so each stop can show the
  // cumulative miles reached by that point.
  let milesSoFar = 0;
  for (const seg of segments) {
    milesSoFar += seg.miles ?? 0;
    const kind = STOP_KIND_BY_DESCRIPTION[seg.description];
    if (!kind || !seg.start_location) continue;
    markers.push({
      lat: seg.start_location.lat,
      lng: seg.start_location.lng,
      kind,
      label: seg.start_location.label,
      description: seg.description,
      arrivalMin: seg.start_min,
      durationMin: seg.end_min - seg.start_min,
      milesSoFar,
    });
  }

  return markers;
}
