import { afterEach, describe, expect, it, vi } from "vitest";

import { reverseGeocode, searchLocations } from "./geocoding";

afterEach(() => vi.unstubAllGlobals());

function okJson(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("geocoding client", () => {
  it("searchLocations queries /api/geocode with proximity and returns results", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ results: [{ label: "Chicago, IL", lat: 41.8, lng: -87.6 }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchLocations("chi", { lat: 40, lng: -90 });
    expect(results).toEqual([{ label: "Chicago, IL", lat: 41.8, lng: -87.6 }]);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/geocode?");
    expect(url).toContain("q=chi");
    expect(url).toContain("lat=40");
    expect(url).toContain("lon=-90");
  });

  it("searchLocations returns [] on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 502 })));
    expect(await searchLocations("x")).toEqual([]);
  });

  it("reverseGeocode queries /api/reverse and returns the result", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ result: { label: "Somewhere", lat: 3, lng: 4 } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reverseGeocode(3, 4);
    expect(result).toEqual({ label: "Somewhere", lat: 3, lng: 4 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/reverse?");
    expect(url).toContain("lat=3");
    expect(url).toContain("lon=4");
  });
});
