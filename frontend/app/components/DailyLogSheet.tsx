export default function DailyLogSheet() {
  const GRID_START_X = 140;
  const GRID_WIDTH = 576; // 24 hours * 24 pixels
  const GRID_END_X = GRID_START_X + GRID_WIDTH;
  const PIXELS_PER_HOUR = 24;
  
  const ROW_HEIGHT = 30;
  const GRID_START_Y = 40;
  
  const ROWS = [
    { label: "Off Duty" },
    { label: "Sleeper Berth" },
    { label: "Driving" },
    { label: "On Duty (Not Driving)" },
  ];

  const GRID_END_Y = GRID_START_Y + ROWS.length * ROW_HEIGHT;

  // Generate hour labels and lines
  const hours = Array.from({ length: 25 }, (_, i) => i);
  const quarters = Array.from({ length: 24 * 3 }, (_, i) => {
    const hour = Math.floor(i / 3);
    const quarter = (i % 3) + 1;
    return hour * PIXELS_PER_HOUR + quarter * (PIXELS_PER_HOUR / 4);
  });

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 800 ${GRID_END_Y + 20}`}
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
      </svg>
    </div>
  );
}
