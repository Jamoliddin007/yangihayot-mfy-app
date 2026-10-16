import type { FastifyInstance } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";
import { reassignOpenTasks } from "../assignment.js";

const MAX_EMPLOYEES = 5;

const inviteSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(30).optional(),
});

const transferSchema = z.object({
  toUserId: z.string().min(1),
});

const updateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  isActive: z.boolean().optional(),
});

function inviteLinkFor(code: string) {
  return `https://t.me/${process.env.BOT_USERNAME}?start=${code}`;
}

function newInviteCode() {
  return crypto.randomBytes(9).toString("base64url");
}

export async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);
  // Xodimlar ro'yxatida taklif kodlari bor — xodim boshqa birovning ishlatilmagan kodini olib,
  // o'sha xodim o'rniga ulanib olmasligi uchun butun bo'lim faqat boshliqqa ochiq
  fastify.addHook("preHandler", requireBoss);

  fastify.get("/api/users", async () => {
    const users = await prisma.user.findMany({
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
        _count: { select: { mahallas: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
    return users.map((u) => ({ ...u, inviteLink: u.inviteCode ? inviteLinkFor(u.inviteCode) : null }));
  });

  fastify.post("/api/users/invite", async (request, reply) => {
    const body = inviteSchema.parse(request.body);
    const activeCount = await prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } });
    if (activeCount >= MAX_EMPLOYEES) {
      return reply.code(400).send({ error: `Maksimal xodimlar soni (${MAX_EMPLOYEES}) ga yetdi` });
    }

    const inviteCode = newInviteCode();
    const user = await prisma.user.create({
      data: { fullName: body.fullName, phone: body.phone, role: "EMPLOYEE", inviteCode, isActive: true },
    });

    return reply.code(201).send({ user, inviteLink: inviteLinkFor(inviteCode) });
  });

  fastify.post("/api/users/:id/reinvite", async (request, reply) => {
    const { id } = request.params as { id: string };
    const inviteCode = newInviteCode();
    const { count } = await prisma.user.updateMany({
      where: { id, role: "EMPLOYEE" },
      data: { inviteCode, telegramId: null, linkedAt: null },
    });
    if (count === 0) return reply.code(404).send({ error: "Xodim topilmadi" });
    return reply.send({ inviteLink: inviteLinkFor(inviteCode) });
  });

  fastify.patch("/api/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);

    const employee = await prisma.user.findFirst({ where: { id, role: "EMPLOYEE" } });
    if (!employee) return reply.code(404).send({ error: "Xodim topilmadi" });

    // MFY'lari bor xodim o'chirilsa, ular "egasiz" qolib, keyingi topshiriqda hech kim qo'ng'iroq qilmaydi
    if (body.isActive === false && employee.isActive) {
      const owned = await prisma.mahalla.count({ where: { assignedToId: id, isActive: true } });
      if (owned > 0) {
        return reply.code(400).send({ error: `Avval xodimning ${owned} ta MFY'sini boshqa xodimga o'tkazing` });
      }
    }

    // Qayta yoqishda ham 5 ta limit tekshiriladi (aks holda o'chirib-yoqish orqali limitni aylanib o'tish mumkin edi)
    if (body.isActive === true && !employee.isActive) {
      const activeCount = await prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } });
      if (activeCount >= MAX_EMPLOYEES) {
        return reply.code(400).send({ error: `Maksimal xodimlar soni (${MAX_EMPLOYEES}) ga yetdi` });
      }
    }

    return prisma.user.update({ where: { id }, data: body });
  });

  // Xodimning barcha MFY'larini boshqa xodimga o'tkazish (ishdan ketsa, kasal bo'lsa)
  fastify.post("/api/users/:id/transfer", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { toUserId } = transferSchema.parse(request.body);
    if (toUserId === id) return reply.code(400).send({ error: "Boshqa xodimni tanlang" });

    const target = await prisma.user.findFirst({ where: { id: toUserId, role: "EMPLOYEE", isActive: true } });
    if (!target) return reply.code(400).send({ error: "Xodim topilmadi yoki faol emas" });

    const moved = await prisma.$transaction(async (tx) => {
      const { count } = await tx.mahalla.updateMany({ where: { assignedToId: id }, data: { assignedToId: toUserId } });
      await reassignOpenTasks(tx, { assignedToId: id }, toUserId);
      return count;
    });

    fastify.io.to("dashboard").emit("campaign:changed");
    return { moved };
  });
}
