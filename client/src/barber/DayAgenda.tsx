import type { ScheduleDay } from "../api/types.ts";
import { formatClock } from "../lib/format.ts";
import { Appointment } from "./Appointment.tsx";

export function describeHours(day: ScheduleDay): string {
  if (day.dayOff) {
    return day.dayOff.reason ? `Day off: ${day.dayOff.reason}` : "Day off";
  }
  if (!day.workingHours) {
    return "Not a working day";
  }
  const { startMinute, endMinute, breakStartMinute, breakEndMinute } = day.workingHours;
  const hours = `${formatClock(startMinute)} to ${formatClock(endMinute)}`;
  return breakStartMinute !== null && breakEndMinute !== null
    ? `${hours}, break ${formatClock(breakStartMinute)} to ${formatClock(breakEndMinute)}`
    : hours;
}

export function countAppointments(day: ScheduleDay): string {
  const count = day.bookings.length;
  if (count === 0) {
    return "No appointments";
  }
  return count === 1 ? "1 appointment" : `${count} appointments`;
}

export function DayAgenda({ day }: { day: ScheduleDay }) {
  if (day.bookings.length === 0) {
    return (
      <p className="rounded-md bg-sunken px-4 py-6 text-center text-muted">
        {day.dayOff || !day.workingHours ? "Nothing booked. Enjoy the day." : "Nothing booked yet."}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface px-4">
      {day.bookings.map((booking) => (
        <li key={booking.id} className="py-3">
          <Appointment booking={booking} />
        </li>
      ))}
    </ul>
  );
}
