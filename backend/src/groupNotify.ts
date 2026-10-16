import type { Telegraf } from "telegraf";
import { getGroupChatId, setGroupChatId } from "./settings.js";

declare module "fastify" {
  interface FastifyInstance {
    notifyGroup: (html: string) => Promise<void>;
  }
}

interface TelegramApiError {
  response?: { parameters?: { migrate_to_chat_id?: number } };
}

// Guruhga HTML formatdagi xabar. Guruh ulanmagan bo'lsa jim o'tkaziladi.
// Oddiy guruh supergroup'ga aylansa Telegram yangi ID beradi — uni saqlab, qayta yuboramiz.
export function createGroupNotifier(bot: Telegraf) {
  return async function notifyGroup(html: string) {
    const chatId = await getGroupChatId();
    if (!chatId) return;

    const send = (id: string | number) =>
      bot.telegram.sendMessage(id, html, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });

    try {
      await send(chatId);
    } catch (err) {
      const migratedTo = (err as TelegramApiError).response?.parameters?.migrate_to_chat_id;
      if (migratedTo) {
        await setGroupChatId(String(migratedTo));
        await send(migratedTo).catch((retryErr) => console.error("Guruhga xabar yuborishda xatolik:", retryErr));
        return;
      }
      console.error("Guruhga xabar yuborishda xatolik:", err);
    }
  };
}
