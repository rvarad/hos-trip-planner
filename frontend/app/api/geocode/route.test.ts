import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

const PHOTON_OK = {
  features: [
    {
      geometry: { coordinates: [-87.6298, 41.8781] },
      properties: { name: "Chicago", state: "Illinois", country: "United States" },
    },
    {
      geometry: { coordinates: [-90.1994, 38.627] },
      properties: {
        housenumber: "1",
        street: "Market St",
        city: "St. Louis",
        state: "Missouri",
        country: "United States",
      },
    },
  ],
};

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/geocode proxy", () => {
  it("forwards the query + proximity with a User-Agent and transforms features", async () => {
    const fetchMock = vi.fn(async () => ok(PHOTON_OK));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      new Request("http://localhost/api/geocode?q=chicago&lat=40&lon=-90"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toEqual({
      label: "Chicago, Illinois, United States",
      lat: 41.8781,
      lng: -87.6298,
    });
    expect(body.results[1].label).toBe(
      "1 Market St, St. Louis, Missouri, United States",
    );

    const [url, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    const calledUrl = String(url);
    expect(calledUrl).toContain("/api?");
    expect(calledUrl).toContain("q=chicago");
    expect(calledUrl).toContain("lat=40");
    expect(calledUrl).toContain("lon=-90");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(
      "hos-trip-planner",
    );
  });

  it("returns 502 when Photon fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("err", { status: 500 })),
    );
    const res = await GET(new Request("http://localhost/api/geocode?q=x"));
    expect(res.status).toBe(502);
  });

  it("returns empty results for a blank query without calling Photon", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(new Request("http://localhost/api/geocode?q="));
    expect((await res.json()).results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
