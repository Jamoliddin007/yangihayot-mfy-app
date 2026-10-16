import { io, type Socket } from "socket.io-client";
import { API_URL, getCurrentOrg, getDevTelegramId, getInitDataRaw } from "./api";

let socket: Socket | null = null;
let socketOrg: string | null = null;

// Bitta ulanish — tanlangan tashkilot uchun. Tashkilot almashsa, qayta ulanadi (server boshqa xonaga qo'shadi).
export function getSocket(): Socket {
  const orgId = getCurrentOrg();
  if (socket && socketOrg === orgId) return socket;
  socket?.disconnect();
  socketOrg = orgId;

  socket = io(API_URL || undefined, {
    // Funksiya ko'rinishida: har bir qayta ulanishda auth yangidan o'qiladi
    auth: (cb) => {
      const initData = getInitDataRaw();
      cb({ ...(initData ? { initData } : { devTelegramId: getDevTelegramId() }), orgId: socketOrg });
    },
    autoConnect: true,
    transports: ["websocket"],
  });
  return socket;
}
