"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { SvgIconComponent } from "@mui/icons-material";
import DriveEtaIcon from "@mui/icons-material/DriveEta";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import HotelIcon from "@mui/icons-material/Hotel";

import { type PlanSegment } from "../lib/tripMarkers";
import { formatDuration } from "../lib/format";

interface ItineraryDay {
  date_offset: number;
  segments: PlanSegment[];
}

type ItineraryProps = {
  days: ItineraryDay[];
  /** The currently linked day (highlighted); clicking a day calls onSelectDay. */
  selectedDay?: number | null;
  onSelectDay?: (dateOffset: number) => void;
};

const META: Record<string, { Icon: SvgIconComponent; color: string }> = {
  drive: { Icon: DriveEtaIcon, color: "#38bdf8" },
  pickup: { Icon: Inventory2Icon, color: "#22c55e" },
  dropoff: { Icon: PlaceIcon, color: "#ef4444" },
  fuel: { Icon: LocalGasStationIcon, color: "#f59e0b" },
  break: { Icon: LocalCafeIcon, color: "#818cf8" },
  rest: { Icon: HotelIcon, color: "#a855f7" },
};

const STOP_KIND: Record<string, string> = {
  Pickup: "pickup",
  "Drop-off": "dropoff",
  "Fuel stop": "fuel",
  "30-min break": "break",
  "10-hour rest": "rest",
  "34-hour restart": "rest",
};

function kindOf(seg: PlanSegment): string {
  if (seg.status === "driving") return "drive";
  return STOP_KIND[seg.description] ?? "drive";
}

function hhmm(minOfDay: number): string {
  const hh = String(Math.floor(minOfDay / 60)).padStart(2, "0");
  const mm = String(minOfDay % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function Itinerary({ days, selectedDay, onSelectDay }: ItineraryProps) {
  return (
    <Box>
      {days.map((day) => {
        const driveMin = day.segments.reduce(
          (sum, s) => (s.status === "driving" ? sum + (s.end_min - s.start_min) : sum),
          0,
        );
        const miles = day.segments.reduce((sum, s) => sum + (s.miles ?? 0), 0);
        const selected = selectedDay === day.date_offset;
        return (
          <Box key={day.date_offset} sx={{ mb: 1.5 }}>
            {/* Day header — click to highlight this day across all views */}
            <Box
              onClick={() => onSelectDay?.(day.date_offset)}
              data-selected={selected ? "true" : undefined}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 1,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                cursor: onSelectDay ? "pointer" : "default",
                bgcolor: selected ? "rgba(56,189,248,0.28)" : "transparent",
                borderLeft: 3,
                borderColor: selected ? "primary.main" : "transparent",
                boxShadow: selected ? "inset 0 0 0 1px rgba(56,189,248,0.5)" : "none",
                "&:hover": onSelectDay
                  ? { bgcolor: selected ? "rgba(56,189,248,0.28)" : "rgba(56,189,248,0.10)" }
                  : undefined,
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Day {day.date_offset + 1}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(miles)} mi · {formatDuration(driveMin)} drive
              </Typography>
            </Box>

            {/* Each leg / stop on that day */}
            {day.segments.map((seg, i) => {
              const kind = kindOf(seg);
              const { Icon, color } = META[kind] ?? META.drive;
              const duration = seg.end_min - seg.start_min;
              const isDrive = kind === "drive";
              const title = isDrive
                ? `Drive ${Math.round(seg.miles ?? 0)} mi`
                : seg.description;
              const place = isDrive
                ? seg.end_location?.label
                : seg.start_location?.label;
              return (
                <Box key={i} sx={{ display: "flex", gap: 1, px: 1, py: 0.5 }}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      mt: 0.25,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: color,
                    }}
                  >
                    <Icon sx={{ fontSize: 13, color: "#fff" }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {hhmm(seg.start_min)}
                      </Typography>
                    </Box>
                    {place && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", lineHeight: 1.3, wordBreak: "break-word" }}
                      >
                        {isDrive ? `to ${place}` : place} · {formatDuration(duration)}
                      </Typography>
                    )}
                    {seg.clocks && (
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "#7dd3fc", lineHeight: 1.3 }}
                      >
                        {formatDuration(seg.clocks.drive_remaining_min)} drive ·{" "}
                        {formatDuration(seg.clocks.window_remaining_min)} window ·{" "}
                        {formatDuration(seg.clocks.cycle_remaining_min)} cycle left
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
