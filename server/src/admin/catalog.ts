import { hashPassword } from "../auth/password.ts";
import { isUniqueViolation, prisma } from "../db.ts";
import { AppError } from "../errors.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type {
  CreateBarberInput,
  CreateServiceInput,
  UpdateBarberInput,
  UpdateServiceInput,
  WorkingHoursInput,
} from "./schemas.ts";

function invalidField(path: string, message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", "The request is not valid", [{ path, message }]);
}

const DEPOSIT_TOO_HIGH = "The deposit can't be more than the price";

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
  const priceCents = input.priceCents ?? service.priceCents;
  const depositCents = input.depositCents ?? service.depositCents;
  if (depositCents > priceCents) {
    throw invalidField("depositCents", DEPOSIT_TOO_HIGH);
  }
  try {
    return await prisma.service.update({ where: { id: serviceId }, data: input });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "SERVICE_NAME_TAKEN", "There is already a service with this name");
    }
    throw error;
  }
}

const barberDetails = {
  user: true,
  workingHours: { orderBy: { weekday: "asc" } },
} satisfies Prisma.BarberInclude;

export type BarberWithDetails = Prisma.BarberGetPayload<{ include: typeof barberDetails }>;

export function listBarbers(): Promise<BarberWithDetails[]> {
  return prisma.barber.findMany({ include: barberDetails, orderBy: { user: { name: "asc" } } });
}

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
      user: input.name === undefined ? undefined : { update: { name: input.name } },
    },
    include: barberDetails,
  });
}

export async function replaceWorkingHours(
  barberId: string,
  input: WorkingHoursInput,
): Promise<BarberWithDetails> {
  await requireBarber(barberId);
  await prisma.$transaction([
    prisma.workingHours.deleteMany({ where: { barberId } }),
    prisma.workingHours.createMany({
      data: input.days.map((day) => ({ ...day, barberId })),
    }),
  ]);
  return prisma.barber.findUniqueOrThrow({ where: { id: barberId }, include: barberDetails });
}
