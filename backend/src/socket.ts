import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { resolveMembership, resolveUser } from "./authPlugin.js";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
    // Faqat shu tashkilot a'zolariga real-time hodisa yuborish
    emitToOrg: (orgId: string, event: string, payload?: unknown) => void;
  }
}

export const orgRoom = (orgId: string) => `org:${orgId}`;

export function setupSocket(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: { origin: "*" },
  });

  // Ulanishda: foydalanuvchi va uning tanlangan tashkilotdagi a'zoligi tekshiriladi.
  // Har kim faqat o'z tashkiloti xonasiga qo'shiladi — boshqa tumanlar hodisalarini ko'rmaydi.
  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth ?? {};
      const user = await resolveUser(auth.initData as string | undefined, auth.devTelegramId as string | undefined);
      if (!user) return next(new Error("unauthorized"));

      const membership = await resolveMembership(user.id, (auth.orgId as string | undefined) || undefined);
      if (!membership) return next(new Error("forbidden"));

      socket.data.userId = user.id;
      socket.data.orgId = membership.orgId;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket) => {
    socket.join(orgRoom(socket.data.orgId as string));
  });

  fastify.decorate("emitToOrg", (orgId: string, event: string, payload?: unknown) => {
    io.to(orgRoom(orgId)).emit(event, payload);
  });

  return io;
}
