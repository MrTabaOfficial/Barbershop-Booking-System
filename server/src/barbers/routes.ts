import { Router } from "express";
import { prisma } from "../db.ts";

export function createBarbersRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const barbers = await prisma.barber.findMany({
      where: { isActive: true },
      orderBy: { user: { name: "asc" } },
      include: { user: true },
    });
    // Public list: the barber's name, but not their email or user id.
    res.json({
      barbers: barbers.map((barber) => ({
        id: barber.id,
        name: barber.user.name,
        bio: barber.bio,
      })),
    });
  });

  return router;
}
