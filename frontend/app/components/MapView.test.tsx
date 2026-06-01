import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

import MapView from "./MapView";

describe("MapView", () => {
  it("renders the map with a navigation control", () => {
    render(<MapView />);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByTestId("nav-control")).toBeInTheDocument();
  });

  it("renders one marker per entry", () => {
    render(
      <MapView
        markers={[
          { lat: 41.8781, lng: -87.6298, kind: "pickup" },
          { lat: 32.7767, lng: -96.797, kind: "dropoff" },
        ]}
      />,
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });
});
