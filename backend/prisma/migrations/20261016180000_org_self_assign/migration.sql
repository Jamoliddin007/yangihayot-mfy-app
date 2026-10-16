-- Xodimlar MFY'larni o'zlari tanlab olishi mumkinmi (boshliq yopib qo'yishi mumkin)
ALTER TABLE "Organization" ADD COLUMN "selfAssign" BOOLEAN NOT NULL DEFAULT true;
