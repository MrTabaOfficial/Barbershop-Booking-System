import { Router } from "express";
import { prisma } from "../db.ts";

export function createBarbersRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const barbers = await prisma.barber.findMany({
      where: { isActive: true },
      orderBy: { user: { name: "asc" } },
      include: { user: true, workingHours: { orderBy: { weekday: "asc" } } },
    });
    res.json({
      barbers: barbers.map((barber) => ({
        id: barber.id,
        name: barber.user.name,
        bio: barber.bio,
        workingHours: barber.workingHours.map((hours) => ({
          weekday: hours.weekday,
          startMinute: hours.startMinute,
          endMinute: hours.endMinute,
          breakStartMinute: hours.breakStartMinute,
          breakEndMinute: hours.breakEndMinute,
        })),
      })),
    });
  });

  return router;
}
