import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocationField from "./LocationField";

afterEach(() => vi.unstubAllGlobals());

function okJson(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LocationField", () => {
  it("offers a 'drop a pin' action in the dropdown", async () => {
    const onRequestPin = vi.fn();
    render(
      <LocationField
        label="Pickup"
        value={null}
        onChange={() => {}}
        onRequestPin={onRequestPin}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Drop a pin on the map"));
    expect(onRequestPin).toHaveBeenCalled();
  });

  it("uses the browser geolocation from the dropdown action", async () => {
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
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Use my location"));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        label: "My Spot",
        lat: 40,
        lng: -90,
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/reverse?");
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

    await userEvent.click(await screen.findByText("Chicago, IL"));

    expect(onChange).toHaveBeenCalledWith({
      label: "Chicago, IL",
      lat: 41.8,
      lng: -87.6,
    });
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

    expect((await screen.findAllByText("Springfield")).length).toBe(2);
    // No key warnings at all (duplicate or missing) across actions + results.
    const keyWarning = errorSpy.mock.calls.find((args) =>
      /key/i.test(String(args[0])),
    );
    expect(keyWarning).toBeUndefined();
    errorSpy.mockRestore();
  });

  it("disables the input when disabled", () => {
    render(
      <LocationField label="Pickup" value={null} onChange={() => {}} disabled />,
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("shows the full selected label as a caption", () => {
    render(
      <LocationField
        label="Pickup"
        value={{ label: "A very long place name, Some City, State", lat: 1, lng: 2 }}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText("A very long place name, Some City, State"),
    ).toBeInTheDocument();
  });
});
