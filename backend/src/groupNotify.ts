import type { Telegraf } from "telegraf";
import { prisma } from "./db.js";

declare module "fastify" {
  interface FastifyInstance {
    // Tashkilotning Telegram guruhiga HTML xabar (guruh ulanmagan bo'lsa — jim o'tkaziladi)
    notifyGroup: (orgId: string, html: string) => Promise<void>;
    // Bitta foydalanuvchiga shaxsiy xabar (masalan, yangi topshiriq haqida)
    notifyUser: (telegramId: bigint, html: string, withAppButton?: boolean) => Promise<void>;
  }
}

interface TelegramApiError {
  response?: { error_code?: number; parameters?: { migrate_to_chat_id?: number } };
}

export function createNotifiers(bot: Telegraf, appUrl: string) {
  const send = (chatId: string | number, html: string, withAppButton = false) =>
    bot.telegram.sendMessage(chatId, html, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(withAppButton && appUrl.startsWith("https://")
        ? { reply_markup: { inline_keyboard: [[{ text: "Ilovani ochish", web_app: { url: appUrl } }]] } }
        : {}),
    });

  async function notifyGroup(orgId: string, html: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { groupChatId: true } });
    if (!org?.groupChatId) return;
    try {
      await send(org.groupChatId, html);
    } catch (err) {
      const apiErr = err as TelegramApiError;
      // Oddiy guruh supergroup'ga aylansa Telegram yangi ID beradi — saqlab, qayta yuboramiz
      const migratedTo = apiErr.response?.parameters?.migrate_to_chat_id;
      if (migratedTo) {
        await prisma.organization.update({ where: { id: orgId }, data: { groupChatId: String(migratedTo) } });
        await send(migratedTo, html).catch((e) => console.error("Guruhga xabar yuborishda xatolik:", e));
        return;
      }
      // Bot guruhdan chiqarilgan — guruh uziladi, boshliq qayta /ulash qilishi mumkin
      if (apiErr.response?.error_code === 403) {
        await prisma.organization.update({ where: { id: orgId }, data: { groupChatId: null } });
      }
      console.error("Guruhga xabar yuborishda xatolik:", err);
    }
  }

  async function notifyUser(telegramId: bigint, html: string, withAppButton = false) {
    // Foydalanuvchi botni bloklagan bo'lishi mumkin — bu xato emas, shunchaki yetkazilmaydi
    await send(String(telegramId), html, withAppButton).catch(() => undefined);
  }

  return { notifyGroup, notifyUser };
}
