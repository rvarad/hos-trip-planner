"use client";

import { useEffect, useRef, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import MapView from "./MapView";
import {
  reverseGeocode,
  searchLocations,
  type ResolvedLocation,
} from "../lib/geocoding";

type LocationFieldProps = {
  label: string;
  value: ResolvedLocation | null;
  onChange: (location: ResolvedLocation | null) => void;
  mapCenter?: { lat: number; lng: number };
};

export default function LocationField({
  label,
  value,
  onChange,
  mapCenter,
}: LocationFieldProps) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<ResolvedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);

  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null,
  );

  useEffect(() => {
    const q = input.trim();
    if (!q) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const requestId = ++latestRequest.current;
    const timer = setTimeout(async () => {
      const results = await searchLocations(q, mapCenter);
      if (requestId === latestRequest.current) {
        setOptions(results);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [input, mapCenter]);

  async function handlePin(lat: number, lng: number) {
    setPin({ lat, lng });
    const resolved = await reverseGeocode(lat, lng);
    onChange(
      resolved ?? { label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng },
    );
    setPinOpen(false);
  }

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Autocomplete
          sx={{ flexGrow: 1 }}
          options={options}
          value={value}
          onChange={(_, newValue) => onChange(newValue)}
          onInputChange={(_, newInput, reason) => {
            if (reason === "input") setInput(newInput);
          }}
          filterOptions={(x) => x}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, selected) =>
            option.lat === selected.lat && option.lng === selected.lng
          }
          loading={loading}
          renderInput={(params) => <TextField {...params} label={label} />}
        />
        <Button onClick={() => setPinOpen(true)}>Drop pin</Button>
      </Stack>

      <Dialog open={pinOpen} onClose={() => setPinOpen(false)} maxWidth="md">
        <DialogTitle>Drop a pin</DialogTitle>
        <DialogContent>
          <div style={{ width: 520, maxWidth: "80vw", height: 400 }}>
            <MapView pin={pin} onPinPlaced={handlePin} fitToMarkers={false} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPinOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
