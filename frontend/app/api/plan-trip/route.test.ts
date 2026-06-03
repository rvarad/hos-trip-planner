import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => vi.unstubAllGlobals());

function req(body: unknown) {
  return new Request("http://localhost/api/plan-trip", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/plan-trip proxy", () => {
  it("forwards the body to the backend and passes the response through", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ hello: "world" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/plan-trip");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ hello: "world" });
  });

  it("propagates a backend 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: "bad" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns a clean 502 JSON when the backend is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const res = await POST(req({}));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/unavailable/i);
  });
});
