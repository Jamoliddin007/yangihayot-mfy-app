import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "../db.js";
import { requireBoss } from "../authPlugin.js";
import { orgScoped } from "./scope.js";
import { reassignOpenTasks } from "../assignment.js";

const mahallaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  chairmanName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(60),
  sector: z.number().int().min(1).max(999).nullable().optional(),
  assignedToId: z.string().min(1).nullable().optional(),
});

const idsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) });

const mahallaInclude = { assignedTo: { select: { id: true, fullName: true } } } as const;

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

// Mas'ul faqat shu tashkilotning faol a'zosi bo'lishi mumkin (boshqa tuman xodimi emas)
async function assertMember(orgId: string, userId: string | null | undefined, reply: FastifyReply) {
  if (!userId) return true;
  const member = await prisma.membership.findFirst({ where: { orgId, userId, isActive: true } });
  if (!member) {
    reply.code(400).send({ error: "Xodim topilmadi yoki faol emas" });
    return false;
  }
  return true;
}

export async function mahallaRoutes(fastify: FastifyInstance) {
  orgScoped(fastify);

  fastify.get("/api/mahalla", async (request) => {
    return prisma.mahalla.findMany({
      where: { orgId: request.currentUser!.orgId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: mahallaInclude,
    });
  });

  fastify.post("/api/mahalla", { preHandler: requireBoss }, async (request, reply) => {
    const { orgId } = request.currentUser!;
    const body = mahallaSchema.parse(request.body);
    if (!(await assertMember(orgId, body.assignedToId, reply))) return;

    const maxOrder = await prisma.mahalla.aggregate({ where: { orgId }, _max: { sortOrder: true } });
    const mahalla = await prisma.mahalla.create({
      data: { ...body, orgId, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
      include: mahallaInclude,
    });
    fastify.emitToOrg(orgId, "mahalla:changed");
    return reply.code(201).send(mahalla);
  });

  fastify.put("/api/mahalla/:id", { preHandler: requireBoss }, async (request, reply) => {
    const { orgId } = request.currentUser!;
    const { id } = request.params as { id: string };
    const body = mahallaSchema.partial().parse(request.body);
    if (!(await assertMember(orgId, body.assignedToId, reply))) return;

    const existing = await prisma.mahalla.findFirst({ where: { id, orgId } });
    if (!existing) return reply.code(404).send({ error: "MFY topilmadi" });

    const mahalla = await prisma.$transaction(async (tx) => {
      const updated = await tx.mahalla.update({ where: { id }, data: body, include: mahallaInclude });
      // Mas'ul o'zgarsa, joriy topshiriqdagi hali bog'lanilmagan vazifa ham yangi xodimga o'tadi
      if (body.assignedToId !== undefined) await reassignOpenTasks(tx, orgId, { mahallaId: id }, body.assignedToId);
      return updated;
    });

    fastify.emitToOrg(orgId, "mahalla:changed");
    if (body.assignedToId !== undefined) fastify.emitToOrg(orgId, "campaign:changed");
    return mahalla;
  });

  fastify.delete("/api/mahalla/:id", { preHandler: requireBoss }, async (request, reply) => {
    const { orgId } = request.currentUser!;
    const { id } = request.params as { id: string };
    const { count } = await prisma.mahalla.updateMany({ where: { id, orgId }, data: { isActive: false } });
    if (count === 0) return reply.code(404).send({ error: "MFY topilmadi" });
    fastify.emitToOrg(orgId, "mahalla:changed");
    return { ok: true };
  });

  // Excel import (1-qator sarlavha): 1 MFY nomi, 2 rais F.I.Sh, 3 telefon, 4 mas'ul xodim ismi (ixtiyoriy),
  // 5 sektor raqami (ixtiyoriy). Bor MFY qayta yaratilmaydi — rais, telefon, mas'ul va sektori yangilanadi.
  fastify.post("/api/mahalla/import", { preHandler: requireBoss }, async (request, reply) => {
    const { orgId } = request.currentUser!;
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "Fayl topilmadi" });
    // ExcelJS faqat .xlsx formatini o'qiydi (eski .xls emas)
    if (!file.filename.toLowerCase().endsWith(".xlsx")) {
      return reply.code(400).send({ error: "Faqat .xlsx formatidagi fayl qabul qilinadi" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await file.toBuffer()) as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return reply.code(400).send({ error: "Sahifa topilmadi" });

    const rows: { name: string; chairmanName: string; phone: string; employee: string; sector: number | null }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // sarlavha qatori
      const cell = (i: number) => row.getCell(i).text?.trim() ?? "";
      const sector = Number.parseInt(cell(5), 10);
      if (cell(1) && cell(2) && cell(3)) {
        rows.push({ name: cell(1), chairmanName: cell(2), phone: cell(3), employee: cell(4), sector: Number.isFinite(sector) ? sector : null });
      }
    });
    if (rows.length === 0) {
      return reply.code(400).send({ error: "Fayl bo'sh yoki format noto'g'ri (1-ustun MFY, 2-ustun F.I.Sh, 3-ustun telefon)" });
    }

    const members = await prisma.membership.findMany({ where: { orgId, isActive: true }, include: { user: true } });
    const memberByName = new Map(members.map((m) => [normalize(m.user.fullName), m.userId]));
    const existing = await prisma.mahalla.findMany({ where: { orgId, isActive: true } });
    const existingByName = new Map(existing.map((m) => [normalize(m.name), m]));
    const maxOrder = await prisma.mahalla.aggregate({ where: { orgId }, _max: { sortOrder: true } });

    let order = maxOrder._max.sortOrder ?? 0;
    let created = 0;
    let updated = 0;
    const unknownEmployees = new Set<string>();
    const seen = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const key = normalize(row.name);
        if (seen.has(key)) continue;
        seen.add(key);

        let assignedToId: string | undefined;
        if (row.employee) {
          assignedToId = memberByName.get(normalize(row.employee));
          if (!assignedToId) unknownEmployees.add(row.employee);
        }

        const data = { chairmanName: row.chairmanName, phone: row.phone, ...(row.sector ? { sector: row.sector } : {}), ...(assignedToId ? { assignedToId } : {}) };
        const current = existingByName.get(key);
        if (current) {
          await tx.mahalla.update({ where: { id: current.id }, data });
          if (assignedToId && current.assignedToId !== assignedToId) await reassignOpenTasks(tx, orgId, { mahallaId: current.id }, assignedToId);
          updated += 1;
          continue;
        }
        order += 1;
        await tx.mahalla.create({ data: { ...data, orgId, name: row.name, sortOrder: order } });
        created += 1;
      }
    });

    fastify.emitToOrg(orgId, "mahalla:changed");
    fastify.emitToOrg(orgId, "campaign:changed");
    return reply.code(201).send({ created, updated, unknownEmployees: [...unknownEmployees] });
  });

  // ---------- Taqsimot: xodimlar MFY'larni o'zlari bo'lishib oladi ----------
  // Har bir xodim bo'sh MFY'larni belgilab o'ziga oladi, keyingisiga qolgani ko'rinadi.
  // Boshliq taqsimotni yopib qo'yishi (selfAssign=false) yoki hammasini qaytadan boshlashi mumkin.

  async function selfAssignOpen(orgId: string, reply: FastifyReply) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { selfAssign: true } });
    if (!org.selfAssign) {
      reply.code(403).send({ error: "Boshliq MFY tanlashni yopgan. O'zgartirish uchun boshliqqa murojaat qiling" });
      return false;
    }
    return true;
  }

  fastify.post("/api/mahalla/claim", async (request, reply) => {
    const { orgId, id: userId } = request.currentUser!;
    const { ids } = idsSchema.parse(request.body);
    if (!(await selfAssignOpen(orgId, reply))) return;

    // Har bir MFY alohida, faqat hali bo'sh bo'lsa olinadi — ikki xodim bir vaqtda bossa ham
    // MFY faqat birinchisiga tegadi, ikkinchisi "band bo'ldi" deb javob oladi
    const claimed = await prisma.$transaction(async (tx) => {
      const got: string[] = [];
      for (const id of new Set(ids)) {
        const { count } = await tx.mahalla.updateMany({ where: { id, orgId, isActive: true, assignedToId: null }, data: { assignedToId: userId } });
        if (count === 1) got.push(id);
      }
      if (got.length) await reassignOpenTasks(tx, orgId, { mahallaId: { in: got }, assignedToId: null }, userId);
      return got;
    });

    if (claimed.length) {
      fastify.emitToOrg(orgId, "mahalla:changed");
      fastify.emitToOrg(orgId, "campaign:changed");
    }
    return { claimed: claimed.length, taken: new Set(ids).size - claimed.length };
  });

  fastify.post("/api/mahalla/release", async (request, reply) => {
    const { orgId, id: userId } = request.currentUser!;
    const { ids } = idsSchema.parse(request.body);
    if (!(await selfAssignOpen(orgId, reply))) return;

    const released = await prisma.$transaction(async (tx) => {
      const own = await tx.mahalla.findMany({ where: { id: { in: ids }, orgId, assignedToId: userId }, select: { id: true } });
      const ownIds = own.map((m) => m.id);
      if (ownIds.length === 0) return 0;
      await tx.mahalla.updateMany({ where: { id: { in: ownIds } }, data: { assignedToId: null } });
      // Joriy topshiriqdagi hali bog'lanilmagan vazifalar "biriktirilmagan"ga o'tadi — boshqalar yordam bera oladi
      await reassignOpenTasks(tx, orgId, { mahallaId: { in: ownIds }, assignedToId: userId }, null);
      return ownIds.length;
    });

    if (released) {
      fastify.emitToOrg(orgId, "mahalla:changed");
      fastify.emitToOrg(orgId, "campaign:changed");
    }
    return { released };
  });

  // Boshliq: taqsimotni qaytadan boshlash — barcha MFY'lar bo'sh bo'ladi, xodimlar qaytadan tanlaydi
  fastify.post("/api/mahalla/unassign-all", { preHandler: requireBoss }, async (request) => {
    const { orgId } = request.currentUser!;
    const count = await prisma.$transaction(async (tx) => {
      const { count } = await tx.mahalla.updateMany({ where: { orgId, assignedToId: { not: null } }, data: { assignedToId: null } });
      await reassignOpenTasks(tx, orgId, {}, null);
      return count;
    });
    fastify.emitToOrg(orgId, "mahalla:changed");
    fastify.emitToOrg(orgId, "campaign:changed");
    return { count };
  });

  fastify.get("/api/mahalla/settings", async (request) => {
    return prisma.organization.findUniqueOrThrow({ where: { id: request.currentUser!.orgId }, select: { selfAssign: true } });
  });

  fastify.patch("/api/mahalla/settings", { preHandler: requireBoss }, async (request) => {
    const { orgId } = request.currentUser!;
    const { selfAssign } = z.object({ selfAssign: z.boolean() }).parse(request.body);
    const org = await prisma.organization.update({ where: { id: orgId }, data: { selfAssign }, select: { selfAssign: true } });
    fastify.emitToOrg(orgId, "mahalla:changed");
    return org;
  });
}
