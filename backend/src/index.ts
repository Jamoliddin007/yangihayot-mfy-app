import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "./db.js";
import { createBot } from "./bot.js";
import { setupSocket } from "./socket.js";
import { createGroupNotifier } from "./groupNotify.js";
import { DEV_AUTH_ENABLED } from "./authPlugin.js";
import { authRoutes } from "./routes/auth.routes.js";
import { mahallaRoutes } from "./routes/mahalla.routes.js";
import { userRoutes } from "./routes/users.routes.js";
import { campaignRoutes } from "./routes/campaigns.routes.js";
import { taskRoutes } from "./routes/tasks.routes.js";

// Prisma BigInt (telegramId) ni JSON'ga to'g'ridan-to'g'ri serialize qilish uchun
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
// `npm run build` (frontend) natijasi. Mavjud bo'lsa, backend frontend'ni ham o'zi beradi —
// bitta port, bitta tunnel/domen, Vite dev-server kerak emas.
const FRONTEND_DIST = path.resolve(process.env.FRONTEND_DIST ?? path.join(import.meta.dirname, "../../frontend/dist"));

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN .env faylida topilmadi");
}

async function main() {
  const fastify = Fastify({ logger: true });

  if (DEV_AUTH_ENABLED) {
    fastify.log.warn("DEV_AUTH=true — dev-bypass yoqilgan! Hech qachon ochiq serverda yoqmang.");
  }

  // Barcha route'lar uchun yagona xato formati: { error: "..." }
  fastify.setErrorHandler((err, request, reply) => {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return reply.code(400).send({ error: `Noto'g'ri ma'lumot: ${issue?.path.join(".") || "body"} — ${issue?.message}` });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return reply.code(404).send({ error: "Ma'lumot topilmadi" });
    }
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({ error: (err as Error).message });
    }
    request.log.error(err);
    return reply.code(500).send({ error: "Serverda xatolik yuz berdi" });
  });

  await fastify.register(cors, { origin: true });
  await fastify.register(compress);
  await fastify.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  const io = setupSocket(fastify);
  fastify.decorate("io", io);

  const bot = createBot(BOT_TOKEN!, FRONTEND_URL);
  fastify.decorate("notifyGroup", createGroupNotifier(bot));

  await fastify.register(authRoutes);
  await fastify.register(mahallaRoutes);
  await fastify.register(userRoutes);
  await fastify.register(campaignRoutes);
  await fastify.register(taskRoutes);

  fastify.get("/health", async () => ({ ok: true }));

  if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
    await fastify.register(fastifyStatic, {
      root: FRONTEND_DIST,
      // Vite fayl nomiga hash qo'shadi (index-a1b2c3.js) — ularni 1 yil keshlash xavfsiz.
      // index.html esa har doim yangidan tekshiriladi, aks holda yangi versiya foydalanuvchiga yetmaydi.
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.header("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.header("Cache-Control", "no-cache");
        }
      },
    });

    // SPA fallback: noma'lum GET so'rovlarga index.html (API'dan tashqari)
    fastify.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) {
        return reply.header("Cache-Control", "no-cache").sendFile("index.html");
      }
      return reply.code(404).send({ error: "Topilmadi" });
    });
    fastify.log.info(`Frontend shu yerdan beriladi: ${FRONTEND_DIST}`);
  } else {
    fastify.log.warn(`Frontend build topilmadi (${FRONTEND_DIST}) — faqat API ishlaydi. Frontend uchun: cd frontend && npm run build`);
  }

  // MUHIM: bot.launch() ni await qilmaslik kerak — Telegraf'da bu promise
  // faqat bot to'xtaganda (stop chaqirilganda) resolve bo'ladi, aks holda server
  // hech qachon tinglashni boshlamaydi.
  bot.launch().catch((err) => {
    fastify.log.error(err, "Bot ishga tushishida xatolik");
  });
  fastify.log.info("Telegram bot ishga tushdi");

  await fastify.listen({ port: PORT, host: "0.0.0.0" });

  const shutdown = async (signal: string) => {
    fastify.log.info(`${signal} qabul qilindi, to'xtatilmoqda...`);
    bot.stop(signal);
    await fastify.close(); // HTTP + Socket.io ulanishlarini yopadi
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
