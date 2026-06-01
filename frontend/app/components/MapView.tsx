"use client";

import Map, { NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function MapView() {
  return (
    <Map
      initialViewState={{ longitude: -98.5795, latitude: 39.8283, zoom: 3.5 }}
      mapStyle={MAP_STYLE}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl position="top-right" />
    </Map>
  );
}
