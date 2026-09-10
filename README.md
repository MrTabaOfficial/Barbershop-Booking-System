# Barbershop Booking System

A booking system for a barbershop with several barbers. Customers pick a
service, a barber, and a time slot; barbers manage their schedule; the
admin manages services, staff, and working hours.

This is a portfolio project that runs locally. It is being built one slice
at a time, and so far only the database layer exists.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind (not started)
- Backend: Node, Express, TypeScript
- Database: PostgreSQL 17 in Docker, Prisma 7

## Requirements

- Node.js 22 or newer
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
    env.ts             Loads and checks environment variables
    db.ts              Shared Prisma client
```

## How double-booking is prevented

The `bookings` table has a PostgreSQL exclusion constraint: two bookings
for the same barber can't cover overlapping time unless one of them is
cancelled. The database enforces it, so two requests arriving at the same
moment can't both succeed. See
`server/prisma/migrations/20261004143447_booking_no_overlap/migration.sql`.
