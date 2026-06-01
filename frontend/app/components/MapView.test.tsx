import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
}));

import MapView from "./MapView";

describe("MapView", () => {
  it("renders the map with a navigation control", () => {
    render(<MapView />);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByTestId("nav-control")).toBeInTheDocument();
  });
});
