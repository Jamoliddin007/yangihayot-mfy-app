import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { resolveUser } from "./authPlugin.js";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

export function setupSocket(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: { origin: "*" },
  });

  io.use(async (socket, next) => {
    try {
      const initData = socket.handshake.auth?.initData as string | undefined;
      const devTelegramId = socket.handshake.auth?.devTelegramId as string | undefined;
      const user = await resolveUser(initData, devTelegramId);
      if (!user) return next(new Error("unauthorized"));

      socket.data.userId = user.id;
      socket.data.fullName = user.fullName;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.join("dashboard");
  });

  return io;
}
