import type { FastifyInstance, FastifyReply } from "fastify";
import type { CallStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, requireBoss, type CurrentUser } from "../authPlugin.js";
import { taskInclude } from "../taskInclude.js";
import { resultMessage } from "../messages.js";

const resultSchema = z.object({
  status: z.enum(["REACHED", "NO_ANSWER", "PHONE_OFF"]),
});

// REACHED — yakuniy holat (xato bo'lsa boshliq "Qayta boshlash" bilan qaytaradi)
const OPEN_STATUSES: CallStatus[] = ["PENDING", "IN_PROGRESS", "NO_ANSWER", "PHONE_OFF"];

// Xodim faqat o'ziga biriktirilgan vazifa bilan ishlaydi; boshliq — istalgani bilan.
// Faqat faol topshiriqdagi vazifalar o'zgartiriladi.
function editableBy(user: CurrentUser): Prisma.CallTaskWhereInput {
  return {
    campaign: { status: "ACTIVE" },
    ...(user.role === "BOSS" ? {} : { assignedToId: user.id }),
  };
}

// updateMany 0 qator qaytarganda foydalanuvchiga aniq sababni aytish
async function explainRejection(id: string, user: CurrentUser, reply: FastifyReply) {
  const task = await prisma.callTask.findUnique({ where: { id }, include: { campaign: true } });
  if (!task) return reply.code(404).send({ error: "Vazifa topilmadi" });
  if (task.campaign.status !== "ACTIVE") return reply.code(409).send({ error: "Bu topshiriq yakunlangan" });
  if (user.role !== "BOSS" && task.assignedToId !== user.id) {
    return reply.code(403).send({ error: "Bu MFY sizga biriktirilmagan" });
  }
  if (task.status === "REACHED") return reply.code(409).send({ error: "Bu MFY bilan allaqachon bog'lanilgan" });
  return reply.code(409).send({ error: "Holat o'zgargan, sahifani yangilang" });
}

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Qo'ng'iroq boshlandi — boshqalar (boshliq) kim hozir gaplashayotganini ko'radi
  fastify.post("/api/tasks/:id/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { in: ["PENDING", "NO_ANSWER", "PHONE_OFF"] }, ...editableBy(user) },
        data: { status: "IN_PROGRESS", calledAt: new Date() },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId: user.id, status: "IN_PROGRESS" } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) {
      // Qayta bosish (allaqachon IN_PROGRESS) — xato emas, joriy holatni qaytaramiz
      const current = await prisma.callTask.findFirst({ where: { id, status: "IN_PROGRESS", ...editableBy(user) }, include: taskInclude });
      if (current) return current;
      return explainRejection(id, user, reply);
    }

    fastify.io.to("dashboard").emit("task:update", task);
    return task;
  });

  // Natija: guruhga xabar ketadi
  fastify.post("/api/tasks/:id/result", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = resultSchema.parse(request.body);
    const user = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { in: OPEN_STATUSES }, ...editableBy(user) },
        data: { status, calledAt: new Date() },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId: user.id, status } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) return explainRejection(id, user, reply);

    fastify.io.to("dashboard").emit("task:update", task);

    const [reached, total] = await Promise.all([
      prisma.callTask.count({ where: { campaignId: task.campaignId, status: "REACHED" } }),
      prisma.callTask.count({ where: { campaignId: task.campaignId } }),
    ]);
    void fastify.notifyGroup(
      resultMessage({
        status,
        mahallaName: task.mahalla.name,
        chairmanName: task.mahalla.chairmanName,
        employeeName: user.fullName,
        reached,
        total,
        at: new Date(),
      }),
    );
    return task;
  });

  // Boshliq natijani bekor qiladi (xato belgilangan bo'lsa). Mas'ul xodim o'zgarmaydi.
  fastify.post("/api/tasks/:id/reset", { preHandler: requireBoss }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { not: "PENDING" }, campaign: { status: "ACTIVE" } },
        data: { status: "PENDING", calledAt: null },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId: user.id, status: "PENDING" } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) return explainRejection(id, user, reply);

    fastify.io.to("dashboard").emit("task:update", task);
    return task;
  });
}
