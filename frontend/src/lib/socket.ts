import { io, type Socket } from "socket.io-client";
import { API_URL, getDevTelegramId, getInitDataRaw } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const initData = getInitDataRaw();
  const devTelegramId = getDevTelegramId();

  socket = io(API_URL || undefined, {
    auth: initData ? { initData } : { devTelegramId },
    autoConnect: true,
    transports: ["websocket"],
  });

  return socket;
}
