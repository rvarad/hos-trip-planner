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
    highlightDay,
    onDaySelect,
  }: {
    onPinPlaced?: (lat: number, lng: number) => void;
    focusPoint?: { lat: number; lng: number } | null;
    fitSignal?: number;
    highlightDay?: number | null;
    onDaySelect?: (offset: number) => void;
  }) => (
    <div
      data-testid="map"
      data-focus={focusPoint ? `${focusPoint.lat},${focusPoint.lng}` : ""}
      data-fit={String(fitSignal ?? 0)}
      data-highlight={highlightDay == null ? "" : String(highlightDay)}
    >
      <button onClick={() => onPinPlaced?.(40, -90)}>map-pick</button>
      <button onClick={() => onDaySelect?.(1)}>map-day-1</button>
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
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
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

  it("renders an enriched trip summary (drive time, stops, ETA, restart)", async () => {
    const loc = { label: "X", lat: 0, lng: 0 };
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "osrm",
        segments: [
          { start_min: 480, end_min: 600, status: "driving", description: "Drive", start_location: loc, end_location: loc, miles: 100 },
          { start_min: 600, end_min: 660, status: "on_duty_not_driving", description: "Pickup", start_location: loc, end_location: loc, miles: 0 },
          { start_min: 660, end_min: 900, status: "driving", description: "Drive", start_location: loc, end_location: loc, miles: 200 },
          { start_min: 900, end_min: 2940, status: "off_duty", description: "34-hour restart", start_location: loc, end_location: loc, miles: 0 },
          { start_min: 2940, end_min: 3000, status: "on_duty_not_driving", description: "Drop-off", start_location: loc, end_location: loc, miles: 0 },
        ],
        days: [{ date_offset: 0, segments: [] }],
        total_miles: 300,
        route: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    await resolveAll();
    await userEvent.click(plan());

    // drive time = (600-480) + (900-660) = 360 min = 6h (stat value)
    expect(await screen.findByText("6h")).toBeInTheDocument();
    // pickup + restart + drop-off = 3 stops (stat value)
    expect(screen.getByText("3")).toBeInTheDocument();
    // ETA = start 08:00 (480) + 2940 = 3420 => Day 3 · 09:00
    expect(screen.getByText(/Arrives Day 3 · 09:00/)).toBeInTheDocument();
    expect(screen.getByText(/restart required/i)).toBeInTheDocument();
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
    )! as unknown as [string, RequestInit];
    const body = JSON.parse(planCall[1].body as string);
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

  it("disables the inputs while a plan is processing", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((res) => (resolveFetch = res)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    await resolveAll();
    const cycle = screen.getByLabelText("Cycle hours used");
    expect(cycle).toBeEnabled();

    await userEvent.click(plan());
    // Request in flight: inputs are locked.
    await waitFor(() => expect(cycle).toBeDisabled());

    resolveFetch(
      okJson({ routing: "estimated", segments: [], days: [], total_miles: 0, route: [] }),
    );
    await waitFor(() => expect(cycle).toBeEnabled());
  });

  it("shows a processing overlay on the map while a plan is in flight", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((res) => (resolveFetch = res)),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);
    await resolveAll();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await userEvent.click(plan());
    await waitFor(() =>
      expect(screen.getByRole("progressbar")).toBeInTheDocument(),
    );
    expect(screen.getByText(/planning route/i)).toBeInTheDocument();

    resolveFetch(
      okJson({ routing: "estimated", segments: [], days: [], total_miles: 0, route: [] }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(),
    );
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
    expect(await screen.findByText("100.00")).toBeInTheDocument();
    // Not stale right after planning.
    expect(screen.queryByText(/re-plan/i)).not.toBeInTheDocument();

    // Changing an input (cycle hours) makes the plan stale.
    const cycle = screen.getByLabelText("Cycle hours used");
    await userEvent.clear(cycle);
    await userEvent.type(cycle, "5");
    expect(await screen.findByText(/re-plan/i)).toBeInTheDocument();
  });

  it("returns to the map view when an input changes while viewing logs", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "osrm",
        segments: [{ status: "driving" }],
        days: [
          {
            date_offset: 0,
            segments: [
              { start_min: 480, end_min: 600, status: "driving", miles: 250 },
            ],
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

    // Switch to the logs view (its sheet rows are visible).
    await userEvent.click(await screen.findByRole("button", { name: /daily logs/i }));
    expect((await screen.findAllByText("Driving")).length).toBeGreaterThan(0);

    // Changing a location should bounce back to the map (logs unmount).
    await userEvent.click(screen.getByText("field:Pickup"));
    await waitFor(() =>
      expect(screen.queryByText("Sleeper Berth")).not.toBeInTheDocument(),
    );
  });

  const twoDayPlan = () =>
    okJson({
      routing: "osrm",
      segments: [{ status: "driving" }],
      days: [
        {
          date_offset: 0,
          segments: [{ start_min: 480, end_min: 600, status: "driving", miles: 250 }],
        },
        {
          date_offset: 1,
          segments: [{ start_min: 0, end_min: 120, status: "driving", miles: 100 }],
        },
      ],
      total_miles: 350,
      route: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
    });

  it("highlights a day on the map when its log card is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => twoDayPlan()));
    render(<TripPlanner />);
    await resolveAll();
    await userEvent.click(plan());

    // Go to logs, then click the Day 2 card. ("Day 2" also appears in the panel
    // itinerary, so target the last match — the log card in the logs overlay.)
    await userEvent.click(await screen.findByRole("button", { name: /daily logs/i }));
    const day2 = await screen.findAllByText("Day 2");
    await userEvent.click(day2[day2.length - 1]);

    // Back on the map, with that day handed to MapView as the highlight.
    await waitFor(() =>
      expect(screen.queryByText("Sleeper Berth")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-highlight", "1");
  });

  it("opens the logs for a day when its route segment is clicked on the map", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => twoDayPlan()));
    render(<TripPlanner />);
    await resolveAll();
    await userEvent.click(plan());

    // Map view: click a day's route segment (mock fires onDaySelect(1)).
    await userEvent.click(await screen.findByText("map-day-1"));

    // The logs open (sheet rows visible) with that day selected.
    expect((await screen.findAllByText("Sleeper Berth")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("map")).toHaveAttribute("data-highlight", "1");
  });

  it("offers a Map/Daily Logs toggle and renders log sheets when a plan has days", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({
        routing: "osrm",
        segments: [{ status: "driving" }],
        days: [
          {
            date_offset: 0,
            segments: [
              { start_min: 480, end_min: 600, status: "driving", miles: 250 },
            ],
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

    // Switching to logs renders a DailyLogSheet (its row labels appear)...
    expect((await screen.findAllByText("Driving")).length).toBeGreaterThan(0);
    // ...with that day's driven miles in the form's mileage fields.
    expect((await screen.findAllByText("250.0")).length).toBeGreaterThan(0);
  });
});
