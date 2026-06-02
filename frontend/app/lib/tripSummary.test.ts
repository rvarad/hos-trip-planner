import { describe, expect, it } from "vitest";

import { tripSummary } from "./tripSummary";
import { type PlanSegment } from "./tripMarkers";

const loc = { label: "X", lat: 0, lng: 0 };

function seg(
  description: string,
  status: string,
  start_min: number,
  end_min: number,
  miles = 0,
): PlanSegment {
  return { description, status, start_min, end_min, miles, start_location: loc, end_location: loc };
}

describe("tripSummary", () => {
  it("sums driving time across only the driving segments", () => {
    const s = tripSummary([
      seg("Drive to Pickup", "driving", 480, 600, 100),
      seg("Pickup", "on_duty_not_driving", 600, 660),
      seg("Drive to Drop-off", "driving", 660, 900, 200),
    ]);
    expect(s.driveMinutes).toBe(120 + 240);
  });

  it("counts non-driving stops and flags a 34-hour restart", () => {
    const s = tripSummary([
      seg("Drive", "driving", 0, 60, 50),
      seg("Pickup", "on_duty_not_driving", 60, 120),
      seg("Fuel stop", "on_duty_not_driving", 200, 230),
      seg("34-hour restart", "off_duty", 230, 2270),
      seg("Drop-off", "on_duty_not_driving", 2270, 2330),
    ]);
    expect(s.stops).toBe(4); // pickup, fuel, restart, drop-off
    expect(s.restartRequired).toBe(true);
  });

  it("reports the drop-off arrival as the destination ETA", () => {
    const s = tripSummary([
      seg("Drive", "driving", 0, 120, 100),
      seg("Drop-off", "on_duty_not_driving", 120, 180),
    ]);
    expect(s.destinationEtaMin).toBe(120);
  });

  it("has no restart flag or ETA when neither is present", () => {
    const s = tripSummary([seg("Drive", "driving", 0, 60, 50)]);
    expect(s.restartRequired).toBe(false);
    expect(s.destinationEtaMin).toBeNull();
    expect(s.stops).toBe(0);
  });

  it("is robust to segments missing start/end minutes", () => {
    const s = tripSummary([
      { description: "Drive", status: "driving", miles: 0 } as unknown as PlanSegment,
    ]);
    expect(s.driveMinutes).toBe(0);
  });
});
