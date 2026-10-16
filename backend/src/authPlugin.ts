import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db.js";
import { validateInitData } from "./telegramAuth.js";

// Tizimga kirgan foydalanuvchi (tashkilotdan qat'i nazar)
export interface AuthUser {
  id: string;
  telegramId: bigint;
  fullName: string;
  isPlatformOwner: boolean;
}

// Tashkilot ichidagi joriy foydalanuvchi: barcha ma'lumot so'rovlari shu orgId bilan cheklanadi
export interface CurrentUser extends AuthUser {
  orgId: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
    currentUser?: CurrentUser;
  }
}

// Dev-bypass (Telegram tashqarisida brauzerda test qilish) FAQAT DEV_AUTH=true aniq yoqilganda ishlaydi.
export const DEV_AUTH_ENABLED = process.env.DEV_AUTH === "true";

function parseTelegramId(raw: string | number): bigint | null {
  const str = String(raw);
  return /^\d{1,20}$/.test(str) ? BigInt(str) : null;
}

// HTTP va Socket.io uchun umumiy: initData (yoki dev ID) orqali foydalanuvchini topadi
export async function resolveUser(initData: string | undefined, devTelegramId: string | undefined): Promise<User | null> {
  let telegramId: bigint | null = null;

  if (DEV_AUTH_ENABLED && devTelegramId) {
    telegramId = parseTelegramId(devTelegramId);
  } else if (initData) {
    const validated = validateInitData(initData, process.env.BOT_TOKEN!);
    if (validated) telegramId = parseTelegramId(validated.user.id);
  }

  if (telegramId === null) return null;
  return prisma.user.findUnique({ where: { telegramId } });
}

// Foydalanuvchi shu tashkilotning faol a'zosimi va tashkilot faolmi.
// orgId berilmasa — yagona faol a'zolik avtomatik tanlanadi.
export async function resolveMembership(userId: string, orgId: string | undefined) {
  const memberships = await prisma.membership.findMany({
    where: { userId, isActive: true, org: { status: "ACTIVE" }, ...(orgId ? { orgId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  if (orgId) return memberships[0] ?? null;
  return memberships.length === 1 ? memberships[0]! : null;
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
  if (!user || user.telegramId === null) {
    return reply.code(403).send({ error: "Siz hali ro'yxatdan o'tmagansiz" });
  }

  request.authUser = {
    id: user.id,
    telegramId: user.telegramId,
    fullName: user.fullName,
    isPlatformOwner: user.isPlatformOwner,
  };
}

// authenticate'dan keyin: x-org-id sarlavhasidagi tashkilot a'zoligini tekshiradi
export async function requireMember(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.authUser!;
  const orgHeader = request.headers["x-org-id"];
  const orgId = typeof orgHeader === "string" && orgHeader ? orgHeader : undefined;

  const membership = await resolveMembership(auth.id, orgId);
  if (!membership && !orgId) {
    const count = await prisma.membership.count({ where: { userId: auth.id, isActive: true, org: { status: "ACTIVE" } } });
    if (count > 1) return reply.code(400).send({ error: "Tashkilotni tanlang" });
  }
  if (!membership) {
    return reply.code(403).send({ error: "Siz bu tashkilot a'zosi emassiz yoki tashkilot faol emas" });
  }
  request.currentUser = { ...auth, orgId: membership.orgId, role: membership.role };
}

export async function requireBoss(request: FastifyRequest, reply: FastifyReply) {
  if (request.currentUser?.role !== "BOSS") {
    return reply.code(403).send({ error: "Faqat boshliq uchun ruxsat etilgan" });
  }
}
