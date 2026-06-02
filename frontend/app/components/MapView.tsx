"use client";

import { useEffect, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
  type MarkerDragEvent,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { SvgIconComponent } from "@mui/icons-material";
import TripOriginIcon from "@mui/icons-material/TripOrigin";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import LocalCafeIcon from "@mui/icons-material/LocalCafe";
import HotelIcon from "@mui/icons-material/Hotel";

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type MapMarker = {
  lat: number;
  lng: number;
  kind: string;
  label?: string;
  // Optional itinerary detail shown in the marker popup.
  description?: string;
  /** Minutes from trip start when the driver reaches this point. */
  arrivalMin?: number;
  /** Stop length in minutes (0 for the trip start). */
  durationMin?: number;
  /** Cumulative driven miles reached by this point. */
  milesSoFar?: number;
};

function formatClock(totalMin: number): string {
  const day = Math.floor(totalMin / 1440) + 1;
  const minOfDay = ((totalMin % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minOfDay / 60)).padStart(2, "0");
  const mm = String(minOfDay % 60).padStart(2, "0");
  return `Day ${day} · ${hh}:${mm}`;
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${min} min`;
}

// Semantic marker palette + icon. "#38bdf8" matches the theme accent. This is
// the single source of truth for marker colors, icons, and legend labels.
const KIND_META: Record<
  string,
  { label: string; color: string; Icon: SvgIconComponent }
> = {
  current: { label: "Current", color: "#38bdf8", Icon: TripOriginIcon },
  pickup: { label: "Pickup", color: "#22c55e", Icon: Inventory2Icon },
  dropoff: { label: "Drop-off", color: "#ef4444", Icon: PlaceIcon },
  fuel: { label: "Fuel", color: "#f59e0b", Icon: LocalGasStationIcon },
  break: { label: "Break", color: "#818cf8", Icon: LocalCafeIcon },
  rest: { label: "Rest", color: "#a855f7", Icon: HotelIcon },
};

const KIND_ORDER = ["current", "pickup", "dropoff", "fuel", "break", "rest"];

function metaFor(kind: string) {
  return KIND_META[kind] ?? KIND_META.current;
}

type MapViewProps = {
  markers?: MapMarker[];
  /** The planned route as ordered [lng, lat] pairs (GeoJSON order). */
  route?: [number, number][];
  /** Draw the route muted/dashed to signal it's stale (inputs changed). */
  routeDimmed?: boolean;
  /** Fly to this point when it changes (focus the most recently set location). */
  focusPoint?: { lat: number; lng: number } | null;
  /** When this number changes, fit the camera to all markers (e.g. on Plan). */
  fitSignal?: number;
  pin?: { lat: number; lng: number } | null;
  onPinPlaced?: (lat: number, lng: number) => void;
  /** Show the nav control + legend. Hidden when the map is a dimmed backdrop. */
  showOverlays?: boolean;
  /** Minute-of-day the trip starts, for formatting popup arrival times. */
  startTimeMinutes?: number;
};

export default function MapView({
  markers,
  route,
  routeDimmed = false,
  focusPoint,
  fitSignal = 0,
  pin,
  onPinPlaced,
  showOverlays = true,
  startTimeMinutes = 0,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<MapMarker | null>(null);

  // Close any open popup when the marker set changes (re-plan, focus, etc.).
  useEffect(() => setSelected(null), [markers]);

  // Focus-newest: fly to the location the user just set/edited.
  useEffect(() => {
    if (!focusPoint) return;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: 11,
      duration: 800,
    });
  }, [focusPoint]);

  // Fit the whole trip when the parent bumps fitSignal (e.g. after Plan).
  useEffect(() => {
    if (!fitSignal) return;
    const map = mapRef.current;
    if (!map || !markers?.length) return;
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, maxZoom: 12, duration: 800 },
    );
    // markers are read intentionally only when fitSignal changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  // Legend lists only the kinds actually on the map, in a stable order.
  const presentKinds = KIND_ORDER.filter((k) =>
    markers?.some((m) => m.kind === k),
  );

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
      {showOverlays && <NavigationControl position="top-right" />}
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
            paint={{
              "line-color": routeDimmed ? "#64748b" : "#38bdf8",
              "line-width": 4,
              "line-opacity": routeDimmed ? 0.35 : 0.85,
              ...(routeDimmed ? { "line-dasharray": [2, 2] } : {}),
            }}
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
      {markers?.map((m, i) => {
        const { color, Icon } = metaFor(m.kind);
        return (
          <Marker key={i} longitude={m.lng} latitude={m.lat}>
            <div
              onMouseEnter={() => setSelected(m)}
              onMouseLeave={() => setSelected(null)}
              style={{
                cursor: "pointer",
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: color,
                border: "2px solid #fff",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon style={{ width: 15, height: 15, color: "#fff" }} />
            </div>
          </Marker>
        );
      })}

      {selected && (
        <Popup
          longitude={selected.lng}
          latitude={selected.lat}
          offset={18}
          closeButton={false}
          closeOnClick={false}
          onClose={() => setSelected(null)}
        >
          <div style={{ font: "12px/1.5 sans-serif", color: "#111", minWidth: 150 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>
              {selected.description ?? metaFor(selected.kind).label}
            </div>
            {selected.label && <div style={{ color: "#555" }}>{selected.label}</div>}
            {selected.arrivalMin != null && (
              <div>{formatClock(startTimeMinutes + selected.arrivalMin)}</div>
            )}
            {selected.durationMin ? (
              <div>Stop: {formatDuration(selected.durationMin)}</div>
            ) : null}
            {selected.milesSoFar != null && (
              <div>{Math.round(selected.milesSoFar)} mi so far</div>
            )}
          </div>
        </Popup>
      )}

      {showOverlays && presentKinds.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 8,
            bottom: 8,
            zIndex: 1,
            background: "rgba(17,23,30,0.85)",
            color: "#fff",
            borderRadius: 8,
            padding: "8px 10px",
            font: "12px sans-serif",
            boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          {presentKinds.map((k) => {
            const { label, color, Icon } = KIND_META[k];
            return (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: 12, height: 12, color: "#fff" }} />
                </span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </Map>
  );
}
