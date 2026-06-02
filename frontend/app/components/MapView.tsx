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
import { formatClock, formatDuration } from "../lib/format";
import { type DayRoute } from "../lib/routeDays";

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

// The route is drawn in one accent color; days are distinguished on hover
// (T11.12) rather than by per-day colors.
const ROUTE_COLOR = "#38bdf8";

function metaFor(kind: string) {
  return KIND_META[kind] ?? KIND_META.current;
}

type MapViewProps = {
  markers?: MapMarker[];
  /** The planned route as ordered [lng, lat] pairs (GeoJSON order). */
  route?: [number, number][];
  /** Draw the route muted/dashed to signal it's stale (inputs changed). */
  routeDimmed?: boolean;
  /** Route split into per-day slices; when present and not dimmed, the route is
   *  drawn per day and each day's segment is hoverable (overrides `route`). */
  routeDays?: DayRoute[];
  /** Persistently emphasize this day's route + fit the camera to it (logs link). */
  highlightDay?: number | null;
  /** Called with a day's offset when its route segment is clicked. */
  onDaySelect?: (dateOffset: number) => void;
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
  routeDays,
  highlightDay,
  onDaySelect,
  focusPoint,
  fitSignal = 0,
  pin,
  onPinPlaced,
  showOverlays = true,
  startTimeMinutes = 0,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  // The day whose route segment is under the cursor (with the cursor position).
  const [hoveredDay, setHoveredDay] = useState<{
    dateOffset: number;
    lng: number;
    lat: number;
  } | null>(null);

  // Close any open popup when the marker set changes (re-plan, focus, etc.).
  // Adjusted during render — the React-recommended alternative to a setState
  // effect (avoids the cascading-render lint rule).
  const [prevMarkers, setPrevMarkers] = useState(markers);
  if (markers !== prevMarkers) {
    setPrevMarkers(markers);
    setSelected(null);
  }

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

  // When a day is selected (from the logs), frame that day's route segment.
  useEffect(() => {
    if (highlightDay == null) return;
    const map = mapRef.current;
    const d = routeDays?.find((x) => x.dateOffset === highlightDay);
    if (!map || !d || d.coords.length < 2) return;
    const lngs = d.coords.map((c) => c[0]);
    const lats = d.coords.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 80, maxZoom: 9, duration: 800 },
    );
    // routeDays is read intentionally only when highlightDay changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightDay]);

  // Legend lists only the kinds actually on the map, in a stable order.
  const presentKinds = KIND_ORDER.filter((k) =>
    markers?.some((m) => m.kind === k),
  );

  // Per-day route slices are drawn (and hoverable) only for a fresh plan.
  // Hover is disabled while placing a pin (the map is in crosshair mode).
  const showDayRoutes = !!routeDays && routeDays.length > 0 && !routeDimmed;
  const dayLayerIds =
    showDayRoutes && !onPinPlaced
      ? routeDays!.map((d) => `route-day-line-${d.dateOffset}`)
      : [];

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -98.5795, latitude: 39.8283, zoom: 3.5 }}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      cursor={onPinPlaced ? "crosshair" : hoveredDay ? "pointer" : undefined}
      interactiveLayerIds={dayLayerIds}
      onClick={(e: MapLayerMouseEvent) => {
        if (onPinPlaced) {
          onPinPlaced(e.lngLat.lat, e.lngLat.lng);
          return;
        }
        const id = e.features?.[0]?.layer?.id;
        if (id && id.startsWith("route-day-line-") && onDaySelect) {
          onDaySelect(Number(id.slice("route-day-line-".length)));
        }
      }}
      onMouseMove={
        dayLayerIds.length
          ? (e: MapLayerMouseEvent) => {
              const id = e.features?.[0]?.layer?.id;
              if (id && id.startsWith("route-day-line-")) {
                setHoveredDay({
                  dateOffset: Number(id.slice("route-day-line-".length)),
                  lng: e.lngLat.lng,
                  lat: e.lngLat.lat,
                });
              } else if (hoveredDay) {
                setHoveredDay(null);
              }
            }
          : undefined
      }
      onMouseLeave={hoveredDay ? () => setHoveredDay(null) : undefined}
    >
      {showOverlays && <NavigationControl position="top-right" />}
      {showDayRoutes
        ? routeDays!.map((d) => {
            if (d.coords.length < 2) return null;
            // A day is emphasized when hovered, or persistently when selected.
            const emphasizedDay = hoveredDay?.dateOffset ?? highlightDay ?? null;
            const isHovered = emphasizedDay === d.dateOffset;
            const dimOthers = emphasizedDay != null && !isHovered;
            return (
              <Source
                key={d.dateOffset}
                id={`route-day-${d.dateOffset}`}
                type="geojson"
                data={{
                  type: "Feature",
                  properties: {},
                  geometry: { type: "LineString", coordinates: d.coords },
                }}
              >
                <Layer
                  id={`route-day-line-${d.dateOffset}`}
                  type="line"
                  layout={{ "line-join": "round", "line-cap": "round" }}
                  paint={{
                    "line-color": ROUTE_COLOR,
                    "line-width": isHovered ? 7 : 4,
                    "line-opacity": dimOthers ? 0.45 : 0.9,
                  }}
                />
              </Source>
            );
          })
        : route &&
          route.length >= 2 && (
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
                  "line-color": routeDimmed ? "#64748b" : ROUTE_COLOR,
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

      {hoveredDay &&
        (() => {
          const d = routeDays?.find((x) => x.dateOffset === hoveredDay.dateOffset);
          if (!d) return null;
          return (
            <Popup
              longitude={hoveredDay.lng}
              latitude={hoveredDay.lat}
              offset={12}
              closeButton={false}
              closeOnClick={false}
            >
              <div style={{ font: "12px/1.5 sans-serif", color: "#111", minWidth: 120 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  Day {d.dateOffset + 1}
                </div>
                {d.miles != null && <div>{Math.round(d.miles)} mi driven</div>}
                {d.driveMinutes != null && (
                  <div>{formatDuration(d.driveMinutes)} drive</div>
                )}
              </div>
            </Popup>
          );
        })()}

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
