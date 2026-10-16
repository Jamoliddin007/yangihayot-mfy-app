import type { FastifyInstance } from "fastify";
import { z } from "zod";
import ExcelJS from "exceljs";
import { prisma } from "../db.js";
import { authenticate, requireBoss } from "../authPlugin.js";

const mahallaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  chairmanName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(30),
});

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export async function mahallaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/api/mahalla", async () => {
    return prisma.mahalla.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  });

  fastify.post("/api/mahalla", { preHandler: requireBoss }, async (request, reply) => {
    const body = mahallaSchema.parse(request.body);
    const maxOrder = await prisma.mahalla.aggregate({ _max: { sortOrder: true } });
    const mahalla = await prisma.mahalla.create({
      data: { ...body, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    });
    return reply.code(201).send(mahalla);
  });

  fastify.put("/api/mahalla/:id", { preHandler: requireBoss }, async (request) => {
    const { id } = request.params as { id: string };
    const body = mahallaSchema.partial().parse(request.body);
    return prisma.mahalla.update({ where: { id }, data: body });
  });

  fastify.delete("/api/mahalla/:id", { preHandler: requireBoss }, async (request) => {
    const { id } = request.params as { id: string };
    return prisma.mahalla.update({ where: { id }, data: { isActive: false } });
  });

  // Excel import: 1-ustun MFY nomi, 2-ustun rais F.I.Sh, 3-ustun telefon raqami (1-qator sarlavha)
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

    const rows: { name: string; chairmanName: string; phone: string }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // sarlavha qatori
      const name = row.getCell(1).text?.trim();
      const chairmanName = row.getCell(2).text?.trim();
      const phone = row.getCell(3).text?.trim();
      if (name && chairmanName && phone) {
        rows.push({ name, chairmanName, phone });
      }
    });

    if (rows.length === 0) {
      return reply.code(400).send({ error: "Fayl bo'sh yoki format noto'g'ri (1-ustun MFY, 2-ustun F.I.Sh, 3-ustun telefon)" });
    }

    // Takroriy importdan himoya: bazada (faol) yoki faylning o'zida bor MFY nomlari o'tkazib yuboriladi
    const existing = await prisma.mahalla.findMany({ where: { isActive: true }, select: { name: true } });
    const seen = new Set(existing.map((m) => normalizeName(m.name)));
    const fresh = rows.filter((row) => {
      const key = normalizeName(row.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const maxOrder = await prisma.mahalla.aggregate({ _max: { sortOrder: true } });
    const startOrder = maxOrder._max.sortOrder ?? 0;

    const { count } = await prisma.mahalla.createMany({
      data: fresh.map((row, i) => ({ ...row, sortOrder: startOrder + i + 1 })),
    });

    return reply.code(201).send({ count, skipped: rows.length - fresh.length });
  });
}
