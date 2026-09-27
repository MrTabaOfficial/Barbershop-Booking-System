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
// type falls back to each system's own sans and every style is written inline.
const PAGE = "#f8f9fb";
const SURFACE = "#ffffff";
const LINE = "#d3d7e2";
const INK = "#101b3b";
const MUTED = "#566080";
const ACTION = "#1d3fbb";
const ON_ACTION = "#ffffff";
const SANS =
  "FiraGO, 'Fira Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif";

// A mail program draws the lari sign from a fallback font, where it comes
// out undersized, so emails spell the currency out.
const formatGel = (cents: number) => formatLari(cents).replace("₾", "GEL");

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

  const paragraph = (line: string, style = `font-size:16px;color:${INK};`) =>
    `<p style="margin:0 0 16px;font-family:${SANS};line-height:1.55;${style}">${escapeHtml(line)}</p>`;

  const detailRows = content.details
    .map(
      ([label, value]) => `
                  <tr>
                    <td style="padding:10px 16px 10px 0;border-top:1px solid ${LINE};font-family:${SANS};font-size:14px;line-height:1.5;color:${MUTED};vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
                    <td style="padding:10px 0;border-top:1px solid ${LINE};font-family:${SANS};font-size:16px;line-height:1.5;font-weight:bold;color:${INK};">${escapeHtml(value)}</td>
                  </tr>`,
    )
    .join("");

  const button = content.action
    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
                  <tr>
                    <td bgcolor="${ACTION}" style="background-color:${ACTION};border-radius:12px;">
                      <a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:14px 24px;font-family:${SANS};font-size:16px;font-weight:bold;line-height:1.25;color:${ON_ACTION};text-decoration:none;">${escapeHtml(content.action.label)}</a>
                    </td>
                  </tr>
                </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <meta name="format-detection" content="telephone=no, date=no, address=no" />
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAGE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE}" style="background-color:${PAGE};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;">
            <tr>
              <td style="padding:0 0 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td bgcolor="${ACTION}" style="background-color:${ACTION};border-radius:10px;padding:7px 12px 9px;">
                      <span lang="ka" style="font-family:${SANS};font-size:20px;font-weight:bold;line-height:1;color:${ON_ACTION};">${shopDetails.wordmark}</span>
                    </td>
                    <td style="padding-left:12px;font-family:${SANS};font-size:18px;font-weight:bold;color:${INK};">${escapeHtml(shopDetails.name)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${SURFACE}" style="background-color:${SURFACE};border:1px solid ${LINE};border-radius:20px;padding:28px 24px 12px;">
                <h1 style="margin:0 0 16px;font-family:${SANS};font-size:26px;font-weight:bold;line-height:1.2;color:${INK};">${escapeHtml(content.heading)}</h1>
                ${content.intro.map((line) => paragraph(line)).join("\n                ")}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-bottom:1px solid ${LINE};">${detailRows}
                </table>
                ${content.notes.map((line) => paragraph(line, `font-size:15px;color:${MUTED};`)).join("\n                ")}${button}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 4px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED};">
                ${escapeHtml(shopDetails.name)}, ${escapeHtml(shopAddressLine)}<br />
                <a href="tel:${shopDetails.phone.replaceAll(" ", "")}" style="color:${MUTED};text-decoration:none;">${escapeHtml(shopDetails.phone)}</a>
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
      ...(paid ? ([["Deposit paid", formatGel(booking.depositCents)]] as [string, string][]) : []),
      ["To pay at the shop", formatGel(stillToPay)],
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
  const deposit = formatGel(booking.depositCents);
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
  const deposit = formatGel(booking.depositCents);
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
    notes: ["We're sorry about that. You can pick another time below."],
    action: { label: "Book another time", url: `${env.appUrl}/book` },
  });
}
