import type { ScheduleBooking, ScheduleDay } from "../api/types.ts";
import { t } from "../i18n/index.ts";
import { formatClock } from "../lib/format.ts";
import { Appointment } from "./Appointment.tsx";

export function describeHours(day: ScheduleDay): string {
  if (day.dayOff) {
    return day.dayOff.reason ? t("barber.dayOffReason", { reason: day.dayOff.reason }) : t("barber.dayOff");
  }
  if (!day.workingHours) {
    return t("barber.notWorking");
  }
  const { startMinute, endMinute, breakStartMinute, breakEndMinute } = day.workingHours;
  const hours = t("common.range", { from: formatClock(startMinute), to: formatClock(endMinute) });
  return breakStartMinute !== null && breakEndMinute !== null
    ? t("barber.hoursWithBreak", {
        hours,
        break: t("common.range", {
          from: formatClock(breakStartMinute),
          to: formatClock(breakEndMinute),
        }),
      })
    : hours;
}

export function countAppointments(day: ScheduleDay): string {
  const count = day.bookings.length;
  if (count === 0) {
    return t("barber.noAppointments");
  }
  return count === 1 ? t("barber.oneAppointment") : t("barber.appointments", { count });
}

export function DayAgenda({ day, markNow = false }: { day: ScheduleDay; markNow?: boolean }) {
  if (day.bookings.length === 0) {
    return (
      <p className="rounded-md bg-sunken px-4 py-6 text-center text-muted">
        {t(day.dayOff || !day.workingHours ? "barber.nothingBookedFree" : "barber.nothingBookedYet")}
      </p>
    );
  }
  const now = Date.now();
  const current = day.bookings.find(
    (booking) => Date.parse(booking.startsAt) <= now && now < Date.parse(booking.endsAt),
  );
  const next = day.bookings.find((booking) => Date.parse(booking.startsAt) > now);
  const markerOf = (booking: ScheduleBooking) =>
    !markNow ? undefined : booking === current ? t("common.now") : booking === next ? t("common.next") : undefined;

  return (
    <ul className="divide-y divide-line border-t border-line">
      {day.bookings.map((booking) => (
        <li key={booking.id} className="py-3">
          <Appointment booking={booking} marker={markerOf(booking)} />
        </li>
      ))}
    </ul>
  );
}
