// Lokal sinov: takliflar va tashkilot so'rovlari mantiqi (orgService) — haqiqiy bazada.
// Ishga tushirish: npx tsx scripts/smoke-invites.ts   (FAQAT lokal/test bazada!)
import assert from "node:assert/strict";
import { prisma } from "../src/db.js";
import { DomainError, acceptInvite, createInvite, decideOrganization, requestOrganization } from "../src/orgService.js";

const ORG = "org_initial";

async function expectDomainError(fn: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(fn, (err) => err instanceof DomainError && pattern.test(err.message));
}

async function main() {
  const owner = await prisma.user.findFirstOrThrow({ where: { isPlatformOwner: true } });

  // 1. Boshliq taklifi: yangi odam Telegram ismi bilan boshliq bo'ladi; havola bir martalik
  const bossInvite = await createInvite(ORG, "BOSS", owner.id);
  const boss = await acceptInvite(bossInvite.code, { id: 3001, first_name: "Ulug'bek", last_name: "Test", username: "ulugbek" });
  assert.equal(boss.role, "BOSS");
  assert.equal(boss.user.fullName, "Ulug'bek Test");
  await expectDomainError(() => acceptInvite(bossInvite.code, { id: 3002, first_name: "Boshqa" }), /allaqachon ishlatilgan/);
  console.log("✓ boshliq taklifi va bir martalik havola");

  // 2. Oldindan qo'shilgan xodim (Ramazon) o'rnini egallash: MFY'lari saqlanadi, ism boshliq yozgandek qoladi
  const ramazonInvite = await prisma.invite.findFirstOrThrow({ where: { user: { fullName: "Raxmonberdiyev Ramazon" } } });
  const ramazon = await acceptInvite(ramazonInvite.code, { id: 1001, first_name: "Ramazon" });
  assert.equal(ramazon.user.fullName, "Raxmonberdiyev Ramazon");
  assert.equal(await prisma.mahalla.count({ where: { assignedToId: ramazon.user.id } }), 10);
  console.log("✓ o'rinbosarni egallash (10 ta MFY saqlandi)");

  // 3. Yangi tashkilot so'rovi → platforma egasi tasdiqlaydi → so'rovchi boshliq
  const req = await requestOrganization({ id: 4001, first_name: "Chilonzor", last_name: "Boshliq" }, "Chilonzor tumani MFY uyushmasi");
  assert.equal(req.autoApproved, false);
  assert.equal(req.org.status, "PENDING");
  await expectDomainError(() => requestOrganization({ id: 4001, first_name: "Chilonzor" }, "Yana bir"), /ko'rib chiqilmoqda/);
  await decideOrganization(req.org.id, true);
  const chilonzorBoss = await prisma.membership.findFirstOrThrow({ where: { orgId: req.org.id } });
  assert.equal(chilonzorBoss.role, "BOSS");
  await expectDomainError(() => decideOrganization(req.org.id, false), /allaqachon/);
  console.log("✓ tashkilot so'rovi va tasdiqlash");

  // 4. Birlashtirish: Chilonzor xodimi bo'lgan odam Yangihayot'dagi o'rinbosarni (Diyorbek) egallaydi
  const chilonzorEmpInvite = await createInvite(req.org.id, "EMPLOYEE", chilonzorBoss.userId);
  const crossUser = await acceptInvite(chilonzorEmpInvite.code, { id: 2002, first_name: "Diyorbek" });
  const diyorInvite = await prisma.invite.findFirstOrThrow({ where: { user: { fullName: "Tobilov Diyorbek" } } });
  const placeholderId = diyorInvite.userId!;
  const merged = await acceptInvite(diyorInvite.code, { id: 2002, first_name: "Diyorbek" });
  assert.equal(merged.user.id, crossUser.user.id);
  assert.equal(await prisma.user.count({ where: { id: placeholderId } }), 0);
  assert.equal(await prisma.mahalla.count({ where: { assignedToId: crossUser.user.id } }), 10);
  assert.equal(await prisma.membership.count({ where: { userId: crossUser.user.id } }), 2);
  console.log("✓ ikki tashkilotda a'zo bo'lgan odam — akkauntlar birlashtirildi, MFY'lar saqlandi");

  // 5. Muddati o'tgan va bekor qilingan havolalar
  const expired = await createInvite(ORG, "EMPLOYEE", owner.id);
  await prisma.invite.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await expectDomainError(() => acceptInvite(expired.code, { id: 5001, first_name: "X" }), /muddati o'tgan/);
  const revoked = await createInvite(ORG, "EMPLOYEE", owner.id);
  await prisma.invite.update({ where: { id: revoked.id }, data: { revokedAt: new Date() } });
  await expectDomainError(() => acceptInvite(revoked.code, { id: 5001, first_name: "X" }), /bekor qilingan/);
  await expectDomainError(() => acceptInvite("yoq-kod", { id: 5001, first_name: "X" }), /noto'g'ri/);
  console.log("✓ muddati o'tgan / bekor qilingan / noto'g'ri havola rad etiladi");

  // 6. To'xtatilgan tashkilotga qo'shilib bo'lmaydi
  const sus = await createInvite(req.org.id, "EMPLOYEE", chilonzorBoss.userId);
  await prisma.organization.update({ where: { id: req.org.id }, data: { status: "SUSPENDED" } });
  await expectDomainError(() => acceptInvite(sus.code, { id: 5002, first_name: "Y" }), /faol emas/);
  await prisma.organization.update({ where: { id: req.org.id }, data: { status: "ACTIVE" } });
  console.log("✓ to'xtatilgan tashkilot");

  console.log("\nHAMMASI O'TDI");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
