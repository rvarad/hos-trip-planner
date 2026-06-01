import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

const PHOTON_REVERSE = {
  features: [
    {
      geometry: { coordinates: [-87.6298, 41.8781] },
      properties: { name: "Chicago", state: "Illinois", country: "United States" },
    },
  ],
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/reverse proxy", () => {
  it("reverse-geocodes a label while keeping the pin's coordinates", async () => {
    const fetchMock = vi.fn(async () => ok(PHOTON_REVERSE));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(new Request("http://localhost/api/reverse?lat=41.88&lon=-87.63"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.label).toBe("Chicago, Illinois, United States");
    // The pin's own coordinates are kept, not the feature's snapped ones.
    expect(body.result.lat).toBe(41.88);
    expect(body.result.lng).toBe(-87.63);

    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(String(url)).toContain("/reverse?");
    expect(String(url)).toContain("lat=41.88");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "hos-trip-planner",
    );
  });

  it("returns 400 when lat/lon are missing", async () => {
    const res = await GET(new Request("http://localhost/api/reverse"));
    expect(res.status).toBe(400);
  });

  it("returns null result when there is no feature", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ features: [] })));
    const res = await GET(new Request("http://localhost/api/reverse?lat=1&lon=2"));
    expect((await res.json()).result).toBeNull();
  });
});
