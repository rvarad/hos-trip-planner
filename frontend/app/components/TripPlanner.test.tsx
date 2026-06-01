import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./LocationField", () => ({
  default: ({ label }: { label: string }) => <div>field:{label}</div>,
}));
vi.mock("./MapView", () => ({ default: () => <div data-testid="map" /> }));

import TripPlanner from "./TripPlanner";

describe("TripPlanner", () => {
  it("renders three location fields, cycle hours, start time, and the plan button", () => {
    render(<TripPlanner />);
    expect(screen.getByText("field:Current location")).toBeInTheDocument();
    expect(screen.getByText("field:Pickup")).toBeInTheDocument();
    expect(screen.getByText("field:Drop-off")).toBeInTheDocument();
    expect(screen.getByLabelText("Cycle hours used")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /plan trip/i })).toBeInTheDocument();
  });
});
