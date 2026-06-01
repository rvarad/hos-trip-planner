"use client";

import { useEffect, useRef } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type MapMarker = {
  lat: number;
  lng: number;
  kind: string;
  label?: string;
};

// Minimal palette; the full semantic palette (fuel/rest/etc.) is fleshed out in
// T10. "#38bdf8" matches the theme accent.
const MARKER_COLORS: Record<string, string> = {
  current: "#38bdf8",
  pickup: "#22c55e",
  dropoff: "#ef4444",
};

function markerColor(kind: string): string {
  return MARKER_COLORS[kind] ?? "#38bdf8";
}

type MapViewProps = {
  markers?: MapMarker[];
  fitToMarkers?: boolean;
};

export default function MapView({ markers, fitToMarkers = true }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!fitToMarkers || !markers?.length) return;
    const map = mapRef.current;
    if (!map) return;
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, maxZoom: 12, duration: 0 },
    );
  }, [markers, fitToMarkers]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -98.5795, latitude: 39.8283, zoom: 3.5 }}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="top-right" />
      {markers?.map((m, i) => (
        <Marker key={i} longitude={m.lng} latitude={m.lat}>
          <div
            title={m.label}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: markerColor(m.kind),
              border: "2px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
            }}
          />
        </Marker>
      ))}
    </Map>
  );
}
