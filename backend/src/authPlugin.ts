import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
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

// Dev-bypass (Telegram tashqarisida brauzerda test qilish) FAQAT DEV_AUTH=true aniq yoqilganda ishlaydi.
// Avval NODE_ENV'ga bog'langan edi — NODE_ENV o'rnatilmasa (ngrok orqali ochiq server) har kim
// boshliqning Telegram ID'sini header'ga yozib kira olardi. Endi standart holatda o'chiq.
export const DEV_AUTH_ENABLED = process.env.DEV_AUTH === "true";

function parseTelegramId(raw: string | number): bigint | null {
  const str = String(raw);
  return /^\d{1,20}$/.test(str) ? BigInt(str) : null;
}

// HTTP va Socket.io uchun umumiy: initData yoki dev ID orqali faol foydalanuvchini topadi
export async function resolveUser(initData: string | undefined, devTelegramId: string | undefined): Promise<User | null> {
  let telegramId: bigint | null = null;

  if (DEV_AUTH_ENABLED && devTelegramId) {
    telegramId = parseTelegramId(devTelegramId);
  } else if (initData) {
    const validated = validateInitData(initData, process.env.BOT_TOKEN!);
    if (validated) telegramId = parseTelegramId(validated.user.id);
  }

  if (telegramId === null) return null;
  const user = await prisma.user.findUnique({ where: { telegramId } });
  return user && user.isActive ? user : null;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers["authorization"];
  const initData = authHeader?.startsWith("tma ") ? authHeader.slice(4) : undefined;
  const devHeader = request.headers["x-dev-telegram-id"];
  const devTelegramId = typeof devHeader === "string" ? devHeader : undefined;

  if (!initData && !(DEV_AUTH_ENABLED && devTelegramId)) {
    return reply.code(401).send({ error: "Avtorizatsiya ma'lumoti yo'q" });
  }

  const user = await resolveUser(initData, devTelegramId);
  if (!user) {
    return reply.code(403).send({ error: "Ruxsat berilmagan foydalanuvchi" });
  }

  request.currentUser = { id: user.id, telegramId: user.telegramId!, fullName: user.fullName, role: user.role };
}

export async function requireBoss(request: FastifyRequest, reply: FastifyReply) {
  if (request.currentUser?.role !== "BOSS") {
    return reply.code(403).send({ error: "Faqat boshliq uchun ruxsat etilgan" });
  }
}
