"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

import LocationField from "./LocationField";
import MapView, { type MapMarker } from "./MapView";
import { type ResolvedLocation } from "../lib/geocoding";

export default function TripPlanner() {
  const [current, setCurrent] = useState<ResolvedLocation | null>(null);
  const [pickup, setPickup] = useState<ResolvedLocation | null>(null);
  const [dropoff, setDropoff] = useState<ResolvedLocation | null>(null);
  const [cycleHours, setCycleHours] = useState("0");
  const [startTime, setStartTime] = useState("08:00");

  const markers: MapMarker[] = (
    [
      current && { ...current, kind: "current" },
      pickup && { ...pickup, kind: "pickup" },
      dropoff && { ...dropoff, kind: "dropoff" },
    ].filter(Boolean) as MapMarker[]
  );

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
        <Button variant="contained">Plan trip</Button>
      </Box>

      <Box sx={{ flex: 1, position: "relative" }}>
        <MapView markers={markers} />
      </Box>
    </Box>
  );
}
