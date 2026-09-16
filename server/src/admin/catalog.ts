import { hashPassword } from "../auth/password.ts";
import { prisma } from "../db.ts";
import { AppError } from "../errors.ts";
import { Prisma } from "../generated/prisma/client.ts";
import type {
  CreateBarberInput,
  CreateServiceInput,
  UpdateBarberInput,
  UpdateServiceInput,
  WorkingHoursInput,
} from "./schemas.ts";

// What the shop offers and who works there: services and barbers. Neither
// is ever deleted, because bookings point at them. They are deactivated,
// which takes them off the website and keeps the history intact.

// P2002 is Prisma's code for a unique constraint violation.
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function invalidField(path: string, message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", "The request is not valid", [{ path, message }]);
}

const DEPOSIT_TOO_HIGH = "The deposit can't be more than the price";

// --- services

export function listServices() {
  return prisma.service.findMany({ orderBy: { name: "asc" } });
}

export async function createService(input: CreateServiceInput) {
  if (input.depositCents > input.priceCents) {
    throw invalidField("depositCents", DEPOSIT_TOO_HIGH);
  }
  try {
    return await prisma.service.create({ data: input });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "SERVICE_NAME_TAKEN", "There is already a service with this name");
    }
    throw error;
  }
}

export async function updateService(serviceId: string, input: UpdateServiceInput) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new AppError(404, "SERVICE_NOT_FOUND", "Service not found");
  }
  // Either amount may be the one being changed, so compare the result.
  const priceCents = input.priceCents ?? service.priceCents;
  const depositCents = input.depositCents ?? service.depositCents;
  if (depositCents > priceCents) {
    throw invalidField("depositCents", DEPOSIT_TOO_HIGH);
  }
  try {
    // Existing bookings keep the price and length they were made with.
    return await prisma.service.update({ where: { id: serviceId }, data: input });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "SERVICE_NAME_TAKEN", "There is already a service with this name");
    }
    throw error;
  }
}

// --- barbers

const barberDetails = {
  user: true,
  workingHours: { orderBy: { weekday: "asc" } },
} satisfies Prisma.BarberInclude;

export type BarberWithDetails = Prisma.BarberGetPayload<{ include: typeof barberDetails }>;

export function listBarbers(): Promise<BarberWithDetails[]> {
  return prisma.barber.findMany({ include: barberDetails, orderBy: { user: { name: "asc" } } });
}

// Creates the login and the barber profile together. The new barber has no
// working hours yet, so nobody can book them until those are set.
export async function createBarber(input: CreateBarberInput): Promise<BarberWithDetails> {
  try {
    return await prisma.barber.create({
      data: {
        bio: input.bio,
        user: {
          create: {
            email: input.email,
            name: input.name,
            role: "BARBER",
            passwordHash: await hashPassword(input.password),
          },
        },
      },
      include: barberDetails,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
    throw error;
  }
}

async function requireBarber(barberId: string) {
  const barber = await prisma.barber.findUnique({ where: { id: barberId } });
  if (!barber) {
    throw new AppError(404, "BARBER_NOT_FOUND", "Barber not found");
  }
  return barber;
}

export async function updateBarber(
  barberId: string,
  input: UpdateBarberInput,
): Promise<BarberWithDetails> {
  await requireBarber(barberId);
  return prisma.barber.update({
    where: { id: barberId },
    data: {
      bio: input.bio,
      isActive: input.isActive,
      // The name lives on the barber's user account.
      user: input.name === undefined ? undefined : { update: { name: input.name } },
    },
    include: barberDetails,
  });
}

// Replaces the barber's whole week. Bookings already made are left as they
// are, even if they now fall outside the new hours.
export async function replaceWorkingHours(
  barberId: string,
  input: WorkingHoursInput,
): Promise<BarberWithDetails> {
  await requireBarber(barberId);
  // Both statements succeed or neither does, so the barber is never left
  // with an empty week halfway through.
  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { barberId } }),
    prisma.workingHours.createMany({
      data: input.days.map((day) => ({ ...day, barberId })),
    }),
  ]);
  return prisma.barber.findUniqueOrThrow({ where: { id: barberId }, include: barberDetails });
}
