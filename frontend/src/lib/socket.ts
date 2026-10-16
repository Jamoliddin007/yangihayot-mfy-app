import { io, type Socket } from "socket.io-client";
import { API_URL, getDevTelegramId, getInitDataRaw } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(API_URL || undefined, {
    // Funksiya ko'rinishida: har bir qayta ulanishda auth yangidan o'qiladi
    auth: (cb) => {
      const initData = getInitDataRaw();
      cb(initData ? { initData } : { devTelegramId: getDevTelegramId() });
    },
    autoConnect: true,
    transports: ["websocket"],
  });

  return socket;
}
