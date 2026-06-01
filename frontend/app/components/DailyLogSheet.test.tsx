import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DailyLogSheet from "./DailyLogSheet";

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
});
