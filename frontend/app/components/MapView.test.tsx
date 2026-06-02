import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children, onClick, onMouseMove, onMouseLeave }: any) => (
    <div
      data-testid="map"
      onClick={() => onClick?.({ lngLat: { lng: -90, lat: 40 } })}
    >
      {/* Test affordances to simulate maplibre's interactive-layer hover. */}
      <button
        data-testid="hover-day-1"
        onClick={(e) => {
          e.stopPropagation();
          onMouseMove?.({
            features: [{ layer: { id: "route-day-line-1" } }],
            lngLat: { lng: -90, lat: 40 },
          });
        }}
      />
      <button
        data-testid="hover-off"
        onClick={(e) => {
          e.stopPropagation();
          onMouseLeave?.();
        }}
      />
      {children}
    </div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children, onClick, onDragEnd }: any) => (
    <div
      data-testid="marker"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
        onDragEnd?.({ lngLat: { lng: -91, lat: 41 } });
      }}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
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

  it("shows a popup with stop details on hover, and hides it on leave", () => {
    render(
      <MapView
        startTimeMinutes={480}
        markers={[
          {
            lat: 1,
            lng: 2,
            kind: "fuel",
            label: "Pilot Travel Center",
            description: "Fuel stop",
            arrivalMin: 600,
            durationMin: 30,
            milesSoFar: 500,
          },
        ]}
      />,
    );
    const badge = screen.getByTestId("marker").firstChild as Element;
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();

    fireEvent.mouseEnter(badge);
    expect(screen.getByTestId("popup")).toBeInTheDocument();
    expect(screen.getByText("Fuel stop")).toBeInTheDocument();
    // 480 + 600 = 1080 min => Day 1, 18:00
    expect(screen.getByText(/18:00/)).toBeInTheDocument();
    expect(screen.getByText(/500 mi/)).toBeInTheDocument();

    fireEvent.mouseLeave(badge);
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
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

  it("draws one route layer per day", () => {
    render(
      <MapView
        routeDays={[
          { dateOffset: 0, coords: [[0, 0], [0, 1]] },
          { dateOffset: 1, coords: [[0, 1], [0, 2]] },
        ]}
      />,
    );
    expect(screen.getByTestId("layer-route-day-line-0")).toBeInTheDocument();
    expect(screen.getByTestId("layer-route-day-line-1")).toBeInTheDocument();
    // The single combined line is not used when per-day slices are given.
    expect(screen.queryByTestId("layer-route-line")).not.toBeInTheDocument();
  });

  it("shows a day-info popup on hovering a day's route segment", () => {
    render(
      <MapView
        routeDays={[
          { dateOffset: 0, coords: [[0, 0], [0, 1]], miles: 100, driveMinutes: 120 },
          { dateOffset: 1, coords: [[0, 1], [0, 2]], miles: 250, driveMinutes: 240 },
        ]}
      />,
    );
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hover-day-1"));
    expect(screen.getByTestId("popup")).toBeInTheDocument();
    expect(screen.getByText("Day 2")).toBeInTheDocument();
    expect(screen.getByText(/250 mi driven/)).toBeInTheDocument();
    expect(screen.getByText(/4h drive/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("hover-off"));
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });

  it("falls back to the single dimmed line for a stale route", () => {
    render(
      <MapView
        routeDimmed
        route={[[0, 0], [0, 2]]}
        routeDays={[
          { dateOffset: 0, coords: [[0, 0], [0, 1]] },
          { dateOffset: 1, coords: [[0, 1], [0, 2]] },
        ]}
      />,
    );
    // Dimmed: per-day coloring is suppressed; the single route line is drawn.
    expect(screen.getByTestId("layer-route-line")).toBeInTheDocument();
    expect(screen.queryByTestId("layer-route-day-line-0")).not.toBeInTheDocument();
  });
});
