import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireBoss } from "../authPlugin.js";
import { orgScoped } from "./scope.js";
import { taskInclude } from "../taskInclude.js";
import { finalReportMessage, newCampaignMessage } from "../messages.js";

const createSchema = z
  .object({
    kind: z.enum(["MEETING", "EVENT", "OTHER"]),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional(),
    scheduledAt: z.coerce.date().optional(),
    location: z.string().trim().max(200).optional(),
  })
  // Yig'ilish va tadbirda vaqt muhim — xodimlar raislarga aynan shuni yetkazadi
  .refine((b) => b.kind === "OTHER" || b.scheduledAt, { message: "Sana va vaqtni kiriting", path: ["scheduledAt"] });

const campaignInclude = {
  tasks: { include: taskInclude, orderBy: { mahalla: { sortOrder: "asc" } } },
} as const;

export async function campaignRoutes(fastify: FastifyInstance) {
  orgScoped(fastify);

  fastify.get("/api/campaigns/active", async (request) => {
    return prisma.callCampaign.findFirst({
      where: { orgId: request.currentUser!.orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: campaignInclude,
    });
  });

  // Oldingi topshiriqlar tarixi (natijalar soni bilan)
  fastify.get("/api/campaigns", async (request) => {
    const campaigns = await prisma.callCampaign.findMany({
      where: { orgId: request.currentUser!.orgId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { _count: { select: { tasks: true } } },
    });
    const reached = await prisma.callTask.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: campaigns.map((c) => c.id) }, status: "REACHED" },
      _count: true,
    });
    const reachedBy = new Map(reached.map((r) => [r.campaignId, r._count]));
    return campaigns.map(({ _count, ...c }) => ({ ...c, total: _count.tasks, reached: reachedBy.get(c.id) ?? 0 }));
  });

  fastify.post("/api/campaigns", { preHandler: requireBoss }, async (request, reply) => {
    const { orgId, id: createdById } = request.currentUser!;
    const body = createSchema.parse(request.body);

    // Bir tashkilotda bir vaqtda bitta faol topshiriq — xodimlar adashmasligi uchun
    const result = await prisma.$transaction(async (tx) => {
      if (await tx.callCampaign.findFirst({ where: { orgId, status: "ACTIVE" } })) {
        return { error: "Avval joriy topshiriqni yakunlang" } as const;
      }
      const mahallas = await tx.mahalla.findMany({ where: { orgId, isActive: true } });
      if (mahallas.length === 0) return { error: "Avval MFY'larni qo'shing" } as const;

      // Mas'ul faol a'zo bo'lmasa — vazifa biriktirilmagan bo'ladi (boshliq ko'radi va biriktiradi)
      const activeIds = new Set(
        (await tx.membership.findMany({ where: { orgId, isActive: true }, select: { userId: true } })).map((m) => m.userId),
      );
      const campaign = await tx.callCampaign.create({
        data: {
          orgId,
          createdById,
          kind: body.kind,
          title: body.title,
          description: body.description || null,
          scheduledAt: body.scheduledAt ?? null,
          location: body.location || null,
          tasks: {
            create: mahallas.map((m) => ({
              mahallaId: m.id,
              assignedToId: m.assignedToId && activeIds.has(m.assignedToId) ? m.assignedToId : null,
            })),
          },
        },
        include: campaignInclude,
      });
      return { campaign } as const;
    });

    if ("error" in result) return reply.code(409).send({ error: result.error });
    const { campaign } = result;
    fastify.emitToOrg(orgId, "campaign:created", campaign);

    // Har bir xodimga shaxsiy xabar: nima, qachon va unga nechta MFY
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const perUser = new Map<string, number>();
    for (const t of campaign.tasks) if (t.assignedToId) perUser.set(t.assignedToId, (perUser.get(t.assignedToId) ?? 0) + 1);
    const users = await prisma.user.findMany({ where: { id: { in: [...perUser.keys()] }, telegramId: { not: null } } });
    for (const u of users) {
      void fastify.notifyUser(u.telegramId!, newCampaignMessage(campaign, perUser.get(u.id)!, org.timezone), true);
    }

    return reply.code(201).send(campaign);
  });

  fastify.post("/api/campaigns/:id/close", { preHandler: requireBoss }, async (request, reply) => {
    const { orgId } = request.currentUser!;
    const { id } = request.params as { id: string };
    const { count } = await prisma.callCampaign.updateMany({
      where: { id, orgId, status: "ACTIVE" },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    if (count === 0) return reply.code(409).send({ error: "Topshiriq topilmadi yoki allaqachon yakunlangan" });

    const campaign = await prisma.callCampaign.findUniqueOrThrow({ where: { id }, include: { org: true } });
    const tasks = await prisma.callTask.findMany({
      where: { campaignId: id },
      include: taskInclude,
      orderBy: { mahalla: { sortOrder: "asc" } },
    });

    fastify.emitToOrg(orgId, "campaign:closed", { id });
    void fastify.notifyGroup(orgId, finalReportMessage(campaign, tasks, campaign.org.timezone));
    return { id, status: campaign.status };
  });
}
