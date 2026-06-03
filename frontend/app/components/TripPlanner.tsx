"use client";

import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RouteIcon from "@mui/icons-material/Route";

import LocationField from "./LocationField";
import MapView, { type MapMarker } from "./MapView";
import DailyLogSheet from "./DailyLogSheet";
import Itinerary from "./Itinerary";
import { reverseGeocode, type ResolvedLocation } from "../lib/geocoding";
import { markersFromSegments, type PlanSegment } from "../lib/tripMarkers";
import { tripSummary } from "../lib/tripSummary";
import { formatClock, formatDuration } from "../lib/format";
import { splitRouteByDay } from "../lib/routeDays";

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

// The trip is assumed to start today; each day's log is dated start + offset.
function logDate(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm} / ${dd} / ${d.getFullYear()}`;
}

// Find the first human-readable string anywhere in a parsed error body. DRF
// nests validation messages (e.g. { pickup: { lat: ["Invalid"] } }); our proxy
// uses { error: "..." }. This digs out the first message either way.
function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const v of value) {
      const m = firstMessage(v);
      if (m) return m;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) {
      const m = firstMessage(v);
      if (m) return m;
    }
  }
  return null;
}

// Turn a failed plan response into a message worth showing the user.
async function planErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const msg = firstMessage(data);
    if (msg) return msg;
  } catch {
    // Non-JSON body (e.g. an HTML 500 page) — fall through to a generic message.
  }
  if (res.status === 502)
    return "The planning service is unavailable. Please try again shortly.";
  return `Something went wrong (error ${res.status}).`;
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
  // The day linked between the map and the logs (null = show the whole trip).
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
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

  // Set a location and focus the map on it (unless it was cleared). Editing an
  // input invalidates any plan, so leave the (now stale) Daily Logs for the map.
  function setLocation(field: FieldKey, loc: ResolvedLocation | null) {
    setterFor[field](loc);
    if (loc) setFocusPoint({ lat: loc.lat, lng: loc.lng });
    setView("map");
    setSelectedDay(null);
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

  // When opening the logs for a selected day (e.g. after clicking its route on
  // the map), scroll that day's sheet into view instead of landing on Day 1.
  useEffect(() => {
    if (view !== "logs" || selectedDay == null) return;
    document
      .getElementById(`day-log-${selectedDay}`)
      ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [view, selectedDay]);

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

  // Per-day route slices for a fresh plan (stale plans show the single dimmed
  // line). Each slice carries that day's miles + drive time for the hover popup.
  const routeDays =
    planResult && !stale
      ? splitRouteByDay(planResult.route, planResult.days).map((slice) => {
          const day = planResult.days.find(
            (d) => d.date_offset === slice.dateOffset,
          );
          const segs = day?.segments ?? [];
          return {
            ...slice,
            miles: segs.reduce((sum, s) => sum + (s.miles ?? 0), 0),
            driveMinutes: segs.reduce(
              (sum, s) =>
                s.status === "driving"
                  ? sum + ((s.end_min ?? 0) - (s.start_min ?? 0))
                  : sum,
              0,
            ),
          };
        })
      : undefined;

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

    // Don't let a hung backend spin forever — abort after 30s.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(await planErrorMessage(res));
      }
      const data: PlanResult = await res.json();
      setPlanResult(data);
      setPlanKey(inputsKey(current, pickup, dropoff, cycleHours, startTime));
      setSelectedDay(null);
      setFitSignal((n) => n + 1); // frame the whole trip once
      setFocusPoint(null);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setError("The request took too long. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      clearTimeout(timeout);
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
          backgroundImage:
            "radial-gradient(130% 180px at 0% 0%, rgba(56,189,248,0.16), transparent 70%)",
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* Brand header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #38bdf8, #6366f1)",
              boxShadow: "0 4px 14px rgba(56,189,248,0.45)",
            }}
          >
            <LocalShippingIcon sx={{ color: "#fff", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.3 }}
            >
              HOS Trip Planner
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              FMCSA-compliant routing &amp; ELD logs
            </Typography>
          </Box>
        </Box>

        {/* Route inputs */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1, fontSize: 10 }}
          >
            Route
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
        </Box>

        {/* Driver clock */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1, fontSize: 10 }}
          >
            Driver clock
          </Typography>
          <Stack direction="row" spacing={1.5}>
          <TextField
            label="Cycle hours used"
            type="number"
            value={cycleHours}
            onChange={(e) => {
              setCycleHours(e.target.value);
              setView("map");
              setSelectedDay(null);
            }}
            disabled={isLoading}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Start time"
            type="time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setView("map");
              setSelectedDay(null);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            disabled={isLoading}
            sx={{ flex: 1 }}
          />
          </Stack>
        </Box>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!canPlan}
          onClick={handleSubmit}
          startIcon={!isLoading ? <RouteIcon /> : undefined}
          sx={{
            py: 1.25,
            borderRadius: 2,
            fontSize: 16,
            fontWeight: 700,
            textTransform: "none",
            ...(canPlan && {
              background: "linear-gradient(135deg, #38bdf8, #6366f1)",
              boxShadow: "0 6px 18px rgba(56,189,248,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #0ea5e9, #4f46e5)",
              },
            }),
          }}
        >
          {isLoading ? "Planning…" : "Plan trip"}
        </Button>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Itinerary fills the panel below the form; an empty-state hint shows
            before a plan exists so the space never reads as dead. */}
        <Box sx={{ flex: 1, minHeight: 0, mt: 0.5 }}>
          <Typography
            variant="overline"
            sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1, fontSize: 10 }}
          >
            Itinerary
          </Typography>
          {planResult && !stale ? (
            <Itinerary
              days={planResult.days}
              selectedDay={selectedDay}
              onSelectDay={(offset) => {
                setSelectedDay(offset);
                setView("map");
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {stale
                ? "Inputs changed — the itinerary is out of date."
                : "Plan a trip to see a day-by-day itinerary with live HOS clocks here."}
            </Typography>
          )}
        </Box>
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
            {view === "map" && (
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
              {(() => {
                const s = tripSummary(planResult.segments);
                const startMin = parseStartTimeMinutes(startTime);
                const days = planResult.days.length;
                const stat = (value: string, label: string) => (
                  <Box sx={{ textAlign: "center", px: 0.25 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap" }}
                    >
                      {value}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: "block",
                        fontSize: 10,
                        lineHeight: 1,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                      }}
                    >
                      {label}
                    </Typography>
                  </Box>
                );
                return (
                  <Box sx={{ opacity: stale ? 0.55 : 1 }}>
                    <Stack
                      direction="row"
                      spacing={1.25}
                      divider={<Divider orientation="vertical" flexItem />}
                      sx={{ alignItems: "center" }}
                    >
                      {stat(planResult.total_miles.toFixed(2), "miles")}
                      {stat(formatDuration(s.driveMinutes), "drive")}
                      {stat(String(days), days === 1 ? "day" : "days")}
                      {stat(String(s.stops), "stops")}
                    </Stack>
                    {(s.destinationEtaMin != null || s.restartRequired) && (
                      <Box
                        sx={{
                          mt: 0.75,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        {s.destinationEtaMin != null && (
                          <Typography variant="caption" color="text.secondary">
                            Arrives {formatClock(startMin + s.destinationEtaMin)}
                          </Typography>
                        )}
                        {s.restartRequired && (
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="34-hr restart required"
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Paper>
            )}
            {view === "map" && selectedDay != null && (
              <Chip
                color="primary"
                label={`Day ${selectedDay + 1}`}
                onDelete={() => {
                  // Deselecting a day frames the whole trip again.
                  setSelectedDay(null);
                  setFitSignal((n) => n + 1);
                }}
                sx={{ bgcolor: "background.paper", boxShadow: 3 }}
                variant="outlined"
              />
            )}
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
          routeDays={routeDays}
          highlightDay={selectedDay}
          onDaySelect={(offset) => {
            setSelectedDay(offset);
            setView("logs");
          }}
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
              return (
                <Paper
                  key={day.date_offset}
                  id={`day-log-${day.date_offset}`}
                  data-selected={selectedDay === day.date_offset ? "true" : undefined}
                  onClick={() => {
                    setSelectedDay(day.date_offset);
                    setView("map");
                  }}
                  sx={{
                    bgcolor: "#fff",
                    p: 2,
                    mb: 3,
                    maxWidth: 900,
                    mx: "auto",
                    cursor: "pointer",
                    border: 2,
                    borderColor:
                      selectedDay === day.date_offset ? "primary.main" : "transparent",
                    "&:hover": { borderColor: "primary.light" },
                  }}
                  title="Show this day on the map"
                >
                  <DailyLogSheet
                    segments={day.segments}
                    dayNumber={day.date_offset + 1}
                    date={logDate(day.date_offset)}
                  />
                </Paper>
              );
            })}
          </Box>
        )}

        {/* Processing overlay: a light scrim (map stays partly visible) that
            also blocks map interaction while a plan request is in flight. */}
        {isLoading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              bgcolor: "rgba(8, 11, 16, 0.45)",
              backdropFilter: "blur(1px)",
            }}
          >
            <CircularProgress />
            <Typography variant="body2" sx={{ color: "#e2e8f0", fontWeight: 600 }}>
              Planning route…
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
