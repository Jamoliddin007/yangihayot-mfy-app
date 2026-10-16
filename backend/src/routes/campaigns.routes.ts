import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";
import { taskInclude } from "../taskInclude.js";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});

const campaignInclude = {
  tasks: {
    include: taskInclude,
    orderBy: { mahalla: { sortOrder: "asc" } },
  },
} as const;

export async function campaignRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/api/campaigns/active", async () => {
    return prisma.callCampaign.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: campaignInclude,
    });
  });

  fastify.get("/api/campaigns", async () => {
    return prisma.callCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  });

  fastify.post("/api/campaigns", { preHandler: requireBoss }, async (request, reply) => {
    const body = createSchema.parse(request.body);

    // Bir vaqtda faqat bitta faol vazifa bo'lishi mumkin — aks holda xodimlar
    // turli ro'yxatlarni ko'rib, bir raisga ikki marta qo'ng'iroq qilishi mumkin edi
    const result = await prisma.$transaction(async (tx) => {
      const active = await tx.callCampaign.findFirst({ where: { status: "ACTIVE" } });
      if (active) return { error: "Avval joriy vazifani yakunlang" } as const;

      const mahallas = await tx.mahalla.findMany({ where: { isActive: true } });
      if (mahallas.length === 0) return { error: "Avval mahalla raislarini qo'shing" } as const;

      const campaign = await tx.callCampaign.create({
        data: {
          title: body.title,
          description: body.description || undefined,
          createdById: request.currentUser!.id,
          tasks: { create: mahallas.map((m) => ({ mahallaId: m.id })) },
        },
        include: campaignInclude,
      });
      return { campaign } as const;
    });

    if ("error" in result) {
      return reply.code(409).send({ error: result.error });
    }

    fastify.io.to("dashboard").emit("campaign:created", result.campaign);
    void fastify.notifyGroup(`🆕 Yangi vazifa: "${result.campaign.title}" (${result.campaign.tasks.length} ta MFY)`);
    return reply.code(201).send(result.campaign);
  });

  fastify.post("/api/campaigns/:id/close", { preHandler: requireBoss }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { count } = await prisma.callCampaign.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "CLOSED" },
    });
    if (count === 0) {
      return reply.code(409).send({ error: "Vazifa topilmadi yoki allaqachon yakunlangan" });
    }

    const campaign = await prisma.callCampaign.findUniqueOrThrow({ where: { id } });
    const reached = await prisma.callTask.count({ where: { campaignId: id, status: "REACHED" } });
    const total = await prisma.callTask.count({ where: { campaignId: id } });

    fastify.io.to("dashboard").emit("campaign:closed", campaign);
    void fastify.notifyGroup(`🏁 "${campaign.title}" vazifasi yakunlandi: ${reached}/${total} MFY bilan bog'lanildi.`);
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
