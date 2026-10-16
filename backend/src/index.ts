import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import type { Update } from "telegraf/types";
import { prisma } from "./db.js";
import { configureBotUi, createBot } from "./bot.js";
import { setupSocket } from "./socket.js";
import { createNotifiers } from "./groupNotify.js";
import { DEV_AUTH_ENABLED } from "./authPlugin.js";
import { meRoutes } from "./routes/me.routes.js";
import { mahallaRoutes } from "./routes/mahalla.routes.js";
import { memberRoutes } from "./routes/members.routes.js";
import { campaignRoutes } from "./routes/campaigns.routes.js";
import { taskRoutes } from "./routes/tasks.routes.js";

// Prisma BigInt (telegramId) ni JSON'ga to'g'ridan-to'g'ri serialize qilish uchun
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/$/, "");
const BOT_MODE = process.env.BOT_MODE ?? "polling";
const WEBHOOK_PATH = "/telegram/webhook";
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
  // BOT_MODE=off (lokal): Telegram'ga hech narsa yuborilmaydi — xabarlar logga yoziladi
  const notifiers =
    BOT_MODE === "off"
      ? {
          notifyGroup: async (orgId: string, html: string) => void fastify.log.info({ orgId, html }, "Guruh xabari (yuborilmadi)"),
          notifyUser: async (telegramId: bigint, html: string) => void fastify.log.info({ telegramId: String(telegramId), html }, "Shaxsiy xabar (yuborilmadi)"),
        }
      : createNotifiers(bot, FRONTEND_URL);
  fastify.decorate("notifyGroup", notifiers.notifyGroup);
  fastify.decorate("notifyUser", notifiers.notifyUser);

  await fastify.register(meRoutes);
  await fastify.register(mahallaRoutes);
  await fastify.register(memberRoutes);
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

  // Serverda (BOT_MODE=webhook): Telegram yangilanishlarni o'zi shu manzilga POST qiladi —
  // doimiy so'rov yubormaydi, tezroq va yengilroq. Lokal ishlab chiqishda — polling.
  // Maxfiy token bot tokenidan hosil qilinadi: soxta so'rovlar 401 oladi.
  const useWebhook = BOT_MODE === "webhook";
  const webhookSecret = crypto.createHash("sha256").update(BOT_TOKEN!).digest("hex").slice(0, 32);
  if (useWebhook) {
    fastify.post(WEBHOOK_PATH, async (request, reply) => {
      if (request.headers["x-telegram-bot-api-secret-token"] !== webhookSecret) {
        return reply.code(401).send();
      }
      await bot.handleUpdate(request.body as Update);
      return reply.code(200).send();
    });
  }

  await fastify.listen({ port: PORT, host: "0.0.0.0" });

  const botRuns = BOT_MODE !== "off";
  if (useWebhook) {
    await bot.telegram.setWebhook(`${FRONTEND_URL}${WEBHOOK_PATH}`, {
      secret_token: webhookSecret,
      allowed_updates: ["message", "callback_query", "my_chat_member"],
    });
    await configureBotUi(bot, FRONTEND_URL).catch((err) => fastify.log.error(err, "Bot menyusini sozlashda xatolik"));
    fastify.log.info(`Telegram bot webhook rejimida: ${FRONTEND_URL}${WEBHOOK_PATH}`);
  } else if (!botRuns) {
    // Lokal ishlab chiqish: bot umuman ishga tushmaydi, serverdagi webhook'ga tegilmaydi
    fastify.log.info("BOT_MODE=off — Telegram bot ishga tushirilmadi");
  } else {
    // MUHIM: bot.launch() ni await qilmaslik kerak — Telegraf'da bu promise
    // faqat bot to'xtaganda (stop chaqirilganda) resolve bo'ladi.
    // DIQQAT: polling ishga tushganda Telegram'dagi webhook o'chiriladi — serverdagi bot bilan
    // bir xil tokenni lokal ishlatsangiz, server botni "yo'qotadi". Lokal uchun alohida test bot oling.
    bot.launch().catch((err) => {
      fastify.log.error(err, "Bot ishga tushishida xatolik");
    });
    fastify.log.info("Telegram bot polling rejimida ishga tushdi");
  }

  const shutdown = async (signal: string) => {
    fastify.log.info(`${signal} qabul qilindi, to'xtatilmoqda...`);
    if (!useWebhook && botRuns) bot.stop(signal);
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
