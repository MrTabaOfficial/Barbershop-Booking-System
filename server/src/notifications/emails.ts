import { env } from "../env.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import { formatLari, shopAddressLine, shopDetails } from "../shop/details.ts";
import { formatShopDate, shopClockTimeOf, shopDateOf } from "../shop/time.ts";
import type { Email } from "./mailer.ts";

export const bookingForEmail = {
  customer: true,
  service: true,
  barber: { include: { user: true } },
} satisfies Prisma.BookingInclude;

export type BookingForEmail = Prisma.BookingGetPayload<{ include: typeof bookingForEmail }>;

// Mail programs don't load web fonts and many ignore style sheets, so the
// headings fall back to Georgia and every style is written inline.
const INK = "#141210";
const SURFACE = "#1d1a17";
const LINE = "#38322b";
const CREAM = "#f2ebdd";
const MUTED = "#b4aa99";
const BRASS = "#b8893b";
const BRASS_LIGHT = "#cfa55c";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Helvetica, Arial, sans-serif";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const shopCity = (env.shopTimeZone.split("/").at(-1) ?? env.shopTimeZone).replaceAll("_", " ");

export function describeTime(instant: Date): string {
  const date = formatShopDate(shopDateOf(instant, env.shopTimeZone));
  return `${date} at ${shopClockTimeOf(instant, env.shopTimeZone)}`;
}

const firstNameOf = (name: string) => name.split(" ")[0] ?? name;

type Content = {
  to: string;
  subject: string;
  heading: string;
  intro: string[];
  details: [string, string][];
  notes: string[];
  action?: { label: string; url: string };
};

function compose(content: Content): Email {
  const text = [
    content.heading,
    ...content.intro,
    content.details.map(([label, value]) => `${label}: ${value}`).join("\n"),
    ...content.notes,
    content.action ? `${content.action.label}: ${content.action.url}` : "",
    `${shopDetails.name}, ${shopAddressLine}, ${shopDetails.phone}`,
  ]
    .filter((part) => part !== "")
    .join("\n\n");

  const paragraph = (line: string, color = CREAM) =>
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${color};">${escapeHtml(line)}</p>`;

  const detailRows = content.details
    .map(
      ([label, value]) => `
            <tr>
              <td style="padding:10px 16px 10px 0;border-top:1px solid ${LINE};font-family:${SANS};font-size:14px;color:${MUTED};vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
              <td style="padding:10px 0;border-top:1px solid ${LINE};font-family:${SANS};font-size:16px;color:${CREAM};">${escapeHtml(value)}</td>
            </tr>`,
    )
    .join("");

  const button = content.action
    ? `
          <p style="margin:8px 0 24px;">
            <a href="${escapeHtml(content.action.url)}" style="display:inline-block;background-color:${BRASS};color:${INK};font-family:${SANS};font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:2px;">${escapeHtml(content.action.label)}</a>
          </p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${INK};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 0 24px;">
                <span lang="ka" style="font-family:${SERIF};font-size:26px;font-weight:bold;color:${BRASS_LIGHT};">${shopDetails.wordmark}</span>
                <span style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:3px;color:${MUTED};padding-left:10px;">${shopDetails.name.toUpperCase()}</span>
              </td>
            </tr>
            <tr>
              <td style="background-color:${SURFACE};border:1px solid ${LINE};border-radius:2px;padding:28px 24px 12px;">
                <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:26px;font-weight:normal;line-height:1.25;color:${CREAM};">${escapeHtml(content.heading)}</h1>
                ${content.intro.map((line) => paragraph(line)).join("\n                ")}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-bottom:1px solid ${LINE};">${detailRows}
                </table>
                ${content.notes.map((line) => paragraph(line, MUTED)).join("\n                ")}${button}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">
                ${escapeHtml(shopDetails.name)} · ${escapeHtml(shopAddressLine)}<br />
                ${escapeHtml(shopDetails.phone)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { to: content.to, subject: content.subject, text, html };
}

function appointmentDetails(booking: BookingForEmail): [string, string][] {
  return [
    ["Service", booking.service.name],
    ["Barber", booking.barber.user.name],
    ["When", `${describeTime(booking.startsAt)} (${shopCity} time)`],
    ["Where", shopAddressLine],
  ];
}

const myBookings = { label: "View my bookings", url: `${env.appUrl}/bookings` };

export function confirmationEmail(booking: BookingForEmail, freeCancellationHours: number): Email {
  const paid = booking.paymentStatus === "PAID";
  const stillToPay = booking.priceCents - (paid ? booking.depositCents : 0);
  return compose({
    to: booking.customer.email,
    subject: `Your booking at ${shopDetails.name} is confirmed`,
    heading: "You're booked",
    intro: [
      `Thank you, ${firstNameOf(booking.customer.name)}. Your appointment is confirmed and the chair is yours.`,
    ],
    details: [
      ...appointmentDetails(booking),
      ...(paid ? ([["Deposit paid", formatLari(booking.depositCents)]] as [string, string][]) : []),
      ["To pay at the shop", formatLari(stillToPay)],
    ],
    notes: [
      paid
        ? `You can move or cancel this booking until ${freeCancellationHours} hours before it starts and get your deposit back. After that the deposit is kept.`
        : `You can move or cancel this booking until ${freeCancellationHours} hours before it starts.`,
    ],
    action: myBookings,
  });
}

export function rescheduledEmail(booking: BookingForEmail, previousStartsAt: Date): Email {
  return compose({
    to: booking.customer.email,
    subject: `Your booking at ${shopDetails.name} has moved`,
    heading: "Your booking has moved",
    intro: [`${firstNameOf(booking.customer.name)}, your appointment has a new time.`],
    details: [
      ["New time", `${describeTime(booking.startsAt)} (${shopCity} time)`],
      ["Was", describeTime(previousStartsAt)],
      ["Service", booking.service.name],
      ["Barber", booking.barber.user.name],
      ["Where", shopAddressLine],
    ],
    notes: ["Everything else stays the same, and your deposit carries over."],
    action: myBookings,
  });
}

function depositOutcome(booking: BookingForEmail, cancelledBy: "customer" | "shop"): string {
  const deposit = formatLari(booking.depositCents);
  switch (booking.paymentStatus) {
    case "REFUNDED":
      return `Your ${deposit} deposit has been refunded to the card you paid with. It can take a few days to show on your statement.`;
    case "PAID":
      return cancelledBy === "customer"
        ? `Because the appointment was less than 24 hours away, the ${deposit} deposit has been kept.`
        : `The ${deposit} deposit has been kept.`;
    case "REFUND_FAILED":
      return `Your ${deposit} deposit is due back to you, but the refund did not go through. We will put that right ourselves; you don't need to do anything.`;
    default:
      return "Nothing had been paid for this booking, so there is nothing to refund.";
  }
}

export function cancelledEmail(booking: BookingForEmail, cancelledBy: "customer" | "shop"): Email {
  return compose({
    to: booking.customer.email,
    subject: `Your booking at ${shopDetails.name} is cancelled`,
    heading: "Your booking is cancelled",
    intro: [
      cancelledBy === "customer"
        ? `${firstNameOf(booking.customer.name)}, as you asked, we have cancelled your appointment.`
        : `${firstNameOf(booking.customer.name)}, we are sorry: we have had to cancel your appointment.`,
      depositOutcome(booking, cancelledBy),
    ],
    details: appointmentDetails(booking).slice(0, 3),
    notes: [
      cancelledBy === "customer"
        ? "We hope to see you another time."
        : `If you would like another time, book online or call us on ${shopDetails.phone}.`,
    ],
    action: { label: "Book another time", url: `${env.appUrl}/book` },
  });
}

export function reminderEmail(booking: BookingForEmail): Email {
  const time = shopClockTimeOf(booking.startsAt, env.shopTimeZone);
  return compose({
    to: booking.customer.email,
    subject: `Tomorrow at ${time}: your appointment at ${shopDetails.name}`,
    heading: "See you tomorrow",
    intro: [
      `${firstNameOf(booking.customer.name)}, a reminder that ${booking.barber.user.name} is expecting you tomorrow at ${time}.`,
    ],
    details: appointmentDetails(booking),
    notes: [`If something has come up, please call us on ${shopDetails.phone}.`],
    action: myBookings,
  });
}

export function depositReturnedEmail(booking: BookingForEmail): Email {
  const deposit = formatLari(booking.depositCents);
  return compose({
    to: booking.customer.email,
    subject: `We couldn't confirm your booking at ${shopDetails.name}`,
    heading: "We couldn't confirm your booking",
    intro: [
      `${firstNameOf(booking.customer.name)}, your payment reached us after the 30 minutes we could hold the time, and by then someone else had booked it.`,
      booking.paymentStatus === "REFUNDED"
        ? `Your ${deposit} deposit has been refunded to the card you paid with. It can take a few days to show on your statement.`
        : `Your ${deposit} deposit is due back to you, but the refund did not go through. We will put that right ourselves; you don't need to do anything.`,
    ],
    details: appointmentDetails(booking).slice(0, 3),
    notes: ["We are sorry about that. There may well be another time that suits you."],
    action: { label: "Book another time", url: `${env.appUrl}/book` },
  });
}
