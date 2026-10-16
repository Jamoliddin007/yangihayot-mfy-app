import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";
import { reassignOpenTasks } from "../assignment.js";

const mahallaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  chairmanName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(30),
  assignedToId: z.string().min(1).nullable().optional(),
});

const mahallaInclude = { assignedTo: { select: { id: true, fullName: true } } } as const;

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

async function assertEmployee(id: string | null | undefined, reply: FastifyReply) {
  if (!id) return true;
  const employee = await prisma.user.findFirst({ where: { id, role: "EMPLOYEE", isActive: true } });
  if (!employee) {
    reply.code(400).send({ error: "Xodim topilmadi yoki faol emas" });
    return false;
  }
  return true;
}

export async function mahallaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/api/mahalla", async () => {
    return prisma.mahalla.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: mahallaInclude });
  });

  fastify.post("/api/mahalla", { preHandler: requireBoss }, async (request, reply) => {
    const body = mahallaSchema.parse(request.body);
    if (!(await assertEmployee(body.assignedToId, reply))) return;

    const maxOrder = await prisma.mahalla.aggregate({ _max: { sortOrder: true } });
    const mahalla = await prisma.mahalla.create({
      data: { ...body, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
      include: mahallaInclude,
    });
    return reply.code(201).send(mahalla);
  });

  fastify.put("/api/mahalla/:id", { preHandler: requireBoss }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = mahallaSchema.partial().parse(request.body);
    if (!(await assertEmployee(body.assignedToId, reply))) return;

    const mahalla = await prisma.$transaction(async (tx) => {
      const updated = await tx.mahalla.update({ where: { id }, data: body, include: mahallaInclude });
      // Mas'ul o'zgarsa, joriy topshiriqdagi hali bog'lanilmagan vazifa ham yangi xodimga o'tadi
      if (body.assignedToId !== undefined) {
        await reassignOpenTasks(tx, { mahallaId: id }, body.assignedToId);
      }
      return updated;
    });

    if (body.assignedToId !== undefined) fastify.io.to("dashboard").emit("campaign:changed");
    return mahalla;
  });

  fastify.delete("/api/mahalla/:id", { preHandler: requireBoss }, async (request) => {
    const { id } = request.params as { id: string };
    return prisma.mahalla.update({ where: { id }, data: { isActive: false } });
  });

  // Excel import (1-qator sarlavha):
  // 1-ustun MFY nomi, 2-ustun rais F.I.Sh, 3-ustun telefon, 4-ustun (ixtiyoriy) mas'ul xodim ismi.
  // Bazada bor MFY qayta yaratilmaydi, lekin 4-ustun berilsa mas'ul xodimi yangilanadi.
  fastify.post("/api/mahalla/import", { preHandler: requireBoss }, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: "Fayl topilmadi" });
    }
    // ExcelJS faqat .xlsx formatini o'qiydi (eski .xls emas)
    if (!file.filename.toLowerCase().endsWith(".xlsx")) {
      return reply.code(400).send({ error: "Faqat .xlsx formatidagi fayl qabul qilinadi" });
    }

    const buffer = await file.toBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return reply.code(400).send({ error: "Sahifa topilmadi" });
    }

    const rows: { name: string; chairmanName: string; phone: string; employee: string }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // sarlavha qatori
      const name = row.getCell(1).text?.trim();
      const chairmanName = row.getCell(2).text?.trim();
      const phone = row.getCell(3).text?.trim();
      const employee = row.getCell(4).text?.trim() ?? "";
      if (name && chairmanName && phone) {
        rows.push({ name, chairmanName, phone, employee });
      }
    });

    if (rows.length === 0) {
      return reply.code(400).send({ error: "Fayl bo'sh yoki format noto'g'ri (1-ustun MFY, 2-ustun F.I.Sh, 3-ustun telefon)" });
    }

    const employees = await prisma.user.findMany({ where: { role: "EMPLOYEE", isActive: true } });
    const employeeByName = new Map(employees.map((e) => [normalize(e.fullName), e.id]));
    const unknownEmployees = new Set<string>();

    const existing = await prisma.mahalla.findMany({ where: { isActive: true } });
    const existingByName = new Map(existing.map((m) => [normalize(m.name), m]));
    const maxOrder = await prisma.mahalla.aggregate({ _max: { sortOrder: true } });
    let order = maxOrder._max.sortOrder ?? 0;

    let created = 0;
    let assigned = 0;
    const seen = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const key = normalize(row.name);
        if (seen.has(key)) continue;
        seen.add(key);

        let assignedToId: string | undefined;
        if (row.employee) {
          assignedToId = employeeByName.get(normalize(row.employee));
          if (!assignedToId) unknownEmployees.add(row.employee);
        }

        const current = existingByName.get(key);
        if (current) {
          if (assignedToId && current.assignedToId !== assignedToId) {
            await tx.mahalla.update({ where: { id: current.id }, data: { assignedToId } });
            await reassignOpenTasks(tx, { mahallaId: current.id }, assignedToId);
            assigned += 1;
          }
          continue;
        }

        order += 1;
        await tx.mahalla.create({
          data: { name: row.name, chairmanName: row.chairmanName, phone: row.phone, sortOrder: order, assignedToId },
        });
        created += 1;
        if (assignedToId) assigned += 1;
      }
    });

    if (assigned > 0) fastify.io.to("dashboard").emit("campaign:changed");
    return reply.code(201).send({
      created,
      assigned,
      skipped: rows.length - created,
      unknownEmployees: [...unknownEmployees],
    });
  });
}
