import writeExcelFile from "write-excel-file/node";
import { env } from "../env.ts";
import { shopClockAsUtc } from "../shop/time.ts";
import type { AdminBooking } from "./bookings.ts";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  EXPIRED: "Expired",
};

const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  REFUNDED: "Refunded",
  REFUND_FAILED: "Refund failed",
};

// Each column: its heading, its width in characters, and how to fill a
// cell from a booking. Dates and amounts are written as real spreadsheet
// dates and numbers with a display format, not as text, so they can be
// sorted, filtered and summed in Excel.
const COLUMNS = [
  {
    heading: "Start",
    width: 18,
    // A spreadsheet has no time zones. The cell holds the shop's clock time.
    cell: (booking: AdminBooking) => ({
      value: shopClockAsUtc(booking.startsAt, env.shopTimeZone),
      type: Date,
      format: "dd/mm/yyyy hh:mm",
    }),
  },
  {
    heading: "Minutes",
    width: 9,
    cell: (booking: AdminBooking) => ({
      value: (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000,
      type: Number,
    }),
  },
  { heading: "Customer", width: 24, cell: (booking: AdminBooking) => ({ value: booking.customer.name }) },
  { heading: "Email", width: 28, cell: (booking: AdminBooking) => ({ value: booking.customer.email }) },
  {
    heading: "Phone",
    width: 20,
    cell: (booking: AdminBooking) => ({ value: booking.customer.phone ?? "" }),
  },
  { heading: "Barber", width: 22, cell: (booking: AdminBooking) => ({ value: booking.barber.user.name }) },
  { heading: "Service", width: 20, cell: (booking: AdminBooking) => ({ value: booking.service.name }) },
  {
    heading: "Status",
    width: 12,
    cell: (booking: AdminBooking) => ({ value: STATUS_LABELS[booking.status] ?? booking.status }),
  },
  {
    heading: "Deposit status",
    width: 14,
    cell: (booking: AdminBooking) => ({
      value: PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus,
    }),
  },
  {
    heading: "Price (GEL)",
    width: 12,
    // Stored in tetri; a spreadsheet wants lari with two decimals.
    cell: (booking: AdminBooking) => ({
      value: booking.priceCents / 100,
      type: Number,
      format: "#,##0.00",
    }),
  },
  {
    heading: "Deposit (GEL)",
    width: 13,
    cell: (booking: AdminBooking) => ({
      value: booking.depositCents / 100,
      type: Number,
      format: "#,##0.00",
    }),
  },
];

export function bookingsToXlsx(bookings: AdminBooking[]): Promise<Buffer> {
  const headings = COLUMNS.map((column) => ({ value: column.heading, fontWeight: "bold" as const }));
  const rows = bookings.map((booking) => COLUMNS.map((column) => column.cell(booking)));

  return writeExcelFile([headings, ...rows], {
    sheet: "Bookings",
    columns: COLUMNS.map((column) => ({ width: column.width })),
    // Keeps the headings in view while scrolling.
    stickyRowsCount: 1,
  }).toBuffer();
}
