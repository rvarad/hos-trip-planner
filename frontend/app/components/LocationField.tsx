"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

import {
  reverseGeocode,
  searchLocations,
  type ResolvedLocation,
} from "../lib/geocoding";

// The two "how to set this location" actions shown as distinct dropdown options.
type ActionOption = { action: "pin" | "geo"; label: string };
type Option = ResolvedLocation | ActionOption;

const ACTIONS: ActionOption[] = [
  { action: "pin", label: "Drop a pin on the map" },
  { action: "geo", label: "Use my location" },
];

function isAction(o: Option): o is ActionOption {
  return "action" in o;
}

type LocationFieldProps = {
  label: string;
  value: ResolvedLocation | null;
  onChange: (location: ResolvedLocation | null) => void;
  mapCenter?: { lat: number; lng: number };
  /** Ask the parent to start picking this field's location on the main map. */
  onRequestPin?: () => void;
  /** Reserved for the parent; not used visually here. */
  picking?: boolean;
  /** Leading dot color (origin/stop). Square dot marks the destination. */
  dotColor?: string;
  dotSquare?: boolean;
};

export default function LocationField({
  label,
  value,
  onChange,
  mapCenter,
  onRequestPin,
  dotColor,
  dotSquare,
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

  // Actions always sit at the top; search results follow.
  const allOptions: Option[] = [...ACTIONS, ...options];

  return (
    <Box>
      <Autocomplete<Option>
        options={allOptions}
        value={value}
        // Open on focus so the actions are immediately available; the actions
        // keep the list non-empty so there's never a bare "No options" popup.
        open={open}
        openOnFocus
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onChange={(_, newValue) => {
          // Actions are handled by their own onClick in renderOption.
          if (newValue && isAction(newValue)) return;
          onChange((newValue as ResolvedLocation | null) ?? null);
        }}
        onInputChange={(_, newInput, reason) => {
          if (reason === "input") setInput(newInput);
        }}
        filterOptions={(x) => x}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, selected) =>
          !isAction(option) &&
          !isAction(selected) &&
          option.lat === selected.lat &&
          option.lng === selected.lng
        }
        loading={loading}
        // No popup arrow; focus opens the list.
        forcePopupIcon={false}
        renderInput={(params) => {
          const inputSlot = (params.slotProps?.input ?? {}) as Record<string, unknown>;
          return (
            <TextField
              {...params}
              label={label}
              slotProps={{
                ...params.slotProps,
                input: {
                  ...inputSlot,
                  startAdornment: (
                    <>
                      {dotColor && (
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            ml: 0.5,
                            mr: 0.25,
                            flexShrink: 0,
                            borderRadius: dotSquare ? "2px" : "50%",
                            bgcolor: dotColor,
                            boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
                          }}
                        />
                      )}
                      {inputSlot.startAdornment as ReactNode}
                    </>
                  ),
                },
              }}
            />
          );
        }}
        renderOption={(props, option) => {
          // key must come BEFORE the spread — Turbopack merges a trailing key
          // into the props object instead of extracting it, leaving it keyless.
          const { key: _key, onClick, ...rest } = props;
          if (isAction(option)) {
            const Icon =
              option.action === "pin" ? PushPinOutlinedIcon : MyLocationIcon;
            return (
              <li
                key={option.action}
                {...rest}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (option.action === "pin") onRequestPin?.();
                  else handleUseMyLocation();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "#38bdf8",
                  fontWeight: 500,
                  backgroundColor: "rgba(56,189,248,0.08)",
                }}
              >
                <Icon fontSize="small" />
                {option.label}
              </li>
            );
          }
          // Photon can return several results with the same label, so key on
          // the coordinates instead of the (non-unique) label.
          const loc = option as ResolvedLocation;
          return (
            <li key={`${loc.lat},${loc.lng}`} {...rest} onClick={onClick}>
              {loc.label}
            </li>
          );
        }}
      />
      {value && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            ml: 0.5,
            color: "text.secondary",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {value.label}
        </Typography>
      )}
    </Box>
  );
}
