"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

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
  disabled?: boolean;
};

export default function LocationField({
  label,
  value,
  onChange,
  mapCenter,
  onRequestPin,
  dotColor,
  dotSquare,
  disabled,
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
        disabled={disabled}
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
            const isPin = option.action === "pin";
            const Icon = isPin ? PushPinOutlinedIcon : MyLocationIcon;
            const description = isPin
              ? "Tap the map to place it"
              : "From your device location";
            return (
              <Box
                component="li"
                key={option.action}
                {...rest}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (isPin) onRequestPin?.();
                  else handleUseMyLocation();
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                  // Separate the geolocation action from the search results below.
                  borderBottom: option.action === "geo" ? 1 : 0,
                  borderColor: "divider",
                  "&:hover": { bgcolor: "rgba(56,189,248,0.14)" },
                }}
              >
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    flexShrink: 0,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(56,189,248,0.18)",
                    color: "#38bdf8",
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: "#38bdf8", lineHeight: 1.2 }}
                  >
                    {option.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {description}
                  </Typography>
                </Box>
              </Box>
            );
          }
          // Photon can return several results with the same label, so key on
          // the coordinates instead of the (non-unique) label.
          const loc = option as ResolvedLocation;
          return (
            <Box
              component="li"
              key={`${loc.lat},${loc.lng}`}
              {...rest}
              onClick={onClick}
              sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.25, py: 0.75 }}
            >
              <PlaceOutlinedIcon
                fontSize="small"
                sx={{ color: "text.secondary", flexShrink: 0 }}
              />
              <Typography variant="body2" sx={{ minWidth: 0 }}>
                {loc.label}
              </Typography>
            </Box>
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
