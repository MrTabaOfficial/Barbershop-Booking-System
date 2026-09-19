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
  today: string;
  lastBookableDate: string;
  freeCancellationHours: number;
};

export type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
};

export type WorkingHours = {
  weekday: number;
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
  startsAt: string;
  localTime: string;
};

export type Availability = {
  date: string;
  timeZone: string;
  slots: Slot[];
};

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show"
  | "expired";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "refund_failed";

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
  paymentStatus: PaymentStatus;
  paymentUrl: string | null;
  heldUntilLocalTime: string | null;
  service: { id: string; name: string };
  barber: { id: string; name: string };
};

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
  date: string;
  reason: string | null;
};

export type ScheduleDay = {
  date: string;
  workingHours: {
    startMinute: number;
    endMinute: number;
    breakStartMinute: number | null;
    breakEndMinute: number | null;
  } | null;
  dayOff: DayOff | null;
  bookings: ScheduleBooking[];
};

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
  paymentStatus: PaymentStatus;
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
  totals: { bookings: number; revenueCents: number };
  perDay: { date: string; bookings: number; revenueCents: number }[];
  byStatus: Record<BookingStatus, number>;
  noShowRate: number | null;
  topServices: { serviceId: string; name: string; bookings: number }[];
};

export type MyBookings = {
  upcoming: Booking[];
  past: Booking[];
};
