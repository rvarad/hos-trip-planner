export interface DutySegment {
  start_min: number;
  end_min: number;
  status: string;
  description?: string;
  miles?: number;
  start_location?: { label: string; lat: number; lng: number };
  end_location?: { label: string; lat: number; lng: number };
}

interface DailyLogSheetProps {
  segments?: DutySegment[];
  /** 1-based day number shown in the header. */
  dayNumber?: number;
  /** Pre-formatted date string for the header (e.g. "06 / 02 / 2026"). */
  date?: string;
}

// Duty changes worth noting in the Remarks section.
const REMARKABLE = new Set([
  "Pickup",
  "Drop-off",
  "Fuel stop",
  "30-min break",
  "10-hour rest",
  "34-hour restart",
]);

function hhmm(minOfDay: number): string {
  const hh = String(Math.floor(minOfDay / 60)).padStart(2, "0");
  const mm = String(minOfDay % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** A labeled box that mimics the printed form's fill-in fields. */
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          border: "1px solid #111",
          minHeight: 20,
          padding: "2px 4px",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value || " "}
      </div>
      <div style={{ fontSize: 9, textAlign: "center", color: "#333" }}>{label}</div>
    </div>
  );
}

export default function DailyLogSheet({
  segments = [],
  dayNumber,
  date,
}: DailyLogSheetProps) {
  const GRID_START_X = 140;
  const GRID_WIDTH = 576; // 24 hours * 24 pixels
  const GRID_END_X = GRID_START_X + GRID_WIDTH;
  const PIXELS_PER_HOUR = 24;

  const ROW_HEIGHT = 30;
  const GRID_START_Y = 40;

  const ROWS = [
    { label: "Off Duty", key: "off_duty" },
    { label: "Sleeper Berth", key: "sleeper_berth" },
    { label: "Driving", key: "driving" },
    { label: "On Duty (Not Driving)", key: "on_duty_not_driving" },
  ];

  const GRID_END_Y = GRID_START_Y + ROWS.length * ROW_HEIGHT;

  // Generate hour labels and lines
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const quarters = Array.from({ length: 24 * 3 }, (_, i) => {
    const hour = Math.floor(i / 3);
    const quarter = (i % 3) + 1;
    return hour * PIXELS_PER_HOUR + quarter * (PIXELS_PER_HOUR / 4);
  });

  // Fill unaccounted time with off_duty
  const filledSegments: DutySegment[] = [];
  let current_min = 0;
  const sortedSegments = [...segments].sort((a, b) => a.start_min - b.start_min);

  for (const seg of sortedSegments) {
    if (seg.start_min > current_min) {
      filledSegments.push({
        start_min: current_min,
        end_min: seg.start_min,
        status: "off_duty",
        description: "",
        miles: 0,
      });
    }
    filledSegments.push(seg);
    current_min = Math.max(current_min, seg.end_min);
  }
  if (current_min < 1440) {
    filledSegments.push({
      start_min: current_min,
      end_min: 1440,
      status: "off_duty",
      description: "",
      miles: 0,
    });
  }

  // Compute totals
  const totals: Record<string, number> = {
    off_duty: 0,
    sleeper_berth: 0,
    driving: 0,
    on_duty_not_driving: 0,
  };

  for (const seg of filledSegments) {
    const duration = seg.end_min - seg.start_min;
    if (seg.status in totals) {
      totals[seg.status] += duration;
    } else {
      totals.off_duty += duration;
    }
  }

  // Build the polyline points
  const points: string[] = [];
  for (let i = 0; i < filledSegments.length; i++) {
    const seg = filledSegments[i];
    let rowIdx = ROWS.findIndex((r) => r.key === seg.status);
    if (rowIdx === -1) rowIdx = 0; // Default off_duty

    const y = GRID_START_Y + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
    const startX = GRID_START_X + (seg.start_min / 60) * PIXELS_PER_HOUR;
    const endX = GRID_START_X + (seg.end_min / 60) * PIXELS_PER_HOUR;

    if (i === 0) {
      points.push(`${startX},${y}`);
    }
    points.push(`${endX},${y}`);

    if (i < filledSegments.length - 1) {
      const nextSeg = filledSegments[i + 1];
      let nextRowIdx = ROWS.findIndex((r) => r.key === nextSeg.status);
      if (nextRowIdx === -1) nextRowIdx = 0;
      const nextY = GRID_START_Y + nextRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      points.push(`${endX},${nextY}`);
    }
  }
  const polylinePoints = points.join(" ");

  // Header / remarks / recap data derived from the day's segments.
  const totalMiles = segments.reduce((sum, s) => sum + (s.miles ?? 0), 0);
  const from = segments.find((s) => s.start_location)?.start_location?.label ?? "";
  const to =
    [...segments].reverse().find((s) => s.end_location)?.end_location?.label ?? "";
  const remarks = segments.filter(
    (s) => s.description && REMARKABLE.has(s.description),
  );
  const onDutyTodayHrs = (totals.driving + totals.on_duty_not_driving) / 60;
  const offDutyTodayHrs = (totals.off_duty + totals.sleeper_berth) / 60;

  return (
    <div style={{ width: "100%", color: "#111", fontFamily: "sans-serif" }}>
      {/* Title + date */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: "2px solid #111",
          paddingBottom: 4,
        }}
      >
        <div>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Driver&apos;s Daily Log</span>
          <span style={{ fontSize: 11, marginLeft: 6 }}>(24 hours)</span>
        </div>
        <div style={{ fontSize: 12, display: "flex", gap: 12 }}>
          {dayNumber != null && <span style={{ fontWeight: 700 }}>Day {dayNumber}</span>}
          {date && <span>{date}</span>}
        </div>
      </div>

      {/* From / To */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12 }}>
        <div style={{ flex: 1 }}>
          <b>From:</b> {from || "—"}
        </div>
        <div style={{ flex: 1 }}>
          <b>To:</b> {to || "—"}
        </div>
      </div>

      {/* Mileage + carrier fields */}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Field label="Total Miles Driving Today" value={totalMiles.toFixed(1)} />
        <Field label="Total Mileage Today" value={totalMiles.toFixed(1)} />
        <Field label="Name of Carrier or Carriers" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Field label="Truck/Tractor and Trailer Numbers" />
        <Field label="Home Terminal Address" />
      </div>

      {/* The 24-hour duty-status grid */}
      <div style={{ width: "100%", overflowX: "auto", marginTop: 8 }}>
        <svg
          viewBox={`0 0 850 ${GRID_END_Y + 20}`}
          width="100%"
          height="100%"
          style={{ minWidth: "600px", fontFamily: "sans-serif" }}
        >
          <style>
            {`
            .grid-hour { stroke: #ccc; stroke-width: 1; }
            .grid-quarter { stroke: #eee; stroke-width: 1; }
            .row-line { stroke: #ccc; stroke-width: 1; }
            .label { fill: #333; font-size: 12px; }
            .hour-label { fill: #666; font-size: 10px; text-anchor: middle; }
            .status-line { fill: none; stroke: #1976d2; stroke-width: 3; stroke-linejoin: round; }
            .totals-header { fill: #333; font-size: 11px; font-weight: bold; text-anchor: middle; }
            .totals-value { fill: #333; font-size: 12px; text-anchor: middle; }
          `}
          </style>

          {/* Row backgrounds and labels */}
          {ROWS.map((row, i) => {
            const y = GRID_START_Y + i * ROW_HEIGHT;
            return (
              <g key={i}>
                <line
                  x1={GRID_START_X}
                  y1={y}
                  x2={GRID_END_X}
                  y2={y}
                  className="row-line"
                />
                <text
                  x={GRID_START_X - 10}
                  y={y + ROW_HEIGHT / 2 + 4}
                  textAnchor="end"
                  className="label"
                >
                  {row.label}
                </text>
              </g>
            );
          })}
          {/* Bottom line of the grid */}
          <line
            x1={GRID_START_X}
            y1={GRID_END_Y}
            x2={GRID_END_X}
            y2={GRID_END_Y}
            className="row-line"
          />

          {/* Quarter-hour ticks */}
          {quarters.map((xOffset) => (
            <line
              key={`q-${xOffset}`}
              x1={GRID_START_X + xOffset}
              y1={GRID_START_Y}
              x2={GRID_START_X + xOffset}
              y2={GRID_END_Y}
              className="grid-quarter"
            />
          ))}

          {/* Hour lines and labels */}
          {hours.map((h) => {
            const x = GRID_START_X + h * PIXELS_PER_HOUR;
            let label = "";
            if (h === 0 || h === 24) label = "Mid";
            else if (h === 12) label = "N";
            else label = String(h > 12 ? h - 12 : h);

            return (
              <g key={`h-${h}`}>
                <line
                  x1={x}
                  y1={GRID_START_Y - 5}
                  x2={x}
                  y2={GRID_END_Y}
                  className="grid-hour"
                />
                <text x={x} y={GRID_START_Y - 10} className="hour-label">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Totals column on the right */}
          <text x={GRID_END_X + 45} y={GRID_START_Y - 10} className="totals-header">
            Total Hours
          </text>
          {ROWS.map((row, i) => {
            const y = GRID_START_Y + i * ROW_HEIGHT + ROW_HEIGHT / 2 + 4;
            const totalHours = (totals[row.key] / 60).toFixed(2);
            return (
              <text key={`total-${row.key}`} x={GRID_END_X + 45} y={y} className="totals-value">
                {totalHours}
              </text>
            );
          })}

          {/* The continuous duty-status line */}
          {filledSegments.length > 0 && (
            <polyline points={polylinePoints} className="status-line" />
          )}
        </svg>
      </div>

      {/* Remarks */}
      <div style={{ marginTop: 8, fontSize: 12 }}>
        <div style={{ fontWeight: 700, borderBottom: "1px solid #111", marginBottom: 4 }}>
          Remarks
        </div>
        {remarks.length > 0 ? (
          remarks.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#333" }}>
                {hhmm(s.start_min)}
              </span>
              <span>
                {s.description}
                {s.start_location ? ` — ${s.start_location.label}` : ""}
              </span>
            </div>
          ))
        ) : (
          <div style={{ color: "#888" }}>{"—"}</div>
        )}
      </div>

      {/* Recap */}
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          borderTop: "1px solid #111",
          paddingTop: 4,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>
          <b>Recap</b> — On-duty hours today (lines 3 &amp; 4):{" "}
          {onDutyTodayHrs.toFixed(2)}
        </span>
        <span>Off-duty today: {offDutyTodayHrs.toFixed(2)}</span>
      </div>
    </div>
  );
}
