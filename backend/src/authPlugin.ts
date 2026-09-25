import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import { validateInitData } from "./telegramAuth.js";

export interface CurrentUser {
  id: string;
  telegramId: bigint;
  fullName: string;
  role: "BOSS" | "EMPLOYEE";
}

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUser;
  }
}

const isDev = process.env.NODE_ENV !== "production";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  // FAQAT development muhitida: Telegram tashqarisida (brauzerda) test qilish uchun.
  // Production serverda NODE_ENV=production o'rnatilgani sababli bu yo'l umuman ishlamaydi.
  const devTelegramId = request.headers["x-dev-telegram-id"];
  if (isDev && typeof devTelegramId === "string") {
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(devTelegramId) } });
    if (!user || !user.isActive) {
      return reply.code(403).send({ error: "Dev foydalanuvchi topilmadi" });
    }
    request.currentUser = { id: user.id, telegramId: user.telegramId!, fullName: user.fullName, role: user.role };
    return;
  }

  const authHeader = request.headers["authorization"];
  const initData = authHeader?.startsWith("tma ") ? authHeader.slice(4) : undefined;

  if (!initData) {
    return reply.code(401).send({ error: "initData yo'q" });
  }

  const validated = validateInitData(initData, process.env.BOT_TOKEN!);
  if (!validated) {
    return reply.code(401).send({ error: "initData noto'g'ri" });
  }

  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(validated.user.id) } });
  if (!user || !user.isActive) {
    return reply.code(403).send({ error: "Ruxsat berilmagan foydalanuvchi" });
  }

  request.currentUser = {
    id: user.id,
    telegramId: user.telegramId!,
    fullName: user.fullName,
    role: user.role,
  };
}

export async function requireBoss(request: FastifyRequest, reply: FastifyReply) {
  if (request.currentUser?.role !== "BOSS") {
    return reply.code(403).send({ error: "Faqat boshliq uchun ruxsat etilgan" });
  }
}
