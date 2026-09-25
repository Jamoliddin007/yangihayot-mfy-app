import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { validateInitData } from "./telegramAuth.js";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

export function setupSocket(fastify: FastifyInstance, botToken: string) {
  const io = new Server(fastify.server, {
    cors: { origin: "*" },
  });

  const isDev = process.env.NODE_ENV !== "production";

  io.use(async (socket, next) => {
    const devTelegramId = socket.handshake.auth?.devTelegramId as string | undefined;
    if (isDev && devTelegramId) {
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(devTelegramId) } });
      if (!user || !user.isActive) return next(new Error("forbidden"));
      socket.data.userId = user.id;
      socket.data.fullName = user.fullName;
      return next();
    }

    const initData = socket.handshake.auth?.initData as string | undefined;
    if (!initData) return next(new Error("unauthorized"));

    const validated = validateInitData(initData, botToken);
    if (!validated) return next(new Error("unauthorized"));

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(validated.user.id) } });
    if (!user || !user.isActive) return next(new Error("forbidden"));

    socket.data.userId = user.id;
    socket.data.fullName = user.fullName;
    next();
  });

  io.on("connection", (socket) => {
    socket.join("dashboard");
  });

  return io;
}
