# Dalaki: reference

The detail behind the [README](../README.md): every endpoint, how the
numbers are calculated, how payments, notifications and login work, how
double booking is prevented, how to switch on Stripe and Telegram, and
what is known not to work yet.

## API

Errors always have the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

| Method | Path             | What it does                                        |
| ------ | ---------------- | --------------------------------------------------- |
| POST   | `/auth/register` | Creates a customer account and logs in              |
| POST   | `/auth/login`    | Returns an access token and sets the refresh cookie |
| POST   | `/auth/refresh`  | Swaps the refresh cookie for a new session          |
| POST   | `/auth/logout`   | Revokes the refresh token and clears the cookie     |
| GET    | `/auth/me`       | Returns the logged-in user                          |

Public:

| Method | Path            | What it does                                             |
| ------ | --------------- | -------------------------------------------------------- |
| GET    | `/shop`         | Time zone, today's date, booking limits, address, phone  |
| GET    | `/services`     | Active services with duration, price and deposit         |
| GET    | `/barbers`      | Active barbers with their working hours and breaks       |
| GET    | `/availability` | Free start times for `barberId`, `serviceId` and `date`  |

`/availability` also accepts `excludeBookingId`. When the caller is logged
in and owns that booking, it is left out of the calculation, so the
reschedule dialog can offer times that overlap the booking's current one.
Anyone else's booking id is ignored.

Logged-in users:

| Method | Path                       | What it does                                  |
| ------ | -------------------------- | --------------------------------------------- |
| POST   | `/bookings`                | Holds a slot and returns `checkoutUrl`, the page to pay the deposit on |
| GET    | `/bookings/mine`           | The user's upcoming and past bookings         |
| POST   | `/bookings/:id/cancel`     | Cancels the user's own booking; refunds if 24 hours or more before |
| POST   | `/bookings/:id/reschedule` | Moves the user's own confirmed booking, until 24 hours before |

Called by the payment provider, not by the website:

| Method | Path                | What it does                                         |
| ------ | ------------------- | ---------------------------------------------------- |
| POST   | `/payments/webhook` | Verifies the signature, then confirms or expires the booking |

Barbers only, and always about the barber who is logged in:

| Method | Path                            | What it does                                        |
| ------ | ------------------------------- | --------------------------------------------------- |
| GET    | `/barber/schedule?from=&to=`    | Days with working hours, day off and bookings       |
| POST   | `/barber/bookings/:id/complete` | Marks a booking completed, once it has started      |
| POST   | `/barber/bookings/:id/no-show`  | Marks a booking as a no-show, once it has started   |
| GET    | `/barber/days-off`              | Upcoming days off                                   |
| POST   | `/barber/days-off`              | Adds a day off; refused if that date has bookings   |
| DELETE | `/barber/days-off/:id`          | Removes a day off                                   |

Admin only:

| Method    | Path                               | What it does                                  |
| --------- | ---------------------------------- | --------------------------------------------- |
| GET, POST | `/admin/services`                  | All services, including inactive; create one  |
| PATCH     | `/admin/services/:id`              | Edit, activate or deactivate                  |
| GET, POST | `/admin/barbers`                   | All barbers; create a barber account          |
| PATCH     | `/admin/barbers/:id`               | Edit name and bio, activate or deactivate     |
| PUT       | `/admin/barbers/:id/working-hours` | Replace the week's hours and breaks           |
| GET       | `/admin/bookings`                  | Filtered, sorted and paged on the server      |
| POST      | `/admin/bookings/:id/cancel`       | Cancel any booking that has no outcome yet; `{ "refund": false }` keeps the deposit |
| GET       | `/admin/bookings/export.xlsx`      | The same filters, as an Excel file            |
| GET       | `/admin/overview?from=&to=`        | Statistics for a range of shop dates          |

`/admin/bookings` takes `from`, `to`, `barberId`, `status`, `search`
(customer name, email or phone), `sort`, `order`, `page` and `pageSize`.
Services and barbers are never deleted, because bookings point at them;
deactivating takes them off the website and keeps the history.

The role is checked on the server for every request. The website hides
pages a user can't use, but nothing depends on that: a customer calling
a barber or admin endpoint gets a 403, as does a barber calling an admin
one, and another barber's booking or day off is a 404.

## How the statistics are calculated

The overview's numbers are counted in SQL (`server/src/admin/overview.ts`),
not by loading bookings and adding them up in code:

- **A day is the shop's day.** Bookings are grouped by
  `(starts_at AT TIME ZONE <shop zone>)::date`, so one at 00:30 in the shop
  lands on the right date even though it is still the previous day in UTC.
- **Empty days are included.** `generate_series` lists every date in the
  range, and bookings are joined onto it, so a chart never skips a day.
- **Bookings per day** are all bookings that weren't cancelled.
- **Revenue** counts completed bookings only.
- **No-show rate** is no-shows divided by completed plus no-shows, so
  cancelled and upcoming bookings don't dilute it.
- **Most booked services** counts bookings that weren't cancelled.

The export writes real spreadsheet dates and numbers with display formats,
not text, so the file can be sorted, filtered and summed in Excel. Dates
in it are on the shop's clock.

## Payments

Booking takes a deposit. The server holds the slot, creates a checkout for
the deposit, and the website sends the customer there to pay.

### A booking's states

| From      | To                   | What causes it                                              |
| --------- | -------------------- | ----------------------------------------------------------- |
| (new)     | pending              | The customer books. The slot is held and a checkout is created. |
| pending   | confirmed            | The payment provider's webhook reports the deposit paid.    |
| pending   | expired              | 30 minutes pass without payment. The slot is free again.    |
| pending   | cancelled            | The customer or admin cancels before paying.                |
| confirmed | confirmed            | The customer reschedules, 24 hours or more before the start. |
| confirmed | cancelled            | The customer cancels (refunded if 24 hours or more before, otherwise the deposit is kept), or the admin cancels and chooses. |
| confirmed | completed or no-show | The barber records the outcome after the start, and may correct it. |

The deposit has a status of its own: unpaid, paid, refunded, or refund
failed. A late cancellation is "cancelled" with the deposit still "paid".

### How it holds together

- **The webhook is verified and idempotent.** The signature is checked
  against the raw request body. Each event is applied as "update the
  booking if it is still pending", so a repeated event matches nothing and
  changes nothing.
- **The hold is enforced by the clock.** Before free times are calculated,
  any pending booking whose 30 minutes are up is marked expired. Nothing
  depends on a background job having run.
- **A payment that arrives late is not lost.** If the hold ran out a moment
  before the customer paid, the booking is confirmed anyway when the slot
  is still free, and refunded automatically when it has been taken.
- **Cancelling never depends on the refund.** The booking is cancelled
  first; if the refund then fails, that is recorded as "refund failed" for
  the admin to see, and the cancellation stands.

Payments sit behind a small interface (`server/src/payments/provider.ts`)
with two implementations. Which one takes new deposits depends only on
`.env`. Each booking records which provider took its deposit, and a refund
always goes back through that same one. The seeded demo bookings were
"paid" through the fake provider, so they refund through it even when
Stripe is switched on.

### Without Stripe (the default)

With no Stripe keys set, a fake provider is used. It sends the customer to
a plain page, served by this API and labelled as fake, with a "Pay the
deposit" button. Everything else behaves the same, so the project works
straight after cloning, and the tests run on it.

### With Stripe, in test mode

No real money moves in test mode.

1. **Get a test key.** Create a free account at https://stripe.com, make
   sure the dashboard is in test mode, and open Developers, then API keys.
   Copy the secret key (it starts with `sk_test_`) into `.env`:

   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```

2. **Run the Stripe CLI listener.** Stripe's servers can't reach
   `localhost`, so the CLI relays webhooks to it. Install it from
   https://docs.stripe.com/stripe-cli, then:

   ```sh
   stripe login
   stripe listen --forward-to localhost:3000/payments/webhook
   ```

   It prints a signing secret that starts with `whsec_`. Put it in `.env`
   and leave the listener running:

   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. **Restart the API.** It logs `Payments: Stripe` when the keys are read.

4. **Pay with a test card.** On Stripe's checkout page use card number
   `4242 4242 4242 4242`, any expiry date in the future, any three-digit
   CVC and any postcode. Back on the site the booking turns "Confirmed" as
   soon as the webhook arrives.

If the listener isn't running, payments succeed at Stripe but the booking
stays "Awaiting payment" and expires after 30 minutes, because nothing
tells the server.

Deposits are charged in Georgian lari (`gel`). If your Stripe account
can't charge in that currency, change `PAYMENT_CURRENCY` in
`server/src/bookings/service.ts`.

## Notifications and scheduled jobs

### Emails to the customer

| When                               | Email                                                    |
| ---------------------------------- | -------------------------------------------------------- |
| The deposit is paid                | Booking confirmed, with what is still to pay at the shop |
| The customer moves the booking     | The new time and the old one                             |
| The customer or the admin cancels  | Cancelled, stating whether the deposit was refunded, kept, or is still owed |
| 10:00 the day before               | A reminder                                               |
| A payment arrives too late to keep the slot | The booking couldn't be confirmed; the deposit is back |

They are plain HTML in the shop's colours, with a text version alongside,
built in `server/src/notifications/emails.ts` and sent with Nodemailer.
A booking that was never confirmed is never mentioned to anyone, so
cancelling an unpaid one sends nothing.

In development they go to **Mailpit**, a mail server that Docker Compose
starts. It accepts everything and delivers nothing; read the messages at
http://localhost:8025. With `SMTP_HOST` empty, emails are written to the
server's log instead.

### Alerts to the owner

The owner gets a Telegram message for each newly confirmed booking, each
cancellation, and a summary of the day at closing time (the latest finish
among the barbers working that day). To switch it on:

1. In Telegram, talk to **@BotFather**, send `/newbot`, and follow the
   prompts. It gives you a token like `123456:ABC...`.
2. Send your new bot any message, then open
   `https://api.telegram.org/bot<token>/getUpdates` in a browser and find
   `"chat":{"id":...}`. That number is your chat id.
3. Put both in `.env` and restart the API:

   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_OWNER_CHAT_ID=987654321
   ```

With no bot token set, alerts are written to the server's log instead of
failing.

### A notification can never break a booking

Every notification is sent after the change it reports has been saved, and
a failure to send is logged and goes no further. If the mail server or
Telegram is down, the booking is still confirmed, moved or cancelled, and
the request still succeeds.

### Jobs

Scheduled with node-cron, on the shop's clock (`server/src/jobs/`):

| How often        | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| Every minute     | Expires pending bookings whose 30-minute hold has run out       |
| Every 10 minutes | Sends tomorrow's reminders, from 10:00 onwards                  |
| Every 5 minutes  | Sends the day's summary, once, after closing time               |
| 03:30 each night | Deletes refresh tokens that have expired or were revoked over a week ago |

Each job can run twice without doing its work twice, and each decides from
the clock and the database whether there is anything to do, so the
schedule only says how often to look:

- **Reminders are sent once per booking.** The job stamps the booking as
  reminded before sending, and the stamp can only be set while it is still
  empty, so two runs can't both send. If the send fails, the stamp is
  cleared and the next run tries again. Someone who books today for
  tomorrow gets no reminder: their confirmation has only just arrived.
- **The summary is sent once per day.** A row keyed by the date is inserted
  first; a second run can't insert it again.
- **Revoked refresh tokens are kept for a week** before being deleted,
  because spotting a stolen token depends on recognising a revoked one
  when it is presented again.

## How authentication works

- Login returns a 15-minute access token (a JWT) that the client sends as
  `Authorization: Bearer <token>`.
- Login also sets a 30-day refresh token in an `httpOnly` cookie that page
  scripts can't read. Only its SHA-256 hash is stored, in the
  `refresh_tokens` table.
- Each refresh token works once. Using it returns a new one and revokes the
  old one. If a revoked token is presented again, every session of that
  user is ended, because the token may have been stolen.
- Failed logins are limited to 10 per 15 minutes per IP address.

## How the website handles login

- The access token is kept in a JavaScript variable and nowhere else. A
  page reload forgets it.
- On load, the app asks `POST /api/auth/refresh` for a new one. The browser
  attaches the `httpOnly` refresh cookie; the page's code never sees it.
- When any request gets a 401, the app refreshes once and retries once.
- Refresh tokens work only once, so refreshes never overlap: requests in
  one tab share a single refresh, and a browser lock makes tabs take turns.
- The booking flow keeps its choices in the URL, so login and register can
  send the customer back to the exact step they left.
- `localStorage` holds one flag, `dalaki.hasSession`, which only says "this
  browser has logged in before". It saves anonymous visitors a refresh
  request that would always fail.

## How availability works

For one barber, one service and one date, the free start times are found
like this:

1. No working hours for that weekday, or a day off on that date, means no
   slots.
2. The day's opening, closing and break times are converted from the
   shop's clock to exact instants for that date.
3. Starting at opening, every 15 minutes is a candidate. It is kept if it
   starts at least an hour from now, ends by closing time, and overlaps
   neither the break nor a booking that still holds its time (cancelled
   and expired ones don't).
4. Dates more than 60 days ahead have no slots.

The calculation is a pure function (`server/src/availability/slots.ts`)
with no database access, so it is unit tested directly. `POST /bookings`
runs the same function again before saving.

### Time zones

The shop's time zone is the `SHOP_TIME_ZONE` setting. Working hours and
days off are in shop time; bookings are stored as UTC instants. Clock
times are converted to instants one date at a time, so 09:00 stays 09:00
on the shop's clock when daylight saving changes the UTC offset. After
that conversion everything is measured in real elapsed time.

### Cancelling and rescheduling

- A customer can cancel or move only their own booking, and only before it
  starts.
- Cancelling records whether it happened 24 hours or more before the
  start, which decides whether the deposit is refunded.
- Rescheduling moves the booking with a single `UPDATE`, so it either
  gets the new time or keeps the old one.

## How double booking is prevented

Checking that a time is free before saving can't stop two requests that
arrive together, so the rule is enforced by the database. The `bookings`
table has a PostgreSQL exclusion constraint: for one barber, no two
bookings may cover overlapping time, not counting cancelled and expired
ones
([first migration](../server/prisma/migrations/20261004143447_booking_no_overlap/migration.sql),
[second](../server/prisma/migrations/20261004183146_booking_overlap_ignores_expired/migration.sql)).
The request that loses a race fails in one of two ways: the constraint
is violated, or, when both inserts happen at the same instant, PostgreSQL
detects a deadlock and aborts one of them. `isSlotTakenError`
([errors.ts](../server/src/bookings/errors.ts)) treats both as the same
answer, `409 SLOT_UNAVAILABLE`, and the website then reloads the free
times. A test sends two requests for one slot at the same time and
expects exactly one `201`, one `409` and one row.

## Known limitations

- It runs locally only. Nothing here has been deployed or load tested.
- Stripe: the code was checked against Stripe's official API mock and
  its signature check is tested, but it has never been run against a
  real Stripe account. The tests and the demo use the fake provider.
- Telegram: the owner's alerts have never reached Telegram. Without a
  bot token they are written to the server's log, and that stand-in is
  what the tests cover.
- A failed refund has no retry button. The booking shows "Refund failed"
  in the admin's table and the refund has to be made by hand.
- Adding a day off checks that the date has no bookings and then saves
  it. A booking made in the instant between the two can end up on a day
  off.
- Changing a barber's hours, or deactivating a barber, doesn't move the
  bookings already made. They have to be moved or cancelled by hand.
- Moving a booking keeps the same barber and service.
- The admin can't reset a barber's password or change their email.
- Emails and owner alerts are sent during the request. A slow mail
  server slows the booking down, and a message that fails is logged, not
  retried. A production version would hand them to a queue.
- A reminder that fails is tried again on each run, with no escalation
  if the mail server stays down.
- The emails were checked in Mailpit only, not in real Gmail, Outlook or
  Apple Mail. The Georgian wordmark in them is drawn by the reader's own
  font, since mail programs don't load web fonts.
- The emails are English only, as are the data from the API (service
  names, bios, error messages); the Georgian language covers the
  interface.
- The Georgian interface text has not been proofread by a second person.
- The fonts are about 680 KB: Literata for the English text, plus two
  weights of FiraGO that carry the Georgian interface, the wordmark and
  the lari sign, none of which Literata has. FiraGO's package can't be
  split by alphabet.
- The photographs are stock photos of other barbershops, from Pexels
  and Unsplash, not of a shop in Tbilisi.
- There is no password reset and no email verification.
- The fake payment provider keeps its checkouts in memory, so a payment
  page opened before the API restarts no longer exists afterwards; the
  booking then expires after its 30-minute hold.
- `client/public/photos/barber.webp` is in the repository but no page
  uses it.

## Project layout

The file tree, with a line on each folder, is in the
[README](../README.md#project-structure).
