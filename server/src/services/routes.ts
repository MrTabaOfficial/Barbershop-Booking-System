import { Router } from "express";
import { prisma } from "../db.ts";

export function createServicesRouter(): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceCents: true,
        depositCents: true,
      },
    });
    res.json({ services });
  });

  return router;
}
