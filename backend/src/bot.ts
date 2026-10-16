import { Telegraf } from "telegraf";
import { prisma } from "./db.js";
import { setGroupChatId } from "./settings.js";

export function createBot(token: string, frontendUrl: string) {
  const bot = new Telegraf(token);

  const openAppKeyboard = {
    reply_markup: {
      inline_keyboard: [[{ text: "Ilovani ochish", web_app: { url: frontendUrl } }]],
    },
  };

  bot.start(async (ctx) => {
    // Web App tugmalari faqat shaxsiy chatda ishlaydi; guruhdagi /start e'tiborsiz qoldiriladi
    if (ctx.chat.type !== "private") return;

    const payload = ctx.startPayload;
    const telegramId = BigInt(ctx.from.id);
    const fullName = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");

    const existing = await prisma.user.findUnique({ where: { telegramId } });
    if (existing) {
      await ctx.reply(`Assalomu alaykum, ${existing.fullName}.`, openAppKeyboard);
      return;
    }

    if (payload) {
      const invited = await prisma.user.findFirst({ where: { inviteCode: payload, telegramId: null } });
      if (invited) {
        await prisma.user.update({
          where: { id: invited.id },
          data: { telegramId, linkedAt: new Date(), inviteCode: null },
        });
        await ctx.reply(`Xush kelibsiz, ${invited.fullName}. Hisobingiz ulandi.`, openAppKeyboard);
        return;
      }
    }

    const bossCount = await prisma.user.count({ where: { role: "BOSS" } });
    if (bossCount === 0) {
      await prisma.user.create({
        data: { telegramId, fullName, role: "BOSS", isActive: true, linkedAt: new Date() },
      });
      await ctx.reply(`Xush kelibsiz, ${fullName}. Siz tizimga boshliq sifatida qo'shildingiz.`, openAppKeyboard);
      return;
    }

    await ctx.reply("Sizda ruxsat yo'q. Kirish uchun boshliqdan taklif havolasini so'rang.");
  });

  // Bot guruhga qo'shilganda — qanday ulashni tushuntiradi
  bot.on("my_chat_member", async (ctx) => {
    const chatType = ctx.chat.type;
    const newStatus = ctx.myChatMember.new_chat_member.status;
    if ((chatType === "group" || chatType === "supergroup") && (newStatus === "member" || newStatus === "administrator")) {
      await ctx.reply("Natijalar shu guruhga yuborilishi uchun boshliq /ulash buyrug'ini yozsin.");
    }
  });

  // Boshliq guruhda /ulash yozadi — natijalar va hisobotlar shu guruhga yuboriladi
  bot.command("ulash", async (ctx) => {
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      await ctx.reply("Bu buyruq guruhda ishlatiladi: botni guruhga qo'shing va o'sha yerda /ulash yozing.");
      return;
    }
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } });
    if (!user || user.role !== "BOSS" || !user.isActive) {
      await ctx.reply("Guruhni faqat boshliq ulay oladi.");
      return;
    }
    await setGroupChatId(String(ctx.chat.id));
    await ctx.reply("Guruh ulandi. Qo'ng'iroq natijalari va yakuniy hisobotlar shu yerga yuboriladi.");
  });

  // Handler ichidagi xato (masalan, DB uzilishi) butun botni to'xtatib qo'ymasligi uchun
  bot.catch((err, ctx) => {
    console.error(`Bot xatosi (update ${ctx.update.update_id}):`, err);
  });

  return bot;
}

// Telegram'dagi buyruqlar menyusi va Mini App tugmasi — BotFather'da qo'lda sozlash shart emas
export async function configureBotUi(bot: Telegraf, frontendUrl: string) {
  await bot.telegram.setMyCommands([{ command: "start", description: "Ilovani ochish" }], {
    scope: { type: "all_private_chats" },
  });
  await bot.telegram.setMyCommands([{ command: "ulash", description: "Natijalarni shu guruhga yuborish" }], {
    scope: { type: "all_chat_administrators" },
  });
  if (frontendUrl.startsWith("https://")) {
    await bot.telegram.setChatMenuButton({
      menuButton: { type: "web_app", text: "Ilova", web_app: { url: frontendUrl } },
    });
  }
}
