"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";

import LocationField from "./LocationField";
import MapView, { type MapMarker } from "./MapView";
import DailyLogSheet, { type DutySegment } from "./DailyLogSheet";
import { reverseGeocode, type ResolvedLocation } from "../lib/geocoding";
import { markersFromSegments, type PlanSegment } from "../lib/tripMarkers";

type FieldKey = "current" | "pickup" | "dropoff";
const PICK_LABELS: Record<FieldKey, string> = {
  current: "current location",
  pickup: "pickup",
  dropoff: "drop-off",
};

interface DayLog {
  date_offset: number;
  segments: DutySegment[];
}

interface PlanResult {
  routing: string;
  segments: PlanSegment[];
  days: DayLog[];
  total_miles: number;
  route: [number, number][];
}

function parseStartTimeMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Leading dot for a location field: a colored circle (origin/waypoint) or square
// (destination), matching the map marker palette.
function FieldDot({ color, square }: { color: string; square?: boolean }) {
  return (
    <Box
      sx={{
        width: 12,
        height: 12,
        flexShrink: 0,
        borderRadius: square ? "2px" : "50%",
        bgcolor: color,
        boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
      }}
    />
  );
}

export default function TripPlanner() {
  const [current, setCurrent] = useState<ResolvedLocation | null>(null);
  const [pickup, setPickup] = useState<ResolvedLocation | null>(null);
  const [dropoff, setDropoff] = useState<ResolvedLocation | null>(null);
  const [cycleHours, setCycleHours] = useState("0");
  const [startTime, setStartTime] = useState("08:00");

  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "logs">("map");
  const [armedField, setArmedField] = useState<FieldKey | null>(null);

  const setterFor: Record<FieldKey, (l: ResolvedLocation | null) => void> = {
    current: setCurrent,
    pickup: setPickup,
    dropoff: setDropoff,
  };

  function armField(field: FieldKey) {
    setArmedField(field);
    setView("map"); // make sure the map is visible to tap on
  }

  async function handleMapPick(lat: number, lng: number) {
    const field = armedField;
    if (!field) return;
    setArmedField(null);
    const resolved = await reverseGeocode(lat, lng);
    setterFor[field](
      resolved ?? { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng },
    );
  }

  // Esc cancels an in-progress map pick.
  useEffect(() => {
    if (!armedField) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmedField(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armedField]);

  const cycleNum = Number(cycleHours);
  const cycleValid = cycleHours !== "" && !isNaN(cycleNum) && cycleNum >= 0 && cycleNum <= 70;
  const canPlan = !!current && !!pickup && !!dropoff && cycleValid && !isLoading;

  const inputMarkers: MapMarker[] = (
    [
      current && { ...current, kind: "current" },
      pickup && { ...pickup, kind: "pickup" },
      dropoff && { ...dropoff, kind: "dropoff" },
    ].filter(Boolean) as MapMarker[]
  );

  // Once a plan exists, show its route line and stop markers; before that, show
  // the input locations the user has chosen so far.
  const mapMarkers = planResult
    ? markersFromSegments(planResult.segments)
    : inputMarkers;

  const hasDays = !!planResult && planResult.days.length > 0;

  async function handleSubmit() {
    if (!canPlan || !current || !pickup || !dropoff) return;

    const body = {
      current_location: { label: current.label, lat: current.lat, lng: current.lng },
      pickup: { label: pickup.label, lat: pickup.lat, lng: pickup.lng },
      dropoff: { label: dropoff.label, lat: dropoff.lat, lng: dropoff.lng },
      cycle_hours_used: cycleNum,
      start_time_minutes: parseStartTimeMinutes(startTime),
    };

    setIsLoading(true);
    setError(null);
    setPlanResult(null);
    setView("map");

    try {
      const res = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      const data: PlanResult = await res.json();
      setPlanResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Box sx={{ position: "fixed", inset: 0, display: "flex" }}>
      {/* Left command panel */}
      <Box
        sx={{
          width: { xs: "100%", md: 360 },
          flexShrink: 0,
          height: "100%",
          overflowY: "auto",
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}
        >
          <LocalShippingIcon fontSize="small" color="primary" />
          HOS Trip Planner
        </Typography>

        <Stack spacing={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FieldDot color="#38bdf8" />
            <Box sx={{ flexGrow: 1 }}>
              <LocationField
                label="Current location"
                value={current}
                onChange={setCurrent}
                onRequestPin={() => armField("current")}
                picking={armedField === "current"}
              />
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FieldDot color="#22c55e" />
            <Box sx={{ flexGrow: 1 }}>
              <LocationField
                label="Pickup"
                value={pickup}
                onChange={setPickup}
                onRequestPin={() => armField("pickup")}
                picking={armedField === "pickup"}
              />
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FieldDot color="#ef4444" square />
            <Box sx={{ flexGrow: 1 }}>
              <LocationField
                label="Drop-off"
                value={dropoff}
                onChange={setDropoff}
                onRequestPin={() => armField("dropoff")}
                picking={armedField === "dropoff"}
              />
            </Box>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <TextField
            label="Cycle hours used"
            type="number"
            value={cycleHours}
            onChange={(e) => setCycleHours(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Start time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1 }}
          />
        </Stack>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canPlan}
          onClick={handleSubmit}
        >
          {isLoading ? "Planning…" : "Plan trip"}
        </Button>

        {error && <Alert severity="error">{error}</Alert>}

        {planResult && (
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            {planResult.routing === "estimated" && (
              <Alert severity="info" sx={{ mb: 1 }}>
                Distances are approximate (estimated routing).
              </Alert>
            )}
            <Typography variant="body2">
              {planResult.total_miles.toFixed(2)} miles · {planResult.segments.length} segments ·{" "}
              {planResult.days.length} days
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Right pane: hero map, with a Map/Logs toggle once a plan has days */}
      <Box sx={{ flex: 1, position: "relative", minWidth: 0 }}>
        {hasDays && (
          <ToggleButtonGroup
            value={view}
            exclusive
            size="small"
            onChange={(_, v) => v && setView(v)}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 2,
              bgcolor: "background.paper",
              boxShadow: 3,
            }}
          >
            <ToggleButton value="map">Map</ToggleButton>
            <ToggleButton value="logs">Daily Logs</ToggleButton>
          </ToggleButtonGroup>
        )}

        {armedField && (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
              display: "flex",
              alignItems: "center",
              gap: 1,
              bgcolor: "background.paper",
              borderRadius: 2,
              boxShadow: 3,
              px: 2,
              py: 0.75,
            }}
          >
            <Typography variant="body2">
              Tap the map to set the {PICK_LABELS[armedField]}
            </Typography>
            <Button size="small" onClick={() => setArmedField(null)}>
              Cancel
            </Button>
          </Box>
        )}

        <MapView
          markers={mapMarkers}
          route={planResult?.route}
          onPinPlaced={armedField ? handleMapPick : undefined}
        />

        {view === "logs" && planResult && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              overflowY: "auto",
              p: 3,
              bgcolor: "#0b0f14",
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Daily Logs
            </Typography>
            {planResult.days.map((day) => (
              <Paper
                key={day.date_offset}
                sx={{ bgcolor: "#fff", p: 2, mb: 3, maxWidth: 900, mx: "auto" }}
              >
                <Typography variant="subtitle2" sx={{ color: "#555", mb: 1 }}>
                  Day {day.date_offset + 1}
                </Typography>
                <DailyLogSheet segments={day.segments} />
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
