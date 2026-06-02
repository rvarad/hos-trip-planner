import { describe, expect, it } from "vitest";

import { splitRouteByDay } from "./routeDays";

const day = (date_offset: number, miles: number) => ({
  date_offset,
  segments: [{ miles }],
});

describe("splitRouteByDay", () => {
  it("splits a route into per-day slices at the cumulative-miles fraction", () => {
    // A straight vertical line; each 1° latitude step is an equal length, so
    // two equal-mile days should cut exactly at the midpoint vertex [0, 2].
    const route: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ];
    const result = splitRouteByDay(route, [day(0, 100), day(1, 100)]);

    expect(result).toHaveLength(2);
    expect(result[0].dateOffset).toBe(0);
    expect(result[1].dateOffset).toBe(1);
    expect(result[0].coords).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    expect(result[1].coords).toEqual([
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
  });

  it("returns the whole route as one slice for a single day", () => {
    const route: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ];
    const result = splitRouteByDay(route, [day(0, 100)]);
    expect(result).toEqual([{ dateOffset: 0, coords: route }]);
  });

  it("falls back to one slice when total driven miles is zero", () => {
    const route: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const result = splitRouteByDay(route, [day(0, 0), day(1, 0)]);
    expect(result).toEqual([{ dateOffset: 0, coords: route }]);
  });

  it("returns nothing for an empty/degenerate route", () => {
    expect(splitRouteByDay([], [])).toEqual([]);
    expect(splitRouteByDay(undefined, [day(0, 10)])).toEqual([]);
    expect(splitRouteByDay([[0, 0]], [day(0, 10)])).toEqual([]);
  });
});
