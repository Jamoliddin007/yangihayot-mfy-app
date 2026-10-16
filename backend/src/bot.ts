import { Markup, Telegraf, type Context } from "telegraf";
import { prisma } from "./db.js";
import { escapeHtml } from "./messages.js";
import {
  DomainError,
  acceptInvite,
  createInvite,
  decideOrganization,
  inviteLink,
  requestOrganization,
  type TelegramProfile,
} from "./orgService.js";

const ROLE_TEXT = { BOSS: "boshliq", EMPLOYEE: "xodim" } as const;
const ORG_STATUS_TEXT = { PENDING: "kutilmoqda", ACTIVE: "faol", SUSPENDED: "to'xtatilgan", REJECTED: "rad etilgan" } as const;

// Tashkilot nomini kutayotgan foydalanuvchilar (bitta jarayon — xotira yetarli; 10 daqiqadan keyin eskiradi)
const awaitingOrgName = new Map<number, number>();
const AWAIT_TTL_MS = 10 * 60 * 1000;

const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };

export function createBot(token: string, appUrl: string) {
  const bot = new Telegraf(token);
  const appKeyboard = appUrl.startsWith("https://") ? Markup.inlineKeyboard([Markup.button.webApp("Ilovani ochish", appUrl)]) : undefined;

  const isPrivate = (ctx: Context) => ctx.chat?.type === "private";
  const isGroup = (ctx: Context) => ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";

  async function findUser(ctx: Context) {
    return ctx.from ? prisma.user.findUnique({ where: { telegramId: BigInt(ctx.from.id) } }) : null;
  }

  async function greet(ctx: Context) {
    const user = await findUser(ctx);
    const memberships = user
      ? await prisma.membership.findMany({
          where: { userId: user.id, isActive: true, org: { status: "ACTIVE" } },
          include: { org: true },
        })
      : [];

    if (user && memberships.length > 0) {
      const lines = memberships.map((m) => `${escapeHtml(m.org.name)} — ${ROLE_TEXT[m.role]}`);
      await ctx.reply(`Assalomu alaykum, ${escapeHtml(user.fullName)}.\n\n${lines.join("\n")}`, { ...html, ...appKeyboard });
      return;
    }

    await ctx.reply(
      [
        "Assalomu alaykum. Bu bot mahalla raislariga qo'ng'iroqlarni tashkil qilish uchun.",
        "",
        "Xodim bo'lsangiz — boshlig'ingizdan taklif havolasini so'rang.",
        "Tashkilotingizni ro'yxatdan o'tkazmoqchi bo'lsangiz — quyidagi tugmani bosing.",
      ].join("\n"),
      Markup.inlineKeyboard([Markup.button.callback("Tashkilot ochish", "org:new")]),
    );
  }

  bot.start(async (ctx) => {
    // Web App tugmalari faqat shaxsiy chatda ishlaydi; guruhdagi /start e'tiborsiz qoldiriladi
    if (!isPrivate(ctx)) return;
    const code = ctx.startPayload;
    if (!code) return greet(ctx);

    try {
      const { user, org, role } = await acceptInvite(code, ctx.from as TelegramProfile);
      await ctx.reply(
        `Xush kelibsiz, ${escapeHtml(user.fullName)}.\nSiz <b>${escapeHtml(org.name)}</b> tashkilotiga ${ROLE_TEXT[role]} sifatida qo'shildingiz.\n\nIsmingizni ilovada o'zgartirishingiz mumkin.`,
        { ...html, ...appKeyboard },
      );
    } catch (err) {
      if (err instanceof DomainError) await ctx.reply(err.message);
      else throw err;
    }
  });

  // --- Yangi tashkilot ochish ---

  bot.action("org:new", async (ctx) => {
    await ctx.answerCbQuery();
    awaitingOrgName.set(ctx.from.id, Date.now());
    await ctx.reply("Tashkilot nomini yozing.\nMasalan: Yangihayot tumani MFY uyushmasi", Markup.forceReply());
  });

  bot.on("text", async (ctx, next) => {
    const startedAt = awaitingOrgName.get(ctx.from.id);
    if (!isPrivate(ctx) || !startedAt || ctx.message.text.startsWith("/")) return next();
    awaitingOrgName.delete(ctx.from.id);
    if (Date.now() - startedAt > AWAIT_TTL_MS) return greet(ctx);

    const name = ctx.message.text.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 120) {
      await ctx.reply("Nom 3–120 belgidan iborat bo'lishi kerak. Qaytadan urinib ko'ring: /start");
      return;
    }

    try {
      const { org, user, autoApproved } = await requestOrganization(ctx.from as TelegramProfile, name);
      if (autoApproved) {
        await ctx.reply(`<b>${escapeHtml(org.name)}</b> yaratildi. Siz boshliq va platforma egasisiz.`, { ...html, ...appKeyboard });
        return;
      }
      await ctx.reply("So'rovingiz yuborildi. Tasdiqlangach shu yerda xabar olasiz.");

      const owners = await prisma.user.findMany({ where: { isPlatformOwner: true, telegramId: { not: null } } });
      const who = `${escapeHtml(user.fullName)}${user.username ? ` (@${escapeHtml(user.username)})` : ""}`;
      for (const owner of owners) {
        await bot.telegram
          .sendMessage(String(owner.telegramId), `Yangi tashkilot so'rovi:\n<b>${escapeHtml(org.name)}</b>\nSo'rovchi: ${who}`, {
            ...html,
            ...Markup.inlineKeyboard([
              Markup.button.callback("Tasdiqlash", `org:ok:${org.id}`),
              Markup.button.callback("Rad etish", `org:no:${org.id}`),
            ]),
          })
          .catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof DomainError) await ctx.reply(err.message);
      else throw err;
    }
  });

  // --- Platforma egasi: so'rovlarni tasdiqlash va tashkilotlar ro'yxati ---

  async function requireOwner(ctx: Context) {
    const user = await findUser(ctx);
    return user?.isPlatformOwner ? user : null;
  }

  bot.action(/^org:(ok|no):(.+)$/, async (ctx) => {
    if (!(await requireOwner(ctx))) return ctx.answerCbQuery("Faqat platforma egasi uchun");
    const [, decision, orgId] = ctx.match;
    try {
      const { org, requester } = await decideOrganization(orgId!, decision === "ok");
      await ctx.answerCbQuery(decision === "ok" ? "Tasdiqlandi" : "Rad etildi");
      await ctx.editMessageText(`<b>${escapeHtml(org.name)}</b> — ${ORG_STATUS_TEXT[org.status]}`, html);
      if (requester?.telegramId) {
        const text =
          decision === "ok"
            ? `<b>${escapeHtml(org.name)}</b> tasdiqlandi. Siz boshliqsiz — ilovada MFY'lar va xodimlarni qo'shing.`
            : `<b>${escapeHtml(org.name)}</b> so'rovi rad etildi.`;
        await bot.telegram
          .sendMessage(String(requester.telegramId), text, { ...html, ...(decision === "ok" ? appKeyboard : {}) })
          .catch(() => undefined);
      }
    } catch (err) {
      await ctx.answerCbQuery(err instanceof DomainError ? err.message : "Xatolik");
    }
  });

  bot.command("tashkilotlar", async (ctx) => {
    if (!isPrivate(ctx) || !(await requireOwner(ctx))) return;
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "asc" },
      take: 30,
      include: { _count: { select: { memberships: { where: { isActive: true } }, mahallas: { where: { isActive: true } } } } },
    });
    if (orgs.length === 0) return ctx.reply("Hali tashkilot yo'q.");

    const lines = orgs.map(
      (o, i) => `${i + 1}. <b>${escapeHtml(o.name)}</b> — ${ORG_STATUS_TEXT[o.status]}, ${o._count.memberships} a'zo, ${o._count.mahallas} MFY`,
    );
    const buttons = orgs
      .filter((o) => o.status === "ACTIVE")
      .map((o, i) => [Markup.button.callback(`${i + 1}. Boshliq taklifi`, `org:boss:${o.id}`)]);
    await ctx.reply(lines.join("\n"), { ...html, ...Markup.inlineKeyboard(buttons) });
  });

  bot.action(/^org:boss:(.+)$/, async (ctx) => {
    const owner = await requireOwner(ctx);
    if (!owner) return ctx.answerCbQuery("Faqat platforma egasi uchun");
    const org = await prisma.organization.findUnique({ where: { id: ctx.match[1]! } });
    if (!org || org.status !== "ACTIVE") return ctx.answerCbQuery("Tashkilot faol emas");
    const invite = await createInvite(org.id, "BOSS", owner.id);
    await ctx.answerCbQuery();
    await ctx.reply(
      `<b>${escapeHtml(org.name)}</b> uchun boshliq taklifi (bir martalik, 14 kun amal qiladi):\n${inviteLink(invite.code)}`,
      html,
    );
  });

  // --- Guruh ---

  // Bot guruhga qo'shilganda — qanday ulashni tushuntiradi
  bot.on("my_chat_member", async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (isGroup(ctx) && (status === "member" || status === "administrator")) {
      await ctx.reply("Natijalar shu guruhga yuborilishi uchun boshliq /ulash buyrug'ini yozsin.");
    }
  });

  async function bossOrgs(ctx: Context) {
    const user = await findUser(ctx);
    if (!user) return [];
    return prisma.organization.findMany({
      where: { status: "ACTIVE", memberships: { some: { userId: user.id, role: "BOSS", isActive: true } } },
    });
  }

  async function bindGroup(ctx: Context, orgId: string) {
    const org = await prisma.organization.update({ where: { id: orgId }, data: { groupChatId: String(ctx.chat!.id) } });
    await ctx.reply(`Guruh <b>${escapeHtml(org.name)}</b>ga ulandi. Qo'ng'iroq natijalari va yakuniy hisobotlar shu yerga yuboriladi.`, html);
  }

  bot.command("ulash", async (ctx) => {
    if (!isGroup(ctx)) {
      await ctx.reply("Bu buyruq guruhda ishlatiladi: botni guruhga qo'shing va o'sha yerda /ulash yozing.");
      return;
    }
    const orgs = await bossOrgs(ctx);
    if (orgs.length === 0) return ctx.reply("Guruhni faqat tashkilot boshlig'i ulay oladi.");
    if (orgs.length === 1) return bindGroup(ctx, orgs[0]!.id);
    await ctx.reply(
      "Qaysi tashkilot uchun?",
      Markup.inlineKeyboard(orgs.map((o) => [Markup.button.callback(o.name, `grp:bind:${o.id}`)])),
    );
  });

  bot.action(/^grp:bind:(.+)$/, async (ctx) => {
    const orgs = await bossOrgs(ctx);
    const org = orgs.find((o) => o.id === ctx.match[1]);
    if (!org || !isGroup(ctx)) return ctx.answerCbQuery("Faqat shu tashkilot boshlig'i uchun");
    await ctx.answerCbQuery();
    await ctx.deleteMessage().catch(() => undefined);
    await bindGroup(ctx, org.id);
  });

  bot.command("uzish", async (ctx) => {
    if (!isGroup(ctx)) return;
    const orgs = await bossOrgs(ctx);
    const bound = orgs.filter((o) => o.groupChatId === String(ctx.chat.id));
    if (bound.length === 0) return ctx.reply("Bu guruh sizning tashkilotingizga ulanmagan.");
    await prisma.organization.updateMany({ where: { id: { in: bound.map((o) => o.id) } }, data: { groupChatId: null } });
    await ctx.reply("Guruh uzildi. Endi bu yerga xabar yuborilmaydi.");
  });

  // Handler ichidagi xato (masalan, DB uzilishi) butun botni to'xtatib qo'ymasligi uchun
  bot.catch((err, ctx) => {
    console.error(`Bot xatosi (update ${ctx.update.update_id}):`, err);
  });

  return bot;
}

// Telegram'dagi buyruqlar menyusi va Mini App tugmasi — BotFather'da qo'lda sozlash shart emas
export async function configureBotUi(bot: Telegraf, appUrl: string) {
  await bot.telegram.setMyCommands([{ command: "start", description: "Boshlash" }], { scope: { type: "all_private_chats" } });
  await bot.telegram.setMyCommands(
    [
      { command: "ulash", description: "Natijalarni shu guruhga yuborish" },
      { command: "uzish", description: "Guruhni uzish" },
    ],
    { scope: { type: "all_chat_administrators" } },
  );
  if (appUrl.startsWith("https://")) {
    await bot.telegram.setChatMenuButton({ menuButton: { type: "web_app", text: "Ilova", web_app: { url: appUrl } } });
  }
}
