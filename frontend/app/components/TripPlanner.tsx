"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import LocationField from "./LocationField";
import MapView, { type MapMarker } from "./MapView";
import DailyLogSheet, { type DutySegment } from "./DailyLogSheet";
import { type ResolvedLocation } from "../lib/geocoding";
import { markersFromSegments, type PlanSegment } from "../lib/tripMarkers";

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

export default function TripPlanner() {
  const [current, setCurrent] = useState<ResolvedLocation | null>(null);
  const [pickup, setPickup] = useState<ResolvedLocation | null>(null);
  const [dropoff, setDropoff] = useState<ResolvedLocation | null>(null);
  const [cycleHours, setCycleHours] = useState("0");
  const [startTime, setStartTime] = useState("08:00");

  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          p: 1.5,
          alignItems: "center",
        }}
      >
        <Box sx={{ flex: "1 1 220px" }}>
          <LocationField label="Current location" value={current} onChange={setCurrent} />
        </Box>
        <Box sx={{ flex: "1 1 220px" }}>
          <LocationField label="Pickup" value={pickup} onChange={setPickup} />
        </Box>
        <Box sx={{ flex: "1 1 220px" }}>
          <LocationField label="Drop-off" value={dropoff} onChange={setDropoff} />
        </Box>
        <TextField
          label="Cycle hours used"
          type="number"
          value={cycleHours}
          onChange={(e) => setCycleHours(e.target.value)}
          sx={{ width: 150 }}
        />
        <TextField
          label="Start time"
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 140 }}
        />
        <Button variant="contained" disabled={!canPlan} onClick={handleSubmit}>
          {isLoading ? "Planning…" : "Plan trip"}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mx: 1.5 }}>
          {error}
        </Alert>
      )}

      {planResult && (
        <Box sx={{ px: 2, py: 1 }}>
          {planResult.routing === "estimated" && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Distances are approximate (estimated routing).
            </Alert>
          )}
          <Typography variant="body2">
            {planResult.total_miles} miles · {planResult.segments.length} segments · {planResult.days.length} days
          </Typography>
        </Box>
      )}

      {planResult && planResult.days.length > 0 && (
        <Box sx={{ px: 2, pb: 2, overflowY: "auto", maxHeight: "40vh" }}>
          <Typography variant="h6" sx={{ mt: 1, mb: 2 }}>Daily Logs</Typography>
          {planResult.days.map((day) => (
            <Box key={day.date_offset} sx={{ mb: 4 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
                Day {day.date_offset + 1}
              </Typography>
              <DailyLogSheet segments={day.segments} />
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ flex: 1, position: "relative" }}>
        <MapView markers={mapMarkers} route={planResult?.route} />
      </Box>
    </Box>
  );
}
