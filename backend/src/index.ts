import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { createBot } from "./bot.js";
import { setupSocket } from "./socket.js";
import { createGroupNotifier } from "./groupNotify.js";
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

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN .env faylida topilmadi");
}

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, { origin: true });
  await fastify.register(multipart);

  const io = setupSocket(fastify, BOT_TOKEN!);
  fastify.decorate("io", io);

  const bot = createBot(BOT_TOKEN!, FRONTEND_URL);
  fastify.decorate("notifyGroup", createGroupNotifier(bot));

  await fastify.register(authRoutes);
  await fastify.register(mahallaRoutes);
  await fastify.register(userRoutes);
  await fastify.register(campaignRoutes);
  await fastify.register(taskRoutes);

  fastify.get("/health", async () => ({ ok: true }));

  // MUHIM: bot.launch() ni await qilmaslik kerak — Telegraf'da bu promise
  // faqat bot to'xtaganda (stop chaqirilganda) resolve bo'ladi, aks holda server
  // hech qachon tinglashni boshlamaydi.
  bot.launch().catch((err) => {
    fastify.log.error(err, "Bot ishga tushishida xatolik");
  });
  fastify.log.info("Telegram bot ishga tushdi");

  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  fastify.log.info(`Server ${PORT} portda ishlamoqda`);

  const shutdown = async (signal: string) => {
    fastify.log.info(`${signal} qabul qilindi, to'xtatilmoqda...`);
    bot.stop(signal);
    await fastify.close();
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
