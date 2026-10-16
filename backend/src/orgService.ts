import crypto from "node:crypto";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./db.js";

// Tashkilot, a'zolik va takliflar bo'yicha biznes-mantiq. Bot ham, HTTP API ham shu yerdan foydalanadi.

export const INVITE_TTL_DAYS = 14;

// Platforma egasi (admin) — faqat .env'dagi bitta Telegram akkaunt. Bazadagi belgi har ishga tushishda
// shu qiymatga moslanadi: boshqa hech kim (ro'yxatdan o'tgan boshliq ham) egasi bo'lib qola olmaydi.
const ownerEnv = process.env.PLATFORM_OWNER_TELEGRAM_ID?.trim();
export const PLATFORM_OWNER_TELEGRAM_ID = ownerEnv && /^\d+$/.test(ownerEnv) ? BigInt(ownerEnv) : null;

export async function syncPlatformOwner() {
  if (PLATFORM_OWNER_TELEGRAM_ID === null) return { configured: false as const };
  await prisma.user.updateMany({ where: { isPlatformOwner: true, telegramId: { not: PLATFORM_OWNER_TELEGRAM_ID } }, data: { isPlatformOwner: false } });
  await prisma.user.updateMany({ where: { telegramId: PLATFORM_OWNER_TELEGRAM_ID }, data: { isPlatformOwner: true } });
  return { configured: true as const };
}

export interface TelegramProfile {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export const profileName = (p: TelegramProfile) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Foydalanuvchi";

export function newInviteCode() {
  // Telegram start parametri: A-Z a-z 0-9 _ - , 64 belgigacha
  return crypto.randomBytes(12).toString("base64url");
}

export function inviteLink(code: string) {
  return `https://t.me/${process.env.BOT_USERNAME}?start=${code}`;
}

export class DomainError extends Error {}

// Telegram foydalanuvchisini bazada topadi yoki yaratadi (ism Telegram'dan, keyin tahrirlanadi)
export async function upsertTelegramUser(profile: TelegramProfile, tx: Prisma.TransactionClient = prisma) {
  const telegramId = BigInt(profile.id);
  const existing = await tx.user.findUnique({ where: { telegramId } });
  if (existing) {
    if (existing.username !== (profile.username ?? null)) {
      return tx.user.update({ where: { id: existing.id }, data: { username: profile.username ?? null } });
    }
    return existing;
  }
  return tx.user.create({
    data: { telegramId, fullName: profileName(profile), username: profile.username ?? null, isPlatformOwner: telegramId === PLATFORM_OWNER_TELEGRAM_ID },
  });
}

export async function createInvite(
  orgId: string,
  role: Role,
  createdById: string,
  placeholderUserId?: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.invite.create({
    data: {
      code: newInviteCode(),
      orgId,
      role,
      userId: placeholderUserId,
      createdById,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
}

// O'rinbosar (oldindan qo'shilgan) foydalanuvchining barcha izlarini haqiqiy foydalanuvchiga ko'chiradi
async function mergeUser(tx: Prisma.TransactionClient, fromId: string, toId: string) {
  await tx.membership.updateMany({ where: { userId: fromId }, data: { userId: toId } });
  await tx.mahalla.updateMany({ where: { assignedToId: fromId }, data: { assignedToId: toId } });
  await tx.callTask.updateMany({ where: { assignedToId: fromId }, data: { assignedToId: toId } });
  await tx.callTask.updateMany({ where: { calledById: fromId }, data: { calledById: toId } });
  await tx.callEvent.updateMany({ where: { userId: fromId }, data: { userId: toId } });
  await tx.callCampaign.updateMany({ where: { createdById: fromId }, data: { createdById: toId } });
  await tx.invite.updateMany({ where: { userId: fromId }, data: { userId: null } });
  await tx.user.delete({ where: { id: fromId } });
}

// Taklif havolasini qabul qilish. Natija: qaysi tashkilotga, qaysi rolda qo'shildi.
export async function acceptInvite(code: string, profile: TelegramProfile) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { code }, include: { org: true } });
    if (!invite || invite.revokedAt) throw new DomainError("Taklif havolasi noto'g'ri yoki bekor qilingan.");
    if (invite.usedAt) throw new DomainError("Bu taklif havolasi allaqachon ishlatilgan. Boshliqdan yangisini so'rang.");
    if (invite.expiresAt && invite.expiresAt < new Date()) throw new DomainError("Taklif havolasining muddati o'tgan. Boshliqdan yangisini so'rang.");
    if (invite.org.status !== "ACTIVE") throw new DomainError("Bu tashkilot hozir faol emas.");

    const telegramId = BigInt(profile.id);
    const existing = await tx.user.findUnique({ where: { telegramId } });
    let userId: string;

    if (invite.userId) {
      // Boshliq oldindan qo'shgan o'rin (MFY'lar unga biriktirilgan bo'lishi mumkin)
      const placeholder = await tx.user.findUniqueOrThrow({ where: { id: invite.userId } });
      if (placeholder.telegramId !== null && placeholder.telegramId !== telegramId) {
        throw new DomainError("Bu o'rin boshqa Telegram hisobiga ulangan. Boshliqdan yangi havola so'rang.");
      }
      if (existing && existing.id !== placeholder.id) {
        const alreadyMember = await tx.membership.findUnique({ where: { orgId_userId: { orgId: invite.orgId, userId: existing.id } } });
        if (alreadyMember) throw new DomainError("Siz bu tashkilotda allaqachon a'zosiz.");
        await mergeUser(tx, placeholder.id, existing.id);
        userId = existing.id;
      } else {
        await tx.user.update({ where: { id: placeholder.id }, data: { telegramId, username: profile.username ?? null } });
        userId = placeholder.id;
      }
      await tx.membership.upsert({
        where: { orgId_userId: { orgId: invite.orgId, userId } },
        create: { orgId: invite.orgId, userId, role: invite.role },
        update: { role: invite.role, isActive: true },
      });
    } else {
      const user = existing ?? (await upsertTelegramUser(profile, tx));
      userId = user.id;
      const membership = await tx.membership.findUnique({ where: { orgId_userId: { orgId: invite.orgId, userId } } });
      if (membership?.isActive) throw new DomainError("Siz bu tashkilotda allaqachon a'zosiz.");
      await tx.membership.upsert({
        where: { orgId_userId: { orgId: invite.orgId, userId } },
        create: { orgId: invite.orgId, userId, role: invite.role },
        update: { role: invite.role, isActive: true },
      });
    }

    await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { user, org: invite.org, role: invite.role };
  });
}

// Yangi tashkilot so'rovi. Platformada hali egasi bo'lmasa (yangi o'rnatish) — so'rovchi egasi bo'ladi
// va tashkilot darhol faollashadi; aks holda platforma egasi tasdiqlashini kutadi.
// Boshliqning ro'yxatdan o'tish so'rovi. Telefon — platforma egasi u bilan shartnoma bo'yicha bog'lanishi uchun
export async function requestOrganization(profile: TelegramProfile, name: string, phone?: string) {
  return prisma.$transaction(async (tx) => {
    let user = await upsertTelegramUser(profile, tx);
    if (phone) user = await tx.user.update({ where: { id: user.id }, data: { phone } });
    const pending = await tx.organization.findFirst({ where: { requestedById: user.id, status: "PENDING" } });
    if (pending) throw new DomainError(`Sizning "${pending.name}" so'rovingiz hali ko'rib chiqilmoqda.`);

    // Platforma egasining o'z tashkiloti tasdiqsiz ochiladi; qolganlar egasining tasdig'ini kutadi
    if (user.isPlatformOwner) {
      const org = await tx.organization.create({
        data: { name, status: "ACTIVE", approvedAt: new Date(), requestedById: user.id },
      });
      await tx.membership.create({ data: { orgId: org.id, userId: user.id, role: "BOSS" } });
      return { org, user, autoApproved: true as const };
    }

    const org = await tx.organization.create({ data: { name, requestedById: user.id } });
    return { org, user, autoApproved: false as const };
  });
}

export async function decideOrganization(orgId: string, approve: boolean) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: orgId }, include: { requestedBy: true } });
    if (!org) throw new DomainError("Tashkilot topilmadi.");
    if (org.status !== "PENDING") throw new DomainError(`Bu so'rov allaqachon ko'rib chiqilgan (${org.status}).`);

    if (!approve) {
      const rejected = await tx.organization.update({ where: { id: orgId }, data: { status: "REJECTED" } });
      return { org: rejected, requester: org.requestedBy };
    }
    const approved = await tx.organization.update({ where: { id: orgId }, data: { status: "ACTIVE", approvedAt: new Date() } });
    if (org.requestedById) {
      await tx.membership.upsert({
        where: { orgId_userId: { orgId, userId: org.requestedById } },
        create: { orgId, userId: org.requestedById, role: "BOSS" },
        update: { role: "BOSS", isActive: true },
      });
    }
    return { org: approved, requester: org.requestedBy };
  });
}

// Faol boshliqlar soni — oxirgi boshliqni xodimga tushirib yoki o'chirib bo'lmaydi
export function activeBossCount(orgId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.membership.count({ where: { orgId, role: "BOSS", isActive: true } });
}
