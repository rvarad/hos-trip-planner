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
});
