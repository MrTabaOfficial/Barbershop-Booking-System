# Dalaki · Barbershop Booking System

A booking system for Dalaki (დალაქი, "barber" in Georgian), a fictional
barbershop in Tbilisi with several barbers. Customers pick a service, a
barber, and a time slot; barbers manage their schedule; the admin manages
services, staff, and working hours.

This is a portfolio project that runs locally. It is being built one slice
at a time. So far: the database layer, authentication, the availability
and bookings API, and the customer-facing website.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind, React Router, TanStack
  Query, react-hook-form with zod
- Backend: Node, Express, TypeScript
- Database: PostgreSQL 17 in Docker, Prisma 7

## Requirements

- Node.js 26 or newer (the time zone code uses the built-in `Temporal` API)
- Docker Desktop

## Setup

```sh
# 1. Create your local environment file and change the passwords in it
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d

# 3. Install dependencies, create the tables, load demo data
cd server
npm install
npm run db:migrate
npm run db:seed

# 4. Install the website's dependencies
cd ../client
npm install
```

`npm run db:studio` (in `server/`) opens a browser view of the data.

## Running

Two terminals:

```sh
cd server
npm run dev    # API on http://localhost:3000, restarts on changes
```

```sh
cd client
npm run dev    # website on http://localhost:5173
```

Open http://localhost:5173. The website's dev server forwards `/api/*` to
the API, so the browser only ever talks to one address.

Tests:

```sh
cd server && npm test   # API tests, against a separate barbershop_test database
cd client && npm test   # unit tests for the API layer and formatting helpers
```

The test database is created and migrated automatically on the first run.

### End-to-end tests

A small Playwright suite in `e2e/` drives the real website in a browser
against the real API: booking as a visitor and registering on the way,
recovering when the slot is taken at the last moment, rescheduling,
cancelling, and staying logged in across a reload.

```sh
cd e2e
npm install
npm run browsers   # once: downloads the Chromium that Playwright drives
npm test
```

`npm test` does everything else by itself. It creates and seeds a separate
`barbershop_e2e` database, starts its own API (port 3100) and website
(port 5174), runs the tests, and stops both. It never touches the
development database, and it can run while your dev servers are up. It
only needs PostgreSQL running (`docker compose up -d`).

When a test fails, a screenshot and a trace are kept in
`e2e/test-results/`.

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
| GET    | `/shop`         | Time zone, today's date in the shop, booking limits      |
| GET    | `/services`     | Active services with duration, price and deposit         |
| GET    | `/barbers`      | Active barbers with their working hours                  |
| GET    | `/availability` | Free start times for `barberId`, `serviceId` and `date`  |

`/availability` also accepts `excludeBookingId`. When the caller is logged
in and owns that booking, it is left out of the calculation, so the
reschedule dialog can offer times that overlap the booking's current one.
Anyone else's booking id is ignored.

Logged-in users:

| Method | Path                       | What it does                                  |
| ------ | -------------------------- | --------------------------------------------- |
| POST   | `/bookings`                | Books a slot returned by `/availability`      |
| GET    | `/bookings/mine`           | The user's upcoming and past bookings         |
| POST   | `/bookings/:id/cancel`     | Cancels the user's own booking                |
| POST   | `/bookings/:id/reschedule` | Moves the user's own booking to a new time    |

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

## How availability works

For one barber, one service and one date, the free start times are found
like this:

1. No working hours for that weekday, or a day off on that date, means no
   slots.
2. The day's opening, closing and break times are converted from the
   shop's clock to exact instants for that date.
3. Starting at opening, every 15 minutes is a candidate. It is kept if it
   starts at least an hour from now, ends by closing time, and overlaps
   neither the break nor a non-cancelled booking.
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

## Demo accounts

All demo accounts use the password from `SEED_PASSWORD` in `.env`.

| Role     | Name                 | Email                 |
| -------- | -------------------- | --------------------- |
| Admin    | Tamar Beridze        | tamar@dalaki.example  |
| Barber   | Giorgi Kapanadze     | giorgi@dalaki.example |
| Barber   | Luka Gelashvili      | luka@dalaki.example   |
| Barber   | Nika Tsiklauri       | nika@dalaki.example   |
| Customer | Davit Maisuradze     | davit@dalaki.example  |
| Customer | Nino Lomidze         | nino@dalaki.example   |
| Customer | Irakli Mchedlishvili | irakli@dalaki.example |

Only customers have pages in the website so far. Log in as Davit to see
upcoming and past bookings. The shop, its address and its phone number are
fictional, and prices are in Georgian lari.

## Project layout

```
docker-compose.yml     PostgreSQL container
.env.example           Template for .env
server/
  prisma.config.ts     Prisma CLI configuration
  prisma/
    schema.prisma      Data model
    migrations/        SQL applied to the database, in order
    seed.ts            Demo data
  src/
    index.ts           Starts the server
    app.ts             Builds the Express app
    env.ts             Loads and checks environment variables
    db.ts              Shared Prisma client
    errors.ts          Error format and central error handler
    auth/
      routes.ts        The /auth endpoints
      service.ts       Register, login, and refresh token rotation
      tokens.ts        Access token signing, refresh token generation
      password.ts      Password hashing
      schemas.ts       Request validation
      middleware.ts    requireAuth and requireRole
    shop/
      time.ts          Conversions between shop clock time and UTC
      routes.ts        GET /shop
    availability/
      slots.ts         The slot calculation (pure function)
      service.ts       Loads schedule and bookings for the calculation
      routes.ts        GET /availability
    services/routes.ts GET /services
    barbers/routes.ts  GET /barbers
    bookings/
      routes.ts        The /bookings endpoints
      service.ts       Create, list, cancel, reschedule
      schemas.ts       Request validation
  tests/               Vitest tests, run against a separate database
client/
  index.html
  vite.config.ts       Vite, Tailwind, and the /api proxy
  src/
    main.tsx           Entry: fonts, providers, router
    index.css          Tailwind, brand colours and fonts, base styles
    routes.tsx         Route table
    shop.ts            Shop facts: name, wordmark, address, phone
    api/
      http.ts          fetch wrapper: token in memory, refresh and retry
      queries.ts       TanStack Query hooks, one per endpoint
      types.ts         Shapes of API responses
    auth/
      AuthProvider.tsx Session state: restore on load, login, logout
      AuthContext.ts   The useAuth hook
      RequireAuth.tsx  Guard for logged-in pages
      AuthForms.tsx    Login and register forms
    components/        Button, Input, Card, Dialog, Notice, States,
                       StatusBadge, Layout
    booking/           SlotPicker (day and time), Stepper, ChoiceList,
                       ConfirmStep, BookingCard, cancel and reschedule
                       dialogs
    pages/             Home, Book, login and register, My bookings
    lib/               Dates, formatting, form errors, safe redirects
e2e/
  playwright.config.ts Starts the API and website for the tests
  environment.ts       The suite's own database and ports
  global-setup.ts      Migrates and seeds the e2e database
  tests/               The end-to-end tests and their helpers
```

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

## How double-booking is prevented

The `bookings` table has a PostgreSQL exclusion constraint: two bookings
for the same barber can't cover overlapping time unless one of them is
cancelled. The database enforces it, so two requests arriving at the same
moment can't both succeed: one is saved and the other gets a
`409 SLOT_UNAVAILABLE`. See
`server/prisma/migrations/20261004143447_booking_no_overlap/migration.sql`.
