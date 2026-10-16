-- Ko'p tashkilotli (multi-tenant) tuzilmaga o'tish.
-- Qo'lda yozilgan: avval yangi jadvallar, keyin MAVJUD MA'LUMOTLARNI KO'CHIRISH, eng oxirida eski ustunlarni o'chirish.
-- Bo'sh bazada (yangi o'rnatish) ham, ma'lumotli bazada ham ishlaydi.

-- 1. Yangi turlar va jadvallar ------------------------------------------------

CREATE TYPE "OrgStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "CampaignKind" AS ENUM ('MEETING', 'EVENT', 'OTHER');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'PENDING',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "groupChatId" TEXT,
    "requestedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "userId" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- 2. Mavjud ma'lumotlarni birinchi tashkilotga ko'chirish ---------------------

-- Ma'lumot bo'lsagina tashkilot yaratiladi (yangi o'rnatishda — hech narsa)
INSERT INTO "Organization" ("id", "name", "status", "approvedAt")
SELECT 'org_initial', 'Yangihayot tumani MFY uyushmasi', 'ACTIVE', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User") OR EXISTS (SELECT 1 FROM "Mahalla");

-- Har bir foydalanuvchi o'z roli bilan shu tashkilot a'zosi bo'ladi
INSERT INTO "Membership" ("id", "orgId", "userId", "role", "isActive", "createdAt")
SELECT 'mem_' || "id", 'org_initial', "id", "role", "isActive", "createdAt" FROM "User";

-- Hali ulanmagan xodimlarning yuborilgan taklif havolalari ishlashda davom etadi
INSERT INTO "Invite" ("id", "code", "orgId", "role", "userId")
SELECT 'inv_' || "id", "inviteCode", 'org_initial', "role", "id"
FROM "User" WHERE "inviteCode" IS NOT NULL AND "telegramId" IS NULL;

ALTER TABLE "User" ADD COLUMN "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN "username" TEXT;

-- Mavjud boshliq — platforma egasi (yangi tashkilotlarni u tasdiqlaydi)
UPDATE "User" SET "isPlatformOwner" = true WHERE "role" = 'BOSS' AND "telegramId" IS NOT NULL;

ALTER TABLE "Mahalla" ADD COLUMN "orgId" TEXT,
                      ADD COLUMN "assignedToId" TEXT,
                      ADD COLUMN "sector" INTEGER;
UPDATE "Mahalla" SET "orgId" = 'org_initial';
ALTER TABLE "Mahalla" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "CallCampaign" ADD COLUMN "orgId" TEXT,
                           ADD COLUMN "kind" "CampaignKind" NOT NULL DEFAULT 'OTHER',
                           ADD COLUMN "scheduledAt" TIMESTAMP(3),
                           ADD COLUMN "location" TEXT,
                           ADD COLUMN "closedAt" TIMESTAMP(3);
UPDATE "CallCampaign" SET "orgId" = 'org_initial';
ALTER TABLE "CallCampaign" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "CallTask" ADD COLUMN "calledById" TEXT,
                       ADD COLUMN "note" TEXT;
-- Eski tizimda vazifani band qilgan xodimning o'zi qo'ng'iroq qilgan
UPDATE "CallTask" SET "calledById" = "assignedToId" WHERE "status" <> 'PENDING';

ALTER TABLE "CallEvent" ADD COLUMN "note" TEXT;

-- 3. Eski ustunlar (ma'lumot ko'chirilgandan keyin) ---------------------------

DROP INDEX "User_inviteCode_key";
ALTER TABLE "User" DROP COLUMN "inviteCode",
                   DROP COLUMN "isActive",
                   DROP COLUMN "linkedAt",
                   DROP COLUMN "role";

-- 4. Indekslar va bog'lanishlar -----------------------------------------------

CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");
CREATE INDEX "Mahalla_orgId_isActive_idx" ON "Mahalla"("orgId", "isActive");
CREATE INDEX "Mahalla_assignedToId_idx" ON "Mahalla"("assignedToId");
CREATE INDEX "CallCampaign_orgId_status_idx" ON "CallCampaign"("orgId", "status");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Mahalla" ADD CONSTRAINT "Mahalla_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mahalla" ADD CONSTRAINT "Mahalla_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallCampaign" ADD CONSTRAINT "CallCampaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallTask" ADD CONSTRAINT "CallTask_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
