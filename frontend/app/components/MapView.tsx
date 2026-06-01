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

function metaFor(kind: string) {
  return KIND_META[kind] ?? KIND_META.current;
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
      {markers?.map((m, i) => {
        const { color, Icon, label } = metaFor(m.kind);
        return (
          <Marker key={i} longitude={m.lng} latitude={m.lat}>
            <div
              title={m.label ?? label}
              style={{
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

      {presentKinds.length > 0 && (
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
