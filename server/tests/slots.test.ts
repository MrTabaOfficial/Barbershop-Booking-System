import { describe, expect, it } from "vitest";
import { calculateSlots, type SlotInput } from "../src/availability/slots.ts";
import { shopClockTimeOf, shopTimeToUtc } from "../src/shop/time.ts";

// Tbilisi is UTC+4 all year, so most tests don't have to think about
// daylight saving. The ones that do use Berlin.
const TBILISI = "Asia/Tbilisi";
const BERLIN = "Europe/Berlin";

const DATE = "2026-11-10";
const NOW = new Date("2026-11-01T08:00:00Z");

const NINE_TO_SIX = {
  startMinute: 9 * 60,
  endMinute: 18 * 60,
  breakStartMinute: null,
  breakEndMinute: null,
};

function minutesOf(clockTime: string): number {
  const [hours, minutes] = clockTime.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function at(clockTime: string, shopDate = DATE): Date {
  return shopTimeToUtc(shopDate, minutesOf(clockTime), TBILISI);
}

function booking(from: string, to: string, status = "CONFIRMED") {
  return { startsAt: at(from), endsAt: at(to), status };
}

// Runs the calculation with sensible defaults and returns the slots as
// shop clock times, which are easier to read in assertions than instants.
function slotTimes(overrides: Partial<SlotInput> = {}): string[] {
  const input: SlotInput = {
    shopDate: DATE,
    timeZone: TBILISI,
    now: NOW,
    workingHours: NINE_TO_SIX,
    isDayOff: false,
    durationMinutes: 30,
    bookings: [],
    ...overrides,
  };
  return calculateSlots(input).map((slot) => shopClockTimeOf(slot, input.timeZone));
}

describe("an open day with no bookings", () => {
  it("offers a slot every 15 minutes from opening", () => {
    const slots = slotTimes();

    expect(slots.slice(0, 3)).toEqual(["09:00", "09:15", "09:30"]);
    expect(slots).toHaveLength(35);
  });

  it("returns each slot as a UTC instant", () => {
    const [first] = calculateSlots({
      shopDate: DATE,
      timeZone: TBILISI,
      now: NOW,
      workingHours: NINE_TO_SIX,
      isDayOff: false,
      durationMinutes: 30,
      bookings: [],
    });

    // 09:00 in Tbilisi is 05:00 UTC.
    expect(first?.toISOString()).toBe("2026-11-10T05:00:00.000Z");
  });

  it("ends with the last slot that finishes by closing time", () => {
    expect(slotTimes({ durationMinutes: 30 }).at(-1)).toBe("17:30");
    expect(slotTimes({ durationMinutes: 45 }).at(-1)).toBe("17:15");
  });
});

describe("days the barber is not working", () => {
  it("has no slots on a day off", () => {
    expect(slotTimes({ isDayOff: true })).toEqual([]);
  });

  it("has no slots on a weekday without working hours", () => {
    expect(slotTimes({ workingHours: null })).toEqual([]);
  });
});

describe("the break", () => {
  const withLunch = {
    ...NINE_TO_SIX,
    breakStartMinute: 13 * 60,
    breakEndMinute: 14 * 60,
  };

  it("removes slots that fall inside or run into the break", () => {
    const slots = slotTimes({ workingHours: withLunch });

    expect(slots).toContain("12:30");
    expect(slots).not.toContain("12:45");
    expect(slots).not.toContain("13:00");
    expect(slots).not.toContain("13:45");
    expect(slots).toContain("14:00");
  });

  it("keeps a longer service from starting too close to the break", () => {
    const slots = slotTimes({ workingHours: withLunch, durationMinutes: 45 });

    expect(slots).toContain("12:15");
    expect(slots).not.toContain("12:30");
  });
});

describe("existing bookings", () => {
  it("allows slots that touch a booking but not ones that overlap it", () => {
    const slots = slotTimes({ bookings: [booking("10:00", "10:30")] });

    expect(slots).toContain("09:30");
    expect(slots).not.toContain("09:45");
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:15");
    expect(slots).toContain("10:30");
  });

  it("skips a gap that is shorter than the service", () => {
    const bookings = [booking("09:00", "09:30"), booking("10:00", "10:30")];

    expect(slotTimes({ bookings, durationMinutes: 30 })).toContain("09:30");
    expect(slotTimes({ bookings, durationMinutes: 45 })).not.toContain("09:30");
    expect(slotTimes({ bookings, durationMinutes: 45 })[0]).toBe("10:30");
  });

  it("treats a cancelled booking's time as free", () => {
    const slots = slotTimes({ bookings: [booking("10:00", "10:30", "CANCELLED")] });

    expect(slots).toContain("10:00");
  });

  it("still blocks the slot for pending, completed and no-show bookings", () => {
    for (const status of ["PENDING", "COMPLETED", "NO_SHOW"]) {
      const slots = slotTimes({ bookings: [booking("10:00", "10:30", status)] });
      expect(slots).not.toContain("10:00");
    }
  });
});

describe("how far ahead a slot may be", () => {
  it("offers nothing that starts less than an hour from now", () => {
    expect(slotTimes({ now: at("09:20") })[0]).toBe("10:30");
  });

  it("offers a slot starting exactly one hour from now", () => {
    expect(slotTimes({ now: at("09:00") })[0]).toBe("10:00");
  });

  it("has no slots on a day that has passed", () => {
    expect(slotTimes({ now: at("08:00", "2026-11-11") })).toEqual([]);
  });

  it("offers slots 60 days ahead but not 61", () => {
    // NOW is 12:00 on 2026-11-01 in Tbilisi.
    expect(slotTimes({ shopDate: "2026-12-31" })).not.toEqual([]);
    expect(slotTimes({ shopDate: "2027-01-01" })).toEqual([]);
  });
});

describe("daylight saving", () => {
  const nightShift = {
    startMinute: 1 * 60,
    endMinute: 4 * 60,
    breakStartMinute: null,
    breakEndMinute: null,
  };

  it("keeps 09:00 at 09:00 on the shop clock when the UTC offset changes", () => {
    const firstSlotOn = (shopDate: string) =>
      calculateSlots({
        shopDate,
        timeZone: BERLIN,
        now: new Date("2027-03-01T00:00:00Z"),
        workingHours: NINE_TO_SIX,
        isDayOff: false,
        durationMinutes: 30,
        bookings: [],
      })[0]?.toISOString();

    // Berlin moves from UTC+1 to UTC+2 on 2027-03-28.
    expect(firstSlotOn("2027-03-27")).toBe("2027-03-27T08:00:00.000Z");
    expect(firstSlotOn("2027-03-29")).toBe("2027-03-29T07:00:00.000Z");
  });

  it("skips the hour that doesn't exist when clocks go forward", () => {
    // On 2027-03-28 in Berlin the clock jumps from 02:00 to 03:00, so
    // 01:00-04:00 is only two real hours.
    const slots = slotTimes({
      shopDate: "2027-03-28",
      timeZone: BERLIN,
      now: new Date("2027-03-01T00:00:00Z"),
      workingHours: nightShift,
      durationMinutes: 60,
    });

    expect(slots).toEqual(["01:00", "01:15", "01:30", "01:45", "03:00"]);
  });

  it("offers both passes through the hour that repeats when clocks go back", () => {
    // On 2026-10-25 in Berlin 03:00 becomes 02:00 again, so 01:00-04:00 is
    // four real hours.
    const slots = slotTimes({
      shopDate: "2026-10-25",
      timeZone: BERLIN,
      now: new Date("2026-10-01T00:00:00Z"),
      workingHours: nightShift,
      durationMinutes: 60,
    });

    expect(slots).toHaveLength(13);
    expect(slots.filter((time) => time === "02:00")).toHaveLength(2);
    expect(slots.at(-1)).toBe("03:00");
  });
});
