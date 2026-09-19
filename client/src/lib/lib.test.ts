import { describe, expect, it } from "vitest";
import {
  addDays,
  dayParts,
  formatLongDate,
  isShopDate,
  startOfWeek,
  weekdayOf,
} from "./dates.ts";
import {
  formatClock,
  formatDuration,
  formatPrice,
  parseClock,
  parseLari,
  toLariInput,
} from "./format.ts";
import { homeFor, safeNextPath } from "./nextPath.ts";

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

  it("finds the Monday of a week", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(startOfWeek("2026-10-08")).toBe("2026-10-05");
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

describe("form values", () => {
  it("turns lari typed into a form into tetri", () => {
    expect(parseLari("45")).toBe(4500);
    expect(parseLari("45.5")).toBe(4550);
    expect(parseLari(" 12,30 ")).toBe(1230);
    expect(parseLari("19.99")).toBe(1999);
  });

  it("refuses anything that isn't an amount", () => {
    expect(parseLari("")).toBeNull();
    expect(parseLari("free")).toBeNull();
    expect(parseLari("-5")).toBeNull();
    expect(parseLari("1.234")).toBeNull();
  });

  it("shows tetri as lari for editing", () => {
    expect(toLariInput(4500)).toBe("45");
    expect(toLariInput(4550)).toBe("45.50");
  });

  it("reads a clock time as minutes after midnight", () => {
    expect(parseClock("10:00")).toBe(600);
    expect(parseClock("15:30")).toBe(930);
    expect(parseClock("")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("accepts a path inside the app", () => {
    expect(safeNextPath("/book?service=1&barber=2")).toBe("/book?service=1&barber=2");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil.example")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });

  it("sends each role to its own page when no page asked for the login", () => {
    expect(homeFor("customer")).toBe("/bookings");
    expect(homeFor("barber")).toBe("/barber");
    expect(homeFor("admin")).toBe("/admin");
  });
});
