import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireBoss } from "../authPlugin.js";
import { orgScoped } from "./scope.js";
import { reassignOpenTasks } from "../assignment.js";
import { activeBossCount, createInvite, inviteLink } from "../orgService.js";

const roleSchema = z.enum(["BOSS", "EMPLOYEE"]);

const addSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(30).optional(),
  role: roleSchema.default("EMPLOYEE"),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

const transferSchema = z.object({ toUserId: z.string().min(1) });

export async function memberRoutes(fastify: FastifyInstance) {
  orgScoped(fastify);
  fastify.addHook("preHandler", requireBoss);

  const findMember = (orgId: string, userId: string) =>
    prisma.membership.findUnique({ where: { orgId_userId: { orgId, userId } }, include: { user: true } });

  fastify.get("/api/members", async (request) => {
    const { orgId } = request.currentUser!;
    const [memberships, invites, counts] = await Promise.all([
      prisma.membership.findMany({ where: { orgId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
      // Hali qo'shilmagan o'rinlar uchun amaldagi havola
      prisma.invite.findMany({
        // Muddatsiz (eski tizimdan ko'chirilgan) havolalar ham amal qiladi
        where: {
          orgId,
          userId: { not: null },
          usedAt: null,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.mahalla.groupBy({ by: ["assignedToId"], where: { orgId, isActive: true }, _count: true }),
    ]);
    const countBy = new Map(counts.map((c) => [c.assignedToId, c._count]));

    return memberships.map((m) => {
      const invite = invites.find((i) => i.userId === m.userId);
      return {
        userId: m.userId,
        fullName: m.user.fullName,
        username: m.user.username,
        phone: m.user.phone,
        role: m.role,
        isActive: m.isActive,
        joined: m.user.telegramId !== null,
        mahallaCount: countBy.get(m.userId) ?? 0,
        inviteLink: invite && m.user.telegramId === null ? inviteLink(invite.code) : null,
      };
    });
  });

  // Xodimni oldindan qo'shish (MFY'larni darhol biriktirish uchun) + uning shaxsiy taklif havolasi
  fastify.post("/api/members", async (request, reply) => {
    const { orgId, id: createdById } = request.currentUser!;
    const body = addSchema.parse(request.body);
    const invite = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { fullName: body.fullName, phone: body.phone } });
      await tx.membership.create({ data: { orgId, userId: user.id, role: body.role } });
      return createInvite(orgId, body.role, createdById, user.id, tx);
    });
    return reply.code(201).send({ userId: invite.userId, inviteLink: inviteLink(invite.code) });
  });

  // Umumiy (ismsiz) taklif: havolani ochgan odam Telegram'dagi ismi bilan qo'shiladi
  fastify.post("/api/invites", async (request, reply) => {
    const { orgId, id } = request.currentUser!;
    const { role } = z.object({ role: roleSchema }).parse(request.body);
    const invite = await createInvite(orgId, role, id);
    return reply.code(201).send({ inviteLink: inviteLink(invite.code), expiresAt: invite.expiresAt });
  });

  // Hali qo'shilmagan xodim uchun yangi havola (eskisi bekor qilinadi)
  fastify.post("/api/members/:userId/invite", async (request, reply) => {
    const { orgId, id } = request.currentUser!;
    const { userId } = request.params as { userId: string };
    const member = await findMember(orgId, userId);
    if (!member) return reply.code(404).send({ error: "A'zo topilmadi" });
    if (member.user.telegramId !== null) return reply.code(400).send({ error: "Bu a'zo allaqachon Telegram orqali qo'shilgan" });

    const invite = await prisma.$transaction(async (tx) => {
      await tx.invite.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      return createInvite(orgId, member.role, id, userId, tx);
    });
    return { inviteLink: inviteLink(invite.code) };
  });

  fastify.patch("/api/members/:userId", async (request, reply) => {
    const { orgId } = request.currentUser!;
    const { userId } = request.params as { userId: string };
    const body = updateSchema.parse(request.body);
    const member = await findMember(orgId, userId);
    if (!member) return reply.code(404).send({ error: "A'zo topilmadi" });

    // Tashkilot boshliqsiz qolmasligi kerak
    const losesBoss = member.role === "BOSS" && member.isActive && (body.role === "EMPLOYEE" || body.isActive === false);
    if (losesBoss && (await activeBossCount(orgId)) <= 1) {
      return reply.code(400).send({ error: "Tashkilotda kamida bitta boshliq qolishi kerak" });
    }
    // MFY'lari bor odam o'chirilsa, MFY'lar egasiz qoladi
    if (body.isActive === false && member.isActive) {
      const owned = await prisma.mahalla.count({ where: { orgId, assignedToId: userId, isActive: true } });
      if (owned > 0) return reply.code(400).send({ error: `Avval ${owned} ta MFY'ni boshqa xodimga o'tkazing` });
    }

    await prisma.$transaction(async (tx) => {
      if (body.role !== undefined || body.isActive !== undefined) {
        await tx.membership.update({
          where: { orgId_userId: { orgId, userId } },
          data: { role: body.role, isActive: body.isActive },
        });
      }
      if (body.fullName !== undefined || body.phone !== undefined) {
        await tx.user.update({ where: { id: userId }, data: { fullName: body.fullName, phone: body.phone } });
      }
    });
    fastify.emitToOrg(orgId, "campaign:changed");
    fastify.emitToOrg(orgId, "mahalla:changed");
    return { ok: true };
  });

  // Xodimning barcha MFY'larini boshqa a'zoga o'tkazish (ishdan ketsa, kasal bo'lsa)
  fastify.post("/api/members/:userId/transfer", async (request, reply) => {
    const { orgId } = request.currentUser!;
    const { userId } = request.params as { userId: string };
    const { toUserId } = transferSchema.parse(request.body);
    if (toUserId === userId) return reply.code(400).send({ error: "Boshqa xodimni tanlang" });

    const target = await prisma.membership.findFirst({ where: { orgId, userId: toUserId, isActive: true } });
    if (!target) return reply.code(400).send({ error: "Xodim topilmadi yoki faol emas" });

    const moved = await prisma.$transaction(async (tx) => {
      const { count } = await tx.mahalla.updateMany({ where: { orgId, assignedToId: userId }, data: { assignedToId: toUserId } });
      await reassignOpenTasks(tx, orgId, { assignedToId: userId }, toUserId);
      return count;
    });

    fastify.emitToOrg(orgId, "campaign:changed");
    fastify.emitToOrg(orgId, "mahalla:changed");
    return { moved };
  });
}
