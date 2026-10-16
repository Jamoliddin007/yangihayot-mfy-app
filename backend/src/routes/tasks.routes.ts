import type { FastifyInstance, FastifyReply } from "fastify";
import type { CallStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";
import { taskInclude } from "../taskInclude.js";

const resultSchema = z.object({
  status: z.enum(["REACHED", "NO_ANSWER", "PHONE_OFF"]),
});

type ResultStatus = z.infer<typeof resultSchema>["status"];

const RESULT_MESSAGE: Record<ResultStatus, (employee: string, mahalla: string) => string> = {
  REACHED: (employee, mahalla) => `✅ ${employee} — "${mahalla}" MFY bilan bog'landi.`,
  NO_ANSWER: (employee, mahalla) => `📵 ${employee} — "${mahalla}" MFY raisi qo'ng'iroqni ko'tarmadi.`,
  PHONE_OFF: (employee, mahalla) => `⚠️ ${employee} — "${mahalla}" MFY raisining telefoni o'chiq.`,
};

// Natija faqat shu holatlardan belgilanishi mumkin. REACHED — yakuniy holat
// (xato bosilgan bo'lsa boshliq "Qayta boshlash" orqali PENDING'ga qaytaradi).
const RESULT_FROM: CallStatus[] = ["IN_PROGRESS", "NO_ANSWER", "PHONE_OFF"];

const activeCampaign = { campaign: { status: "ACTIVE" } } satisfies Prisma.CallTaskWhereInput;

// updateMany 0 qator qaytarganda foydalanuvchiga aniq sababni aytish uchun
async function explainRejection(id: string, reply: FastifyReply) {
  const task = await prisma.callTask.findUnique({ where: { id }, include: { campaign: true } });
  if (!task) return reply.code(404).send({ error: "Vazifa topilmadi" });
  if (task.campaign.status !== "ACTIVE") return reply.code(409).send({ error: "Bu vazifa yakunlangan" });
  return reply.code(409).send({ error: "Vazifa holati o'zgargan, sahifani yangilang" });
}

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Xodim qo'ng'iroq qilishni boshlaydi: PENDING -> IN_PROGRESS.
  // updateMany + where status:PENDING orqali poyga holati (race condition) serverda oldini olinadi:
  // ikkita xodim bir vaqtda bossa ham faqat birinchisi muvaffaqiyatli band qiladi.
  fastify.post("/api/tasks/:id/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.currentUser!.id;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: "PENDING", ...activeCampaign },
        data: { status: "IN_PROGRESS", assignedToId: userId, calledAt: new Date() },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId, status: "IN_PROGRESS" } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) {
      const existing = await prisma.callTask.findUnique({ where: { id }, include: { campaign: true } });
      if (existing && existing.campaign.status === "ACTIVE" && existing.status !== "PENDING") {
        return reply.code(409).send({ error: "Bu rais allaqachon band qilingan" });
      }
      return explainRejection(id, reply);
    }

    fastify.io.to("dashboard").emit("task:update", task);
    void fastify.notifyGroup(`📞 ${task.assignedTo?.fullName} — "${task.mahalla.name}" MFY raisiga qo'ng'iroq qilmoqda...`);
    return task;
  });

  // Xodim qo'ng'iroq natijasini belgilaydi (faqat o'zi band qilgan vazifaga; boshliq — istalganiga)
  fastify.post("/api/tasks/:id/result", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = resultSchema.parse(request.body);
    const { id: userId, role } = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: {
          id,
          status: { in: RESULT_FROM },
          ...activeCampaign,
          ...(role === "BOSS" ? {} : { assignedToId: userId }),
        },
        data: { status },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId, status } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) {
      const existing = await prisma.callTask.findUnique({ where: { id } });
      if (existing && role !== "BOSS" && existing.assignedToId !== userId) {
        return reply.code(403).send({ error: "Bu vazifa sizga tegishli emas" });
      }
      return explainRejection(id, reply);
    }

    fastify.io.to("dashboard").emit("task:update", task);
    if (task.assignedTo) {
      void fastify.notifyGroup(RESULT_MESSAGE[status](task.assignedTo.fullName, task.mahalla.name));
    }
    return task;
  });

  // Boss vazifani qayta PENDING holatiga qaytaradi (xato bosilgan bo'lsa)
  fastify.post("/api/tasks/:id/reset", { preHandler: requireBoss }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.currentUser!.id;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { not: "PENDING" }, ...activeCampaign },
        data: { status: "PENDING", assignedToId: null, calledAt: null },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId, status: "PENDING" } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) return explainRejection(id, reply);

    fastify.io.to("dashboard").emit("task:update", task);
    void fastify.notifyGroup(`↺ Boshliq "${task.mahalla.name}" MFY vazifasini qayta boshladi.`);
    return task;
  });
}
