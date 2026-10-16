import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate } from "../authPlugin.js";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
});

export async function meRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Kim kirdi va qaysi tashkilotlarda qanday rolda — ilova shu asosida ekranni tanlaydi
  fastify.get("/api/me", async (request) => {
    const auth = request.authUser!;
    const memberships = await prisma.membership.findMany({
      where: { userId: auth.id, isActive: true, org: { status: "ACTIVE" } },
      include: { org: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return {
      user: { id: auth.id, fullName: auth.fullName, isPlatformOwner: auth.isPlatformOwner },
      memberships: memberships.map((m) => ({ orgId: m.org.id, orgName: m.org.name, role: m.role })),
    };
  });

  // Ism Telegram'dan olinadi, foydalanuvchi o'zi to'g'rilashi mumkin
  fastify.patch("/api/me", async (request) => {
    const { fullName } = profileSchema.parse(request.body);
    const user = await prisma.user.update({ where: { id: request.authUser!.id }, data: { fullName } });
    return { id: user.id, fullName: user.fullName };
  });
}
