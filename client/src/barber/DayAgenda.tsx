import type { ScheduleDay } from "../api/types.ts";
import { formatClock } from "../lib/format.ts";
import { Appointment } from "./Appointment.tsx";

// "10:00 to 19:00, break 14:00 to 15:00", "Day off: Family event" or
// "Not a working day".
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

// "3 appointments", "1 appointment", "No appointments"
export function countAppointments(day: ScheduleDay): string {
  const count = day.bookings.length;
  if (count === 0) {
    return "No appointments";
  }
  return count === 1 ? "1 appointment" : `${count} appointments`;
}

// The appointments of one day, in order.
export function DayAgenda({ day }: { day: ScheduleDay }) {
  if (day.bookings.length === 0) {
    return (
      <p className="rounded-sm border border-dashed border-line-strong px-4 py-6 text-center text-muted">
        {day.dayOff || !day.workingHours ? "Nothing booked. Enjoy the day." : "Nothing booked yet."}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {day.bookings.map((booking) => (
        <li key={booking.id}>
          <Appointment booking={booking} />
        </li>
      ))}
    </ul>
  );
}
