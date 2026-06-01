import { describe, expect, it } from "vitest";

import { theme } from "./theme";

describe("theme", () => {
  it("is a dark theme with the accent as primary", () => {
    expect(theme.palette.mode).toBe("dark");
    expect(theme.palette.primary.main).toBe("#38bdf8");
  });
});
