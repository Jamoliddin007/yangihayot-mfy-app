import type { FastifyInstance, FastifyReply } from "fastify";
import type { CallStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireBoss, type CurrentUser } from "../authPlugin.js";
import { orgScoped } from "./scope.js";
import { taskInclude } from "../taskInclude.js";
import { resultMessage } from "../messages.js";

// help: xodim boshqa xodimning MFY'siga ataylab yordam beryapti (ilovada tasdiqlagan)
const actionSchema = z.object({ help: z.boolean().optional() }).default({});

const resultSchema = z.object({
  status: z.enum(["REACHED", "NO_ANSWER", "PHONE_OFF"]),
  note: z.string().trim().max(300).optional(),
  help: z.boolean().optional(),
});

const noteSchema = z.object({ note: z.string().trim().max(300) });

// REACHED — yakuniy holat (xato bo'lsa boshliq "Natijani bekor qilish" bilan qaytaradi)
const OPEN_STATUSES: CallStatus[] = ["PENDING", "IN_PROGRESS", "NO_ANSWER", "PHONE_OFF"];

// Kim o'zgartira oladi: boshliq — hammasini; xodim — o'ziga biriktirilganini, yoki help=true bo'lsa
// boshqanikini ham (yordam). Faqat o'z tashkilotining faol topshirig'idagi vazifalar.
function editableBy(user: CurrentUser, help: boolean | undefined): Prisma.CallTaskWhereInput {
  return {
    campaign: { orgId: user.orgId, status: "ACTIVE" },
    ...(user.role === "BOSS" || help ? {} : { assignedToId: user.id }),
  };
}

async function explainRejection(id: string, user: CurrentUser, reply: FastifyReply) {
  const task = await prisma.callTask.findFirst({ where: { id, campaign: { orgId: user.orgId } }, include: { campaign: true } });
  if (!task) return reply.code(404).send({ error: "Vazifa topilmadi" });
  if (task.campaign.status !== "ACTIVE") return reply.code(409).send({ error: "Bu topshiriq yakunlangan" });
  if (task.status === "REACHED") return reply.code(409).send({ error: "Bu MFY bilan allaqachon bog'lanilgan" });
  if (user.role !== "BOSS" && task.assignedToId !== user.id) {
    return reply.code(403).send({ error: "Bu MFY sizga biriktirilmagan" });
  }
  return reply.code(409).send({ error: "Holat o'zgargan, sahifani yangilang" });
}

export async function taskRoutes(fastify: FastifyInstance) {
  orgScoped(fastify);

  // Qo'ng'iroq boshlandi — boshqalar kim hozir gaplashayotganini ko'radi
  fastify.post("/api/tasks/:id/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { help } = actionSchema.parse(request.body ?? {});
    const user = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { in: ["PENDING", "NO_ANSWER", "PHONE_OFF"] }, ...editableBy(user, help) },
        data: { status: "IN_PROGRESS", calledAt: new Date(), calledById: user.id },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId: user.id, status: "IN_PROGRESS" } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) {
      // Qayta bosish (allaqachon IN_PROGRESS) — xato emas, joriy holatni qaytaramiz
      const current = await prisma.callTask.findFirst({ where: { id, status: "IN_PROGRESS", ...editableBy(user, help) }, include: taskInclude });
      if (current) return current;
      return explainRejection(id, user, reply);
    }

    fastify.emitToOrg(user.orgId, "task:update", task);
    return task;
  });

  // Natija (+ ixtiyoriy izoh): guruhga xabar ketadi
  fastify.post("/api/tasks/:id/result", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, note, help } = resultSchema.parse(request.body);
    const user = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { in: OPEN_STATUSES }, ...editableBy(user, help) },
        data: { status, calledAt: new Date(), calledById: user.id, note: note || null },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId: user.id, status, note: note || null } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) return explainRejection(id, user, reply);
    fastify.emitToOrg(user.orgId, "task:update", task);

    const [reached, total, org] = await Promise.all([
      prisma.callTask.count({ where: { campaignId: task.campaignId, status: "REACHED" } }),
      prisma.callTask.count({ where: { campaignId: task.campaignId } }),
      prisma.organization.findUniqueOrThrow({ where: { id: user.orgId } }),
    ]);
    void fastify.notifyGroup(
      user.orgId,
      resultMessage({
        status,
        mahallaName: task.mahalla.name,
        chairmanName: task.mahalla.chairmanName,
        callerName: user.fullName,
        assigneeName: task.assignedTo?.fullName,
        note: task.note,
        reached,
        total,
        at: new Date(),
        timeZone: org.timezone,
      }),
    );
    return task;
  });

  // Izohni keyin qo'shish/tahrirlash (natijani o'zgartirmasdan). Faqat mas'ul, qo'ng'iroq qilgan yoki boshliq.
  fastify.post("/api/tasks/:id/note", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { note } = noteSchema.parse(request.body);
    const user = request.currentUser!;

    const { count } = await prisma.callTask.updateMany({
      where: {
        id,
        campaign: { orgId: user.orgId, status: "ACTIVE" },
        ...(user.role === "BOSS" ? {} : { OR: [{ assignedToId: user.id }, { calledById: user.id }] }),
      },
      data: { note: note || null },
    });
    if (count === 0) return explainRejection(id, user, reply);

    const task = await prisma.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    fastify.emitToOrg(user.orgId, "task:update", task);
    return task;
  });

  // Boshliq natijani bekor qiladi (xato belgilangan bo'lsa). Mas'ul xodim o'zgarmaydi.
  fastify.post("/api/tasks/:id/reset", { preHandler: requireBoss }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.currentUser!;

    const task = await prisma.$transaction(async (tx) => {
      const { count } = await tx.callTask.updateMany({
        where: { id, status: { not: "PENDING" }, campaign: { orgId: user.orgId, status: "ACTIVE" } },
        data: { status: "PENDING", calledAt: null, calledById: null, note: null },
      });
      if (count === 0) return null;
      await tx.callEvent.create({ data: { callTaskId: id, userId: user.id, status: "PENDING" } });
      return tx.callTask.findUniqueOrThrow({ where: { id }, include: taskInclude });
    });

    if (!task) return explainRejection(id, user, reply);
    fastify.emitToOrg(user.orgId, "task:update", task);
    return task;
  });
}
