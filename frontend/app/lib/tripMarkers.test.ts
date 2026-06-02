import { describe, expect, it } from "vitest";

import { markersFromSegments, type PlanSegment } from "./tripMarkers";

const loc = (label: string, lat: number, lng: number) => ({ label, lat, lng });

function seg(
  description: string,
  status: string,
  location: { label: string; lat: number; lng: number },
): PlanSegment {
  return {
    start_min: 0,
    end_min: 0,
    status,
    description,
    start_location: location,
    end_location: location,
    miles: 0,
  };
}

describe("markersFromSegments", () => {
  it("derives a current marker from the first segment plus one per stop", () => {
    const chicago = loc("Chicago", 41.8781, -87.6298);
    const enroute = loc("En route", 39.5, -93.4);
    const kc = loc("Kansas City", 39.0997, -94.5786);
    const fuel = loc("Fuel", 37, -100);
    const rest = loc("Rest", 35, -110);
    const la = loc("Los Angeles", 34.0522, -118.2437);

    const segments = [
      seg("Drive to Kansas City", "driving", chicago),
      seg("30-min break", "off_duty", enroute),
      seg("Pickup", "on_duty_not_driving", kc),
      seg("Drive to Los Angeles", "driving", kc),
      seg("Fuel stop", "on_duty_not_driving", fuel),
      seg("10-hour rest", "off_duty", rest),
      seg("Drop-off", "on_duty_not_driving", la),
    ];

    const markers = markersFromSegments(segments);
    // Driving segments contribute no stop marker (the route line covers them).
    expect(markers.map((m) => m.kind)).toEqual([
      "current",
      "break",
      "pickup",
      "fuel",
      "rest",
      "dropoff",
    ]);
    expect(markers[0]).toMatchObject({ kind: "current", lat: 41.8781, lng: -87.6298 });
    expect(markers[2]).toMatchObject({ kind: "pickup", lat: 39.0997, lng: -94.5786 });
  });

  it("maps a 34-hour restart to a rest marker", () => {
    const markers = markersFromSegments([
      seg("34-hour restart", "off_duty", loc("X", 1, 2)),
    ]);
    expect(markers.map((m) => m.kind)).toEqual(["current", "rest"]);
  });

  it("enriches stop markers with cumulative miles, arrival and duration", () => {
    const a = loc("A", 0, 0);
    const kc = loc("Kansas City", 1, 1);
    const segments = [
      {
        start_min: 0,
        end_min: 120,
        status: "driving",
        description: "Drive to Kansas City",
        start_location: a,
        end_location: kc,
        miles: 100,
      },
      {
        start_min: 120,
        end_min: 180,
        status: "on_duty_not_driving",
        description: "Pickup",
        start_location: kc,
        end_location: kc,
        miles: 0,
      },
    ];
    const markers = markersFromSegments(segments);
    const pickup = markers.find((m) => m.kind === "pickup")!;
    expect(pickup.milesSoFar).toBe(100);
    expect(pickup.arrivalMin).toBe(120);
    expect(pickup.durationMin).toBe(60);
    expect(pickup.description).toBe("Pickup");
  });

  it("returns no markers for an empty timeline", () => {
    expect(markersFromSegments([])).toEqual([]);
  });

  it("skips segments without a location (defensive)", () => {
    const markers = markersFromSegments([
      { start_min: 0, end_min: 1, status: "driving", description: "Drive", miles: 0 },
    ]);
    expect(markers).toEqual([]);
  });
});
