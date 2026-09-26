import { describe, expect, it } from "vitest";
import { axisTicks, groupByWeek } from "./chartMath.ts";

describe("axisTicks", () => {
  it("ends on the first round number at or above the highest value, in at most four steps", () => {
    expect(axisTicks(19)).toEqual([0, 5, 10, 15, 20]);
    expect(axisTicks(21)).toEqual([0, 10, 20, 30]);
    expect(axisTicks(3)).toEqual([0, 1, 2, 3]);
    expect(axisTicks(900)).toEqual([0, 500, 1000]);
  });

  it("still draws an axis when every value is zero", () => {
    expect(axisTicks(0)).toEqual([0, 1]);
  });

  it("keeps money ticks on whole lari", () => {
    expect(axisTicks(70_500, 100)).toEqual([0, 20_000, 40_000, 60_000, 80_000]);
    expect(axisTicks(250, 100)).toEqual([0, 100, 200, 300]);
  });
});

describe("groupByWeek", () => {
  const day = (date: string, bookings: number) => ({ date, bookings, revenueCents: bookings * 1000 });

  it("adds up Monday to Sunday, and keeps a part week at each end as its own group", () => {
    const weeks = groupByWeek([
      day("2026-10-03", 1),
      day("2026-10-04", 2),
      day("2026-10-05", 3),
      day("2026-10-06", 4),
      day("2026-10-11", 5),
      day("2026-10-12", 6),
    ]);

    expect(weeks).toEqual([
      { from: "2026-10-03", to: "2026-10-04", bookings: 3, revenueCents: 3000 },
      { from: "2026-10-05", to: "2026-10-11", bookings: 12, revenueCents: 12_000 },
      { from: "2026-10-12", to: "2026-10-12", bookings: 6, revenueCents: 6000 },
    ]);
  });

  it("returns nothing for no days", () => {
    expect(groupByWeek([])).toEqual([]);
  });
});
