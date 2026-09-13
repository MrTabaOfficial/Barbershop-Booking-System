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

export type MyBookings = {
  upcoming: Booking[];
  past: Booking[];
};
