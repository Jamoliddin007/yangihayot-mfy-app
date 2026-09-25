import { Telegraf } from "telegraf";
import { prisma } from "./db.js";

export function createBot(token: string, frontendUrl: string) {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    const payload = ctx.startPayload;
    const telegramId = BigInt(ctx.from.id);
    const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");

    const openAppKeyboard = {
      reply_markup: {
        inline_keyboard: [[{ text: "Ilovani ochish", web_app: { url: frontendUrl } }]],
      },
    };

    const existing = await prisma.user.findUnique({ where: { telegramId } });
    if (existing) {
      await ctx.reply(`Salom, ${existing.fullName}! Ilovani oching:`, openAppKeyboard);
      return;
    }

    if (payload) {
      const invited = await prisma.user.findFirst({ where: { inviteCode: payload, telegramId: null } });
      if (invited) {
        await prisma.user.update({
          where: { id: invited.id },
          data: { telegramId, linkedAt: new Date(), inviteCode: null },
        });
        await ctx.reply(`Xush kelibsiz, ${invited.fullName}! Ilovadan foydalanishingiz mumkin:`, openAppKeyboard);
        return;
      }
    }

    const bossCount = await prisma.user.count({ where: { role: "BOSS" } });
    if (bossCount === 0) {
      await prisma.user.create({
        data: { telegramId, fullName, role: "BOSS", isActive: true, linkedAt: new Date() },
      });
      await ctx.reply(
        `Xush kelibsiz, ${fullName}! Siz tizim boshlig'i sifatida ro'yxatdan o'tdingiz.`,
        openAppKeyboard,
      );
      return;
    }

    await ctx.reply("Kechirasiz, sizda ushbu botdan foydalanish uchun ruxsat yo'q. Boshliqdan taklif havolasini so'rang.");
  });

  // Guruhga xabar yuborish uchun GROUP_CHAT_ID kerak. Buni topish uchun:
  // botni guruhga qo'shing, guruhda /chatid deb yozing, bot chat ID'ni javob qiladi.
  bot.command("chatid", async (ctx) => {
    await ctx.reply(`Ushbu chat ID: ${ctx.chat.id}`);
  });

  return bot;
}
