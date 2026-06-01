export interface DutySegment {
  start_min: number;
  end_min: number;
  status: string;
}

interface DailyLogSheetProps {
  segments?: DutySegment[];
}

export default function DailyLogSheet({ segments = [] }: DailyLogSheetProps) {
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
      filledSegments.push({ start_min: current_min, end_min: seg.start_min, status: "off_duty" });
    }
    filledSegments.push(seg);
    current_min = Math.max(current_min, seg.end_min);
  }
  if (current_min < 1440) {
    filledSegments.push({ start_min: current_min, end_min: 1440, status: "off_duty" });
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
    let rowIdx = ROWS.findIndex(r => r.key === seg.status);
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
      let nextRowIdx = ROWS.findIndex(r => r.key === nextSeg.status);
      if (nextRowIdx === -1) nextRowIdx = 0;
      const nextY = GRID_START_Y + nextRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      points.push(`${endX},${nextY}`);
    }
  }
  const polylinePoints = points.join(" ");

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
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
  );
}
