import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";

const MAX_EMPLOYEES = 5;

const inviteSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(5).optional(),
});

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  isActive: z.boolean().optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/api/users", async () => {
    return prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      select: {
        id: true,
        fullName: true,
        phone: true,
        isActive: true,
        telegramId: true,
        inviteCode: true,
        linkedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  });

  fastify.post("/api/users/invite", { preHandler: requireBoss }, async (request, reply) => {
    const body = inviteSchema.parse(request.body);
    const activeCount = await prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } });
    if (activeCount >= MAX_EMPLOYEES) {
      return reply.code(400).send({ error: `Maksimal xodimlar soni (${MAX_EMPLOYEES}) ga yetdi` });
    }

    const inviteCode = crypto.randomBytes(9).toString("base64url");
    const user = await prisma.user.create({
      data: { fullName: body.fullName, phone: body.phone, role: "EMPLOYEE", inviteCode, isActive: true },
    });

    const inviteLink = `https://t.me/${process.env.BOT_USERNAME}?start=${inviteCode}`;
    return reply.code(201).send({ user, inviteLink });
  });

  fastify.post("/api/users/:id/reinvite", { preHandler: requireBoss }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const inviteCode = crypto.randomBytes(9).toString("base64url");
    const user = await prisma.user.update({
      where: { id },
      data: { inviteCode, telegramId: null, linkedAt: null },
    });
    const inviteLink = `https://t.me/${process.env.BOT_USERNAME}?start=${inviteCode}`;
    return reply.send({ user, inviteLink });
  });

  fastify.patch("/api/users/:id", { preHandler: requireBoss }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    return prisma.user.update({ where: { id }, data: body });
  });
}
