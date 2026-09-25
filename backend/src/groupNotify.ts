import type { Telegraf } from "telegraf";

declare module "fastify" {
  interface FastifyInstance {
    notifyGroup: (message: string) => Promise<void>;
  }
}

// Guruhga xabar yuborish: GROUP_CHAT_ID .env'da sozlanmagan bo'lsa, jim o'tkaziladi
// (feature keyinroq, guruh ID olingandan so'ng avtomatik ishga tushadi).
export function createGroupNotifier(bot: Telegraf) {
  return async function notifyGroup(message: string) {
    const chatId = process.env.GROUP_CHAT_ID;
    if (!chatId) return;

    try {
      await bot.telegram.sendMessage(chatId, message);
    } catch (err) {
      console.error("Guruhga xabar yuborishda xatolik:", err);
    }
  };
}
