import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./MapView", () => ({
  default: ({ onPinPlaced }: any) => (
    <button onClick={() => onPinPlaced?.(40, -90)}>place-pin</button>
  ),
}));

import LocationField from "./LocationField";

afterEach(() => vi.unstubAllGlobals());

function okJson(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LocationField", () => {
  it("renders pin and geolocation as icon-only buttons", () => {
    render(<LocationField label="Pickup" value={null} onChange={() => {}} />);
    // Reachable by accessible name (aria-label)...
    expect(
      screen.getByRole("button", { name: "Drop pin" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use my location" }),
    ).toBeInTheDocument();
    // ...but icon-only: no visible text label.
    expect(screen.queryByText("Drop pin")).not.toBeInTheDocument();
    expect(screen.queryByText("Use my location")).not.toBeInTheDocument();
  });

  it("renders duplicate-labeled options without a duplicate-key warning", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      okJson({
        results: [
          { label: "Springfield", lat: 39.8, lng: -89.6 },
          { label: "Springfield", lat: 37.2, lng: -93.3 },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LocationField label="Pickup" value={null} onChange={() => {}} />);
    await userEvent.type(screen.getByRole("combobox"), "spring");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Both same-labeled options render...
    expect((await screen.findAllByText("Springfield")).length).toBe(2);
    // ...with no React duplicate-key warning.
    const dupKeyWarning = errorSpy.mock.calls.find((args) =>
      String(args[0]).includes("same key"),
    );
    expect(dupKeyWarning).toBeUndefined();
    errorSpy.mockRestore();
  });

  it("debounces search, then resolves the field on select", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ results: [{ label: "Chicago, IL", lat: 41.8, lng: -87.6 }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    render(<LocationField label="Pickup" value={null} onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox"), "chicago");

    // Debounced: the burst of keystrokes coalesces into a single request.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const option = await screen.findByText("Chicago, IL");
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith({
      label: "Chicago, IL",
      lat: 41.8,
      lng: -87.6,
    });
  });

  it("drops a pin, reverse-geocodes it, and resolves the field", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ result: { label: "Dropped Place", lat: 40, lng: -90 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    render(<LocationField label="Pickup" value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /pin/i }));
    await userEvent.click(await screen.findByText("place-pin"));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        label: "Dropped Place",
        lat: 40,
        lng: -90,
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/reverse?");
  });

  it("uses the browser geolocation and resolves the field", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 40, longitude: -90 } } as GeolocationPosition),
    );
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });
    const fetchMock = vi.fn(async () =>
      okJson({ result: { label: "My Spot", lat: 40, lng: -90 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    render(<LocationField label="Current" value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /my location/i }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        label: "My Spot",
        lat: 40,
        lng: -90,
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/reverse?");
  });
});
