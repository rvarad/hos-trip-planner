import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DailyLogSheet, { type DutySegment } from "./DailyLogSheet";

describe("DailyLogSheet", () => {
  it("renders an SVG element", () => {
    const { container } = render(<DailyLogSheet />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders four status row labels", () => {
    render(<DailyLogSheet />);
    expect(screen.getByText("Off Duty")).toBeInTheDocument();
    expect(screen.getByText("Sleeper Berth")).toBeInTheDocument();
    expect(screen.getByText("Driving")).toBeInTheDocument();
    expect(screen.getByText("On Duty (Not Driving)")).toBeInTheDocument();
  });

  it("renders hour labels including Midnight and Noon", () => {
    render(<DailyLogSheet />);
    expect(screen.getAllByText("Mid").length).toBeGreaterThan(0);
    expect(screen.getByText("N")).toBeInTheDocument();
    // numeric hours
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("6").length).toBeGreaterThanOrEqual(2);
  });

  it("renders hour gridlines", () => {
    const { container } = render(<DailyLogSheet />);
    // 25 major vertical gridlines (hours 0–24 inclusive)
    const majorLines = container.querySelectorAll(".grid-hour");
    expect(majorLines.length).toBe(25);
  });

  it("renders quarter-hour tick marks", () => {
    const { container } = render(<DailyLogSheet />);
    // 24 hours × 3 interior quarter marks = 72
    const ticks = container.querySelectorAll(".grid-quarter");
    expect(ticks.length).toBe(72);
  });

  describe("with duty segments", () => {
    const mockSegments: DutySegment[] = [
      { start_min: 0, end_min: 480, status: "off_duty" },             // 8 hours Off Duty
      { start_min: 480, end_min: 540, status: "on_duty_not_driving" },// 1 hour On Duty
      { start_min: 540, end_min: 1140, status: "driving" },           // 10 hours Driving
      { start_min: 1140, end_min: 1440, status: "sleeper_berth" },    // 5 hours Sleeper
    ];

    it("renders the continuous duty status polyline", () => {
      const { container } = render(<DailyLogSheet segments={mockSegments} />);
      const polylines = container.querySelectorAll(".status-line");
      // Could be one continuous polyline or multiple lines.
      // We check that at least one status-line element is rendered.
      expect(polylines.length).toBeGreaterThan(0);
    });

    it("calculates and renders per-status hour totals", () => {
      render(<DailyLogSheet segments={mockSegments} />);
      
      // "Total Hours" header
      expect(screen.getByText("Total Hours")).toBeInTheDocument();
      
      // 8h off duty
      expect(screen.getByText("8.00")).toBeInTheDocument();
      // 5h sleeper
      expect(screen.getByText("5.00")).toBeInTheDocument();
      // 10h driving
      expect(screen.getByText("10.00")).toBeInTheDocument();
      // 1h on duty
      expect(screen.getByText("1.00")).toBeInTheDocument();
    });

    it("fills unaccounted time as off-duty", () => {
      // Missing first 2 hours (120 mins) and last 2 hours (120 mins).
      // Provided segments: 2h to 22h (20 hours total).
      // Provided: 10 hours driving, 10 hours on duty.
      // Expected totals:
      // Off Duty: 4.00 (the unaccounted 2h + 2h)
      // Driving: 10.00
      // On Duty: 10.00
      // Sleeper: 0.00
      const partialSegments: DutySegment[] = [
        { start_min: 120, end_min: 720, status: "driving" },            // 10h
        { start_min: 720, end_min: 1320, status: "on_duty_not_driving" },// 10h
      ];
      
      render(<DailyLogSheet segments={partialSegments} />);
      expect(screen.getByText("4.00")).toBeInTheDocument();  // Off Duty
      expect(screen.getByText("0.00")).toBeInTheDocument();  // Sleeper
      expect(screen.getAllByText("10.00").length).toBe(2);   // Driving & On Duty
    });
  });

  describe("filled-out form fields", () => {
    const chicago = { label: "Chicago, IL", lat: 41.8781, lng: -87.6298 };
    const joliet = { label: "Joliet, IL", lat: 41.525, lng: -88.0817 };
    const filledSegments: DutySegment[] = [
      {
        start_min: 480,
        end_min: 600,
        status: "driving",
        description: "Drive to pickup",
        start_location: chicago,
        end_location: joliet,
        miles: 60,
      },
      {
        start_min: 600,
        end_min: 660,
        status: "on_duty_not_driving",
        description: "Pickup",
        start_location: joliet,
        end_location: joliet,
        miles: 0,
      },
    ];

    it("renders the form header with day, date, from/to and miles", () => {
      render(
        <DailyLogSheet segments={filledSegments} dayNumber={1} date="06 / 02 / 2026" />,
      );
      expect(screen.getByText("Driver's Daily Log")).toBeInTheDocument();
      expect(screen.getByText("Day 1")).toBeInTheDocument();
      expect(screen.getByText("06 / 02 / 2026")).toBeInTheDocument();
      expect(screen.getByText(/Chicago, IL/)).toBeInTheDocument(); // From
      expect(screen.getAllByText(/Joliet, IL/).length).toBeGreaterThan(0); // To + remarks
      expect(screen.getAllByText("60.0").length).toBeGreaterThan(0); // miles fields
    });

    it("lists duty changes in Remarks with their times", () => {
      render(<DailyLogSheet segments={filledSegments} dayNumber={1} />);
      expect(screen.getByText("Remarks")).toBeInTheDocument();
      expect(screen.getByText("10:00")).toBeInTheDocument(); // 600 min => 10:00
      expect(screen.getByText(/Pickup — Joliet, IL/)).toBeInTheDocument();
    });

    it("shows the on-duty recap", () => {
      render(<DailyLogSheet segments={filledSegments} dayNumber={1} />);
      expect(screen.getByText(/On-duty hours today/)).toBeInTheDocument();
    });
  });
});
