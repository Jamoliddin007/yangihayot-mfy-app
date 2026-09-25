import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { authenticate } from "../authPlugin.js";

const taskInclude = {
  mahalla: true,
  assignedTo: { select: { id: true, fullName: true } },
} as const;

const resultSchema = z.object({
  status: z.enum(["REACHED", "NO_ANSWER", "PHONE_OFF"]),
});

const RESULT_MESSAGE: Record<"REACHED" | "NO_ANSWER" | "PHONE_OFF", (employee: string, mahalla: string) => string> = {
  REACHED: (employee, mahalla) => `✅ ${employee} — "${mahalla}" MFY bilan bog'landi.`,
  NO_ANSWER: (employee, mahalla) => `📵 ${employee} — "${mahalla}" MFY raisi qo'ng'iroqni ko'tarmadi.`,
  PHONE_OFF: (employee, mahalla) => `⚠️ ${employee} — "${mahalla}" MFY raisining telefoni o'chiq.`,
};

export async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Xodim qo'ng'iroq qilishni boshlaydi: PENDING -> IN_PROGRESS.
  // updateMany + where status:PENDING orqali poyga holati (race condition) serverda oldini olinadi:
  // ikkita xodim bir vaqtda bossa ham faqat birinchisi muvaffaqiyatli band qiladi.
  fastify.post("/api/tasks/:id/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.currentUser!.id;

    const result = await prisma.callTask.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "IN_PROGRESS", assignedToId: userId, calledAt: new Date() },
    });

    if (result.count === 0) {
      return reply.code(409).send({ error: "Bu rais allaqachon band qilingan" });
    }

    const task = await prisma.callTask.update({
      where: { id },
      data: {},
      include: taskInclude,
    });

    await prisma.callEvent.create({ data: { callTaskId: id, userId, status: "IN_PROGRESS" } });

    fastify.io.to("dashboard").emit("task:update", task);
    void fastify.notifyGroup(`📞 ${task.assignedTo?.fullName} — "${task.mahalla.name}" MFY raisiga qo'ng'iroq qilmoqda...`);
    return task;
  });

  // Xodim qo'ng'iroq natijasini belgilaydi
  fastify.post("/api/tasks/:id/result", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = resultSchema.parse(request.body);
    const userId = request.currentUser!.id;

    const existing = await prisma.callTask.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: "Vazifa topilmadi" });
    }
    if (existing.assignedToId !== userId && request.currentUser!.role !== "BOSS") {
      return reply.code(403).send({ error: "Bu vazifa sizga tegishli emas" });
    }

    const task = await prisma.callTask.update({
      where: { id },
      data: { status },
      include: taskInclude,
    });

    await prisma.callEvent.create({ data: { callTaskId: id, userId, status } });

    fastify.io.to("dashboard").emit("task:update", task);
    if (task.assignedTo) {
      void fastify.notifyGroup(RESULT_MESSAGE[status](task.assignedTo.fullName, task.mahalla.name));
    }
    return task;
  });

  // Boss vazifani qayta PENDING holatiga qaytaradi (xato bosilgan bo'lsa)
  fastify.post("/api/tasks/:id/reset", async (request, reply) => {
    if (request.currentUser?.role !== "BOSS") {
      return reply.code(403).send({ error: "Faqat boshliq uchun ruxsat etilgan" });
    }
    const { id } = request.params as { id: string };
    const task = await prisma.callTask.update({
      where: { id },
      data: { status: "PENDING", assignedToId: null, calledAt: null },
      include: taskInclude,
    });
    fastify.io.to("dashboard").emit("task:update", task);
    return task;
  });
}
