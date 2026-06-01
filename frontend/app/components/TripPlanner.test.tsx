import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./LocationField", () => ({
  default: ({
    label,
    onChange,
  }: {
    label: string;
    onChange: (l: { label: string; lat: number; lng: number }) => void;
  }) => (
    <button onClick={() => onChange({ label, lat: 1, lng: 2 })}>
      field:{label}
    </button>
  ),
}));
vi.mock("./MapView", () => ({ default: () => <div data-testid="map" /> }));

import TripPlanner from "./TripPlanner";

afterEach(() => vi.unstubAllGlobals());

function okJson(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const plan = () => screen.getByRole("button", { name: /plan trip/i });

async function resolveAll() {
  await userEvent.click(screen.getByText("field:Current location"));
  await userEvent.click(screen.getByText("field:Pickup"));
  await userEvent.click(screen.getByText("field:Drop-off"));
}

describe("TripPlanner", () => {
  it("renders three location fields, cycle hours, start time, and the plan button", () => {
    render(<TripPlanner />);
    expect(screen.getByText("field:Current location")).toBeInTheDocument();
    expect(screen.getByText("field:Pickup")).toBeInTheDocument();
    expect(screen.getByText("field:Drop-off")).toBeInTheDocument();
    expect(screen.getByLabelText("Cycle hours used")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(plan()).toBeInTheDocument();
  });

  it("disables Plan until all three locations are resolved", async () => {
    render(<TripPlanner />);
    expect(plan()).toBeDisabled();
    await userEvent.click(screen.getByText("field:Current location"));
    await userEvent.click(screen.getByText("field:Pickup"));
    expect(plan()).toBeDisabled();
    await userEvent.click(screen.getByText("field:Drop-off"));
    expect(plan()).toBeEnabled();
  });

  it("disables Plan when cycle hours are out of range", async () => {
    render(<TripPlanner />);
    await resolveAll();
    const cycle = screen.getByLabelText("Cycle hours used");
    await userEvent.clear(cycle);
    await userEvent.type(cycle, "99");
    expect(plan()).toBeDisabled();
  });

  it("submits the trip and renders the result summary", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "estimated",
        segments: [{ status: "driving" }, { status: "on_duty_not_driving" }],
        days: [],
        total_miles: 804.567,
        route: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    await resolveAll();
    expect(plan()).toBeEnabled();
    await userEvent.click(plan());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/plan-trip");
    const body = JSON.parse(init.body as string);
    expect(body.current_location).toEqual({
      label: "Current location",
      lat: 1,
      lng: 2,
    });
    expect(body.cycle_hours_used).toBe(0);
    expect(body.start_time_minutes).toBe(480);

    expect(await screen.findByText(/804\.57/)).toBeInTheDocument();
    expect(await screen.findByText(/approximate/i)).toBeInTheDocument();
  });
});
