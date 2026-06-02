import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./LocationField", () => ({
  default: ({
    label,
    onChange,
    onRequestPin,
  }: {
    label: string;
    onChange: (l: { label: string; lat: number; lng: number }) => void;
    onRequestPin?: () => void;
  }) => (
    <div>
      <button onClick={() => onChange({ label, lat: 1, lng: 2 })}>
        field:{label}
      </button>
      <button onClick={() => onRequestPin?.()}>pin:{label}</button>
    </div>
  ),
}));
vi.mock("./MapView", () => ({
  default: ({
    onPinPlaced,
    focusPoint,
    fitSignal,
  }: {
    onPinPlaced?: (lat: number, lng: number) => void;
    focusPoint?: { lat: number; lng: number } | null;
    fitSignal?: number;
  }) => (
    <div
      data-testid="map"
      data-focus={focusPoint ? `${focusPoint.lat},${focusPoint.lng}` : ""}
      data-fit={String(fitSignal ?? 0)}
    >
      <button onClick={() => onPinPlaced?.(40, -90)}>map-pick</button>
    </div>
  ),
}));

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

  it("sets a field from a map tap after arming it (tap-to-place)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/api/reverse")) {
        return okJson({ result: { label: "Tapped Place", lat: 40, lng: -90 } });
      }
      return okJson({
        routing: "estimated",
        segments: [{ status: "driving" }],
        days: [],
        total_miles: 5,
        route: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);

    // Arm the pickup field, then tap the map → reverse-geocode that point.
    await userEvent.click(screen.getByText("pin:Pickup"));
    await userEvent.click(screen.getByText("map-pick"));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/reverse")),
      ).toBe(true),
    );

    // The tapped, reverse-geocoded location becomes the pickup: it flows into
    // the plan request body.
    await userEvent.click(screen.getByText("field:Current location"));
    await userEvent.click(screen.getByText("field:Drop-off"));
    await userEvent.click(plan());

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]) === "/api/plan-trip"),
      ).toBe(true),
    );
    const planCall = fetchMock.mock.calls.find(
      (c) => String(c[0]) === "/api/plan-trip",
    )!;
    const body = JSON.parse((planCall[1] as RequestInit).body as string);
    expect(body.pickup).toEqual({ label: "Tapped Place", lat: 40, lng: -90 });
  });

  it("focuses the newest location while entering and fits on plan", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "estimated",
        segments: [{ status: "driving" }],
        days: [],
        total_miles: 5,
        route: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    const map = screen.getByTestId("map");
    expect(map).toHaveAttribute("data-fit", "0");

    // Setting a location focuses the map on it.
    await userEvent.click(screen.getByText("field:Pickup"));
    expect(map).toHaveAttribute("data-focus", "1,2");

    // Planning fits the whole trip (fitSignal bumps).
    await userEvent.click(screen.getByText("field:Current location"));
    await userEvent.click(screen.getByText("field:Drop-off"));
    await userEvent.click(plan());
    await waitFor(() => expect(map).toHaveAttribute("data-fit", "1"));
  });

  it("marks the plan stale when an input changes after planning", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "osrm",
        segments: [{ status: "driving" }],
        days: [],
        total_miles: 100,
        route: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    await resolveAll();
    await userEvent.click(plan());
    expect(await screen.findByText(/100\.00 miles/)).toBeInTheDocument();
    // Not stale right after planning.
    expect(screen.queryByText(/re-plan/i)).not.toBeInTheDocument();

    // Changing an input (cycle hours) makes the plan stale.
    const cycle = screen.getByLabelText("Cycle hours used");
    await userEvent.clear(cycle);
    await userEvent.type(cycle, "5");
    expect(await screen.findByText(/re-plan/i)).toBeInTheDocument();
  });

  it("offers a Map/Daily Logs toggle and renders log sheets when a plan has days", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "osrm",
        segments: [{ status: "driving" }],
        days: [
          {
            date_offset: 0,
            segments: [{ start_min: 480, end_min: 600, status: "driving" }],
          },
        ],
        total_miles: 100,
        route: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    await resolveAll();
    await userEvent.click(plan());

    // The toggle appears once there's a plan with days; default view is the map.
    const logsToggle = await screen.findByRole("button", { name: /daily logs/i });
    await userEvent.click(logsToggle);

    // Switching to logs renders a DailyLogSheet (its row labels appear).
    expect((await screen.findAllByText("Driving")).length).toBeGreaterThan(0);
  });
});
