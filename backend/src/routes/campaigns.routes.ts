import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

const taskInclude = {
  mahalla: true,
  assignedTo: { select: { id: true, fullName: true } },
} as const;

export async function campaignRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/api/campaigns/active", async () => {
    return prisma.callCampaign.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        tasks: {
          include: taskInclude,
          orderBy: { mahalla: { sortOrder: "asc" } },
        },
      },
    });
  });

  fastify.get("/api/campaigns", async () => {
    return prisma.callCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  });

  fastify.post("/api/campaigns", { preHandler: requireBoss }, async (request, reply) => {
    const body = createSchema.parse(request.body);

    const mahallas = await prisma.mahalla.findMany({ where: { isActive: true } });
    if (mahallas.length === 0) {
      return reply.code(400).send({ error: "Avval mahalla raislarini qo'shing" });
    }

    const campaign = await prisma.callCampaign.create({
      data: {
        title: body.title,
        description: body.description,
        createdById: request.currentUser!.id,
        tasks: {
          create: mahallas.map((m) => ({ mahallaId: m.id })),
        },
      },
      include: { tasks: { include: taskInclude } },
    });

    fastify.io.to("dashboard").emit("campaign:created", campaign);
    return reply.code(201).send(campaign);
  });

  fastify.post("/api/campaigns/:id/close", { preHandler: requireBoss }, async (request) => {
    const { id } = request.params as { id: string };
    const campaign = await prisma.callCampaign.update({ where: { id }, data: { status: "CLOSED" } });
    fastify.io.to("dashboard").emit("campaign:closed", campaign);
    return campaign;
  });

  fastify.get("/api/campaigns/:id/summary", async (request) => {
    const { id } = request.params as { id: string };
    const tasks = await prisma.callTask.findMany({
      where: { campaignId: id },
      include: { assignedTo: { select: { id: true, fullName: true } } },
    });

    const byStatus: Record<string, number> = {};
    const byEmployee: Record<string, number> = {};

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      if (task.assignedTo) {
        byEmployee[task.assignedTo.fullName] = (byEmployee[task.assignedTo.fullName] ?? 0) + 1;
      }
    }

    return { total: tasks.length, byStatus, byEmployee };
  });
}
