"use client";

import { useEffect, useRef } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type MarkerDragEvent,
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

// Semantic marker palette. "#38bdf8" matches the theme accent.
const MARKER_COLORS: Record<string, string> = {
  current: "#38bdf8", // trip start
  pickup: "#22c55e", // green
  dropoff: "#ef4444", // red
  fuel: "#f59e0b", // amber
  break: "#818cf8", // indigo — 30-min break
  rest: "#a855f7", // purple — 10h rest / 34h restart
};

function markerColor(kind: string): string {
  return MARKER_COLORS[kind] ?? "#38bdf8";
}

type MapViewProps = {
  markers?: MapMarker[];
  /** The planned route as ordered [lng, lat] pairs (GeoJSON order). */
  route?: [number, number][];
  fitToMarkers?: boolean;
  pin?: { lat: number; lng: number } | null;
  onPinPlaced?: (lat: number, lng: number) => void;
};

export default function MapView({
  markers,
  route,
  fitToMarkers = true,
  pin,
  onPinPlaced,
}: MapViewProps) {
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
      cursor={onPinPlaced ? "crosshair" : undefined}
      onClick={
        onPinPlaced
          ? (e: MapLayerMouseEvent) => onPinPlaced(e.lngLat.lat, e.lngLat.lng)
          : undefined
      }
    >
      <NavigationControl position="top-right" />
      {route && route.length >= 2 && (
        <Source
          id="route"
          type="geojson"
          data={{
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route },
          }}
        >
          <Layer
            id="route-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "#38bdf8", "line-width": 4, "line-opacity": 0.85 }}
          />
        </Source>
      )}
      {pin && (
        <Marker
          longitude={pin.lng}
          latitude={pin.lat}
          draggable={!!onPinPlaced}
          onDragEnd={(e: MarkerDragEvent) =>
            onPinPlaced?.(e.lngLat.lat, e.lngLat.lng)
          }
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#38bdf8",
              border: "3px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
            }}
          />
        </Marker>
      )}
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
