"use client";

import { useEffect, useRef, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

import {
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

  return (
    <Autocomplete
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
      renderInput={(params) => (
        <TextField {...params} label={label} fullWidth />
      )}
    />
  );
}
