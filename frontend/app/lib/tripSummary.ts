import { type PlanSegment } from "./tripMarkers";

/** Headline numbers for the trip-summary card, derived from the flat timeline. */
export interface TripSummary {
  /** Total time in a driving status, in minutes. */
  driveMinutes: number;
  /** Number of stops (pickup, drop-off, fuel, break, rest) — i.e. non-driving. */
  stops: number;
  /** True if the plan contains a 34-hour restart. */
  restartRequired: boolean;
  /** Minutes from trip start to arrival at the drop-off (null if not present). */
  destinationEtaMin: number | null;
}

// The non-driving stop descriptions the engine emits. Kept in sync with
// tripMarkers' STOP_KIND_BY_DESCRIPTION so the card's stop count matches the map.
const STOP_DESCRIPTIONS = new Set([
  "Pickup",
  "Drop-off",
  "Fuel stop",
  "30-min break",
  "10-hour rest",
  "34-hour restart",
]);

/** Summarize a plan's timeline into the headline figures shown over the map. */
export function tripSummary(segments: PlanSegment[]): TripSummary {
  let driveMinutes = 0;
  let stops = 0;
  let restartRequired = false;
  let destinationEtaMin: number | null = null;

  for (const seg of segments) {
    if (seg.status === "driving") {
      driveMinutes += (seg.end_min ?? 0) - (seg.start_min ?? 0);
    }
    if (STOP_DESCRIPTIONS.has(seg.description)) {
      stops += 1;
    }
    if (seg.description === "34-hour restart") {
      restartRequired = true;
    }
    if (seg.description === "Drop-off") {
      destinationEtaMin = seg.start_min ?? null;
    }
  }

  return { driveMinutes, stops, restartRequired, destinationEtaMin };
}
