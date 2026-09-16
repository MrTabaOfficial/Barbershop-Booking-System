// The shapes the API returns. Instants are ISO strings in UTC; "local"
// fields and shop dates are already in the shop's time zone.

export type Role = "customer" | "barber" | "admin";

export type User = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
};

export type Session = {
  accessToken: string;
  user: User;
};

export type Shop = {
  timeZone: string;
  // YYYY-MM-DD
  today: string;
  lastBookableDate: string;
  freeCancellationHours: number;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  // In tetri: 4500 is 45 GEL.
  priceCents: number;
  depositCents: number;
};

export type WorkingHours = {
  // 0 = Sunday ... 6 = Saturday
  weekday: number;
  // Minutes after midnight in shop time.
  startMinute: number;
  endMinute: number;
};

export type Barber = {
  id: string;
  name: string;
  bio: string | null;
  workingHours: WorkingHours[];
};

export type Slot = {
  // The exact instant, sent back to the API when booking.
  startsAt: string;
  // The same moment on the shop's clock, "HH:MM", for display.
  localTime: string;
};

export type Availability = {
  date: string;
  timeZone: string;
  slots: Slot[];
};

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export type Booking = {
  id: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  priceCents: number;
  depositCents: number;
  cancelledAt: string | null;
  cancelledInFreeWindow: boolean | null;
  service: { id: string; name: string };
  barber: { id: string; name: string };
};

// A booking as its barber sees it.
export type ScheduleBooking = {
  id: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  localEndTime: string;
  priceCents: number;
  service: { id: string; name: string };
  customer: { name: string; phone: string | null };
};

export type DayOff = {
  id: string;
  // YYYY-MM-DD
  date: string;
  reason: string | null;
};

// One day of a barber's schedule.
export type ScheduleDay = {
  date: string;
  // Null on a weekday the barber doesn't work.
  workingHours: {
    startMinute: number;
    endMinute: number;
    breakStartMinute: number | null;
    breakEndMinute: number | null;
  } | null;
  dayOff: DayOff | null;
  bookings: ScheduleBooking[];
};

// --- what the admin sees

export type AdminService = Service & { isActive: boolean };

export type WorkingDay = WorkingHours & {
  breakStartMinute: number | null;
  breakEndMinute: number | null;
};

export type AdminBarber = {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  isActive: boolean;
  workingHours: WorkingDay[];
};

export type AdminBooking = {
  id: string;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  localDate: string;
  localTime: string;
  priceCents: number;
  depositCents: number;
  service: { id: string; name: string };
  barber: { id: string; name: string };
  customer: { id: string; name: string; email: string; phone: string | null };
};

export type AdminBookingPage = {
  bookings: AdminBooking[];
  total: number;
  page: number;
  pageSize: number;
};

export type Overview = {
  from: string;
  to: string;
  // Bookings exclude cancelled ones; revenue counts completed ones only.
  totals: { bookings: number; revenueCents: number };
  perDay: { date: string; bookings: number; revenueCents: number }[];
  byStatus: Record<BookingStatus, number>;
  // 0 to 1, or null when no appointment in the range has had an outcome.
  noShowRate: number | null;
  topServices: { serviceId: string; name: string; bookings: number }[];
};

export type MyBookings = {
  upcoming: Booking[];
  past: Booking[];
};
