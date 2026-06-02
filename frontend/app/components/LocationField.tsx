"use client";

import { useEffect, useRef, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

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
  /** Ask the parent to start picking this field's location on the main map. */
  onRequestPin?: () => void;
  /** True while this field is armed for map picking (highlights the pin button). */
  picking?: boolean;
};

export default function LocationField({
  label,
  value,
  onChange,
  mapCenter,
  onRequestPin,
  picking,
}: LocationFieldProps) {
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<ResolvedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const latestRequest = useRef(0);

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

  function handleUseMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const resolved = await reverseGeocode(latitude, longitude);
      onChange(
        resolved ?? {
          label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          lat: latitude,
          lng: longitude,
        },
      );
    });
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Autocomplete
        sx={{ flexGrow: 1 }}
        options={options}
        value={value}
        // Only show the dropdown once there's something to show (results or a
        // pending search) — never an empty "No options" popup on a blank click.
        open={open && (options.length > 0 || loading)}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
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
        renderOption={(props, option) => {
          // Photon can return several results with the same label, so key on
          // the coordinates instead of the (non-unique) label.
          const { key: _key, ...rest } = props;
          return (
            <li {...rest} key={`${option.lat},${option.lng}`}>
              {option.label}
            </li>
          );
        }}
      />
      <Tooltip title="Drop pin (tap the map)">
        <IconButton
          aria-label="Drop pin"
          color={picking ? "primary" : "default"}
          onClick={onRequestPin}
        >
          <PushPinOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Use my location">
        <IconButton aria-label="Use my location" onClick={handleUseMyLocation}>
          <MyLocationIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
