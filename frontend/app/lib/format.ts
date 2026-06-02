/** Shared time/clock formatters for the map popups and the trip summary card. */

/** Render minutes-from-trip-start as "Day N · HH:MM" (24h clock). */
export function formatClock(totalMin: number): string {
  const day = Math.floor(totalMin / 1440) + 1;
  const minOfDay = ((totalMin % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minOfDay / 60)).padStart(2, "0");
  const mm = String(minOfDay % 60).padStart(2, "0");
  return `Day ${day} · ${hh}:${mm}`;
}

/** Render a duration in minutes as "Xh Ym" / "Xh" / "N min". */
export function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${min} min`;
}
