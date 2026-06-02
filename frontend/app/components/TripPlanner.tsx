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
import DailyLogSheet from "./DailyLogSheet";
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
  segments: PlanSegment[];
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

// A plan is a snapshot of the inputs that produced it. This key lets us detect
// when the current inputs have drifted from that snapshot (stale plan).
function inputsKey(
  current: ResolvedLocation | null,
  pickup: ResolvedLocation | null,
  dropoff: ResolvedLocation | null,
  cycleHours: string,
  startTime: string,
): string {
  const c = (l: ResolvedLocation | null) => (l ? `${l.lat},${l.lng}` : "");
  return [c(current), c(pickup), c(dropoff), cycleHours, startTime].join("|");
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
  // The inputs the current plan was computed for (null until a plan exists).
  const [planKey, setPlanKey] = useState<string | null>(null);
  // Camera policy: fly to the most recently set location; fit-all only on Plan.
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [fitSignal, setFitSignal] = useState(0);

  const setterFor: Record<FieldKey, (l: ResolvedLocation | null) => void> = {
    current: setCurrent,
    pickup: setPickup,
    dropoff: setDropoff,
  };

  // Set a location and focus the map on it (unless it was cleared).
  function setLocation(field: FieldKey, loc: ResolvedLocation | null) {
    setterFor[field](loc);
    if (loc) setFocusPoint({ lat: loc.lat, lng: loc.lng });
  }

  function armField(field: FieldKey) {
    setArmedField(field);
    setView("map"); // make sure the map is visible to tap on
  }

  async function handleMapPick(lat: number, lng: number) {
    const field = armedField;
    if (!field) return;
    setArmedField(null);
    const resolved = await reverseGeocode(lat, lng);
    setLocation(
      field,
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
  const cycleValid =
    cycleHours !== "" && !isNaN(cycleNum) && cycleNum >= 0 && cycleNum <= 70;
  const canPlan = !!current && !!pickup && !!dropoff && cycleValid && !isLoading;

  const inputMarkers: MapMarker[] = [
    current && { ...current, kind: "current" },
    pickup && { ...pickup, kind: "pickup" },
    dropoff && { ...dropoff, kind: "dropoff" },
  ].filter(Boolean) as MapMarker[];

  // The plan is stale once the inputs drift from what produced it.
  const stale =
    !!planResult &&
    planKey !== inputsKey(current, pickup, dropoff, cycleHours, startTime);

  // Map pins always reflect the live inputs; only a fresh plan's rich stop
  // markers (fuel/rest/…) replace them. A stale plan's route is drawn dimmed.
  const mapMarkers =
    planResult && !stale ? markersFromSegments(planResult.segments) : inputMarkers;

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
      setPlanKey(inputsKey(current, pickup, dropoff, cycleHours, startTime));
      setFitSignal((n) => n + 1); // frame the whole trip once
      setFocusPoint(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* Left command panel (top sheet on small screens) */}
      <Box
        sx={{
          width: { xs: "100%", md: 360 },
          flexShrink: 0,
          height: { xs: "auto", md: "100%" },
          maxHeight: { xs: "55%", md: "100%" },
          overflowY: "auto",
          borderRight: { xs: 0, md: 1 },
          borderBottom: { xs: 1, md: 0 },
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
          <LocationField
            label="Current location"
            value={current}
            onChange={(loc) => setLocation("current", loc)}
            onRequestPin={() => armField("current")}
            picking={armedField === "current"}
            dotColor="#38bdf8"
            disabled={isLoading}
          />
          <LocationField
            label="Pickup"
            value={pickup}
            onChange={(loc) => setLocation("pickup", loc)}
            onRequestPin={() => armField("pickup")}
            picking={armedField === "pickup"}
            dotColor="#22c55e"
            disabled={isLoading}
          />
          <LocationField
            label="Drop-off"
            value={dropoff}
            onChange={(loc) => setLocation("dropoff", loc)}
            onRequestPin={() => armField("dropoff")}
            picking={armedField === "dropoff"}
            dotColor="#ef4444"
            dotSquare
            disabled={isLoading}
          />
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <TextField
            label="Cycle hours used"
            type="number"
            value={cycleHours}
            onChange={(e) => setCycleHours(e.target.value)}
            disabled={isLoading}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Start time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            disabled={isLoading}
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
      </Box>

      {/* Right pane: hero map, with the trip summary + Map/Logs toggle on top */}
      <Box sx={{ flex: 1, position: "relative", minWidth: 0, minHeight: 0 }}>
        {planResult && (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: 16,
              zIndex: 4,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              alignItems: "flex-start",
              maxWidth: "calc(100% - 32px)",
            }}
          >
            {hasDays && (
              <ToggleButtonGroup
                value={view}
                exclusive
                size="small"
                onChange={(_, v) => v && setView(v)}
                sx={{ bgcolor: "background.paper", boxShadow: 3 }}
              >
                <ToggleButton value="map">Map</ToggleButton>
                <ToggleButton value="logs">Daily Logs</ToggleButton>
              </ToggleButtonGroup>
            )}
            <Paper elevation={4} sx={{ px: 1.5, py: 1 }}>
              {stale && (
                <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
                  Inputs changed — re-plan to update.
                </Alert>
              )}
              {planResult.routing === "estimated" && (
                <Alert severity="info" sx={{ mb: 1, py: 0 }}>
                  Distances are approximate (estimated routing).
                </Alert>
              )}
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, opacity: stale ? 0.55 : 1 }}
              >
                {planResult.total_miles.toFixed(2)} miles · {planResult.segments.length}{" "}
                segments · {planResult.days.length} days
              </Typography>
            </Paper>
          </Box>
        )}

        {armedField && (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 5,
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
          routeDimmed={stale}
          focusPoint={focusPoint}
          fitSignal={fitSignal}
          startTimeMinutes={parseStartTimeMinutes(startTime)}
          onPinPlaced={armedField ? handleMapPick : undefined}
          showOverlays={view === "map"}
        />

        {view === "logs" && planResult && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              overflowY: "auto",
              p: 3,
              bgcolor: "rgba(8, 11, 16, 0.8)",
              backdropFilter: "blur(2px)",
            }}
          >
            {planResult.days.map((day) => {
              const dayMiles = day.segments.reduce(
                (sum, seg) => sum + (seg.miles ?? 0),
                0,
              );
              return (
                <Paper
                  key={day.date_offset}
                  sx={{ bgcolor: "#fff", p: 2, mb: 3, maxWidth: 900, mx: "auto" }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ color: "#555" }}>
                      Day {day.date_offset + 1}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: "#555" }}>
                      {dayMiles.toFixed(1)} mi driven
                    </Typography>
                  </Box>
                  <DailyLogSheet segments={day.segments} />
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
