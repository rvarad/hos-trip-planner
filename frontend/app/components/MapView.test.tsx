import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children, onClick }: any) => (
    <div
      data-testid="map"
      onClick={() => onClick?.({ lngLat: { lng: -90, lat: 40 } })}
    >
      {children}
    </div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children, onDragEnd }: any) => (
    <div
      data-testid="marker"
      onClick={(e) => {
        e.stopPropagation();
        onDragEnd?.({ lngLat: { lng: -91, lat: 41 } });
      }}
    >
      {children}
    </div>
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

  it("fires onPinPlaced when the map is clicked in pick mode", () => {
    const onPinPlaced = vi.fn();
    render(<MapView onPinPlaced={onPinPlaced} />);
    fireEvent.click(screen.getByTestId("map"));
    expect(onPinPlaced).toHaveBeenCalledWith(40, -90);
  });

  it("fires onPinPlaced when the pin is dragged", () => {
    const onPinPlaced = vi.fn();
    render(<MapView pin={{ lat: 1, lng: 2 }} onPinPlaced={onPinPlaced} />);
    fireEvent.click(screen.getByTestId("marker"));
    expect(onPinPlaced).toHaveBeenCalledWith(41, -91);
  });
});
