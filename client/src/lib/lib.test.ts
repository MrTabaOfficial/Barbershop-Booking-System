import { describe, expect, it } from "vitest";
import { addDays, dayParts, formatLongDate, isShopDate, weekdayOf } from "./dates.ts";
import { formatClock, formatDuration, formatPrice } from "./format.ts";
import { safeNextPath } from "./nextPath.ts";

describe("shop dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-06", -7)).toBe("2026-09-29");
  });

  it("numbers weekdays from Sunday, like the API", () => {
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-10-06")).toBe(2);
  });

  it("formats dates for display", () => {
    expect(formatLongDate("2026-10-06")).toBe("Tuesday 6 October");
    expect(dayParts("2026-10-06")).toEqual({ weekday: "Tue", day: "6", month: "Oct" });
  });

  it("recognises a valid shop date", () => {
    expect(isShopDate("2026-10-06")).toBe(true);
    expect(isShopDate("2026-13-40")).toBe(false);
    expect(isShopDate("tomorrow")).toBe(false);
    expect(isShopDate(null)).toBe(false);
  });
});

describe("formatting", () => {
  it("shows prices in lari", () => {
    expect(formatPrice(4500)).toBe("45 ₾");
    expect(formatPrice(4550)).toBe("45.5 ₾");
  });

  it("shows durations in hours and minutes", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(75)).toBe("1 h 15 min");
  });

  it("shows minutes after midnight as a clock time", () => {
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(930)).toBe("15:30");
  });
});

describe("safeNextPath", () => {
  it("accepts a path inside the app", () => {
    expect(safeNextPath("/book?service=1&barber=2")).toBe("/book?service=1&barber=2");
  });

  it("falls back for anything that could leave the site", () => {
    expect(safeNextPath("https://evil.example")).toBe("/bookings");
    expect(safeNextPath("//evil.example")).toBe("/bookings");
    expect(safeNextPath("/\\evil.example")).toBe("/bookings");
    expect(safeNextPath(null)).toBe("/bookings");
  });
});
