# Barbershop Booking System

A booking system for a barbershop with several barbers. Customers pick a
service, a barber, and a time slot; barbers manage their schedule; the
admin manages services, staff, and working hours.

This is a portfolio project that runs locally. It is being built one slice
at a time. So far: the database layer, authentication, availability and
bookings (API only).

## Stack

- Frontend: React, Vite, TypeScript, Tailwind (not started)
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
```

`npm run db:studio` opens a browser view of the data.

## Running

From `server/`:

```sh
npm run dev    # API on http://localhost:3000, restarts on changes
npm test       # runs the tests against a separate barbershop_test database
```

The test database is created and migrated automatically on the first run.

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
| GET    | `/services`     | Active services with duration, price and deposit         |
| GET    | `/barbers`      | Active barbers                                           |
| GET    | `/availability` | Free start times for `barberId`, `serviceId` and `date`  |

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

| Role     | Email                 |
| -------- | --------------------- |
| Admin    | admin@barbershop.test |
| Barber   | marco@barbershop.test |
| Barber   | dev@barbershop.test   |
| Barber   | sam@barbershop.test   |
| Customer | alex@example.test     |
| Customer | priya@example.test    |
| Customer | jordan@example.test   |

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
```

## How double-booking is prevented

The `bookings` table has a PostgreSQL exclusion constraint: two bookings
for the same barber can't cover overlapping time unless one of them is
cancelled. The database enforces it, so two requests arriving at the same
moment can't both succeed: one is saved and the other gets a
`409 SLOT_UNAVAILABLE`. See
`server/prisma/migrations/20261004143447_booking_no_overlap/migration.sql`.
