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
  Source: ({ children, data }: any) => (
    <div
      data-testid="source"
      data-coords={JSON.stringify(data?.geometry?.coordinates)}
    >
      {children}
    </div>
  ),
  Layer: ({ id }: any) => <div data-testid={`layer-${id}`} />,
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

  it("hides the nav control and legend when showOverlays is false", () => {
    render(
      <MapView
        showOverlays={false}
        markers={[{ lat: 1, lng: 2, kind: "pickup" }]}
      />,
    );
    expect(screen.queryByTestId("nav-control")).not.toBeInTheDocument();
    expect(screen.queryByText("Pickup")).not.toBeInTheDocument();
  });

  it("shows a legend for the marker kinds present", () => {
    render(
      <MapView
        markers={[
          { lat: 1, lng: 2, kind: "pickup" },
          { lat: 3, lng: 4, kind: "fuel" },
        ]}
      />,
    );
    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("Fuel")).toBeInTheDocument();
    // Kinds not on the map aren't listed.
    expect(screen.queryByText("Rest")).not.toBeInTheDocument();
  });

  it("draws the route line through the given coordinates", () => {
    const route: [number, number][] = [
      [-87.6298, 41.8781],
      [-96.797, 32.7767],
    ];
    render(<MapView route={route} />);
    expect(screen.getByTestId("layer-route-line")).toBeInTheDocument();
    expect(screen.getByTestId("source")).toHaveAttribute(
      "data-coords",
      JSON.stringify(route),
    );
  });

  it("renders no route line when no route is given", () => {
    render(<MapView />);
    expect(screen.queryByTestId("source")).not.toBeInTheDocument();
  });
});
