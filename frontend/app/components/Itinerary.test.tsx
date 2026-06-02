import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Itinerary from "./Itinerary";
import { type PlanSegment } from "../lib/tripMarkers";

const place = (label: string) => ({ label, lat: 0, lng: 0 });

const days = [
  {
    date_offset: 0,
    segments: [
      {
        start_min: 480,
        end_min: 600,
        status: "driving",
        description: "Drive to Joliet, IL",
        start_location: place("Chicago, IL"),
        end_location: place("Joliet, IL"),
        miles: 60,
        clocks: {
          drive_remaining_min: 540,
          window_remaining_min: 720,
          break_remaining_min: 360,
          cycle_remaining_min: 4140,
        },
      },
      {
        start_min: 600,
        end_min: 660,
        status: "on_duty_not_driving",
        description: "Pickup",
        start_location: place("Joliet, IL"),
        end_location: place("Joliet, IL"),
        miles: 0,
        clocks: {
          drive_remaining_min: 540,
          window_remaining_min: 660,
          break_remaining_min: 480,
          cycle_remaining_min: 4080,
        },
      },
    ] as PlanSegment[],
  },
  {
    date_offset: 1,
    segments: [
      {
        start_min: 0,
        end_min: 120,
        status: "driving",
        description: "Drive to Dallas, TX",
        start_location: place("Joliet, IL"),
        end_location: place("Dallas, TX"),
        miles: 100,
        clocks: null,
      },
    ] as PlanSegment[],
  },
];

describe("Itinerary", () => {
  it("groups legs by day with subtotals and shows HOS clocks", () => {
    render(<Itinerary days={days} />);

    expect(screen.getByText("Day 1")).toBeInTheDocument();
    expect(screen.getByText("Day 2")).toBeInTheDocument();
    // Day 1 subtotal: 60 mi, 2h drive.
    expect(screen.getByText(/60 mi · 2h drive/)).toBeInTheDocument();
    // A stop and a drive leg.
    expect(screen.getByText("Pickup")).toBeInTheDocument();
    expect(screen.getByText("Drive 60 mi")).toBeInTheDocument();
    // HOS clocks line (drive remaining 540 min = 9h).
    expect(screen.getByText(/9h drive · 12h window · 69h cycle left/)).toBeInTheDocument();
  });

  it("calls onSelectDay when a day header is clicked", async () => {
    const onSelectDay = vi.fn();
    render(<Itinerary days={days} onSelectDay={onSelectDay} />);
    await userEvent.click(screen.getByText("Day 2"));
    expect(onSelectDay).toHaveBeenCalledWith(1);
  });
});
