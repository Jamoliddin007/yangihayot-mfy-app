import { Markup, Telegraf, type Context } from "telegraf";
import { prisma } from "./db.js";
import { escapeHtml } from "./messages.js";
import {
  DomainError,
  INVITE_TTL_DAYS,
  acceptInvite,
  createInvite,
  decideOrganization,
  inviteLink,
  requestOrganization,
  type TelegramProfile,
} from "./orgService.js";

const ROLE_TEXT = { BOSS: "boshliq", EMPLOYEE: "xodim" } as const;
const ORG_STATUS_TEXT = { PENDING: "kutilmoqda", ACTIVE: "faol", SUSPENDED: "to'xtatilgan", REJECTED: "rad etilgan" } as const;

// Ro'yxatdan o'tayotgan boshliqlar: qaysi qadamda (bitta jarayon — xotira yetarli; 15 daqiqadan keyin eskiradi)
type Registration = { step: "name"; at: number } | { step: "phone"; name: string; at: number };
const registration = new Map<number, Registration>();
const REGISTRATION_TTL_MS = 15 * 60 * 1000;

// Telegram kontaktida raqam "998901234567" yoki "+998..." ko'rinishida keladi
function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length === 9 ? `+998${digits}` : `+${digits}`;
}

const html = { parse_mode: "HTML" as const, link_preview_options: { is_disabled: true } };

export function createBot(token: string, appUrl: string) {
  const bot = new Telegraf(token);
  // Web App tugmasi faqat HTTPS manzil bilan ishlaydi (lokal sinovda tugma chiqmaydi)
  const appRow = appUrl.startsWith("https://") ? [[Markup.button.webApp("Ilovani ochish", appUrl)]] : [];

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
      const isBoss = memberships.some((m) => m.role === "BOSS");
      const buttons = [
        ...appRow,
        ...(isBoss ? [[Markup.button.callback("Xodim uchun havola", "inv:emp")]] : []),
      ];
      await ctx.reply(`Assalomu alaykum, ${escapeHtml(user.fullName)}.\n\n${lines.join("\n")}`, { ...html, ...Markup.inlineKeyboard(buttons) });
      return;
    }

    const pending = user ? await prisma.organization.findFirst({ where: { requestedById: user.id, status: "PENDING" } }) : null;
    if (pending) {
      await ctx.reply(
        `<b>${escapeHtml(pending.name)}</b> bo'yicha so'rovingiz ko'rib chiqilmoqda. Tasdiqlangach shu yerda xabar olasiz.`,
        html,
      );
      return;
    }

    await ctx.reply(
      [
        "Assalomu alaykum. Bu bot mahalla raislariga qo'ng'iroqlarni tashkil qilish uchun.",
        "",
        "<b>Xodim</b> bo'lsangiz — boshlig'ingizdan taklif havolasini so'rang.",
        "<b>Boshliq</b> bo'lsangiz — ro'yxatdan o'ting. So'rovingiz ko'rib chiqilib, siz bilan bog'lanamiz.",
      ].join("\n"),
      { ...html, ...Markup.inlineKeyboard([Markup.button.callback("Boshliq sifatida ro'yxatdan o'tish", "org:new")]) },
    );
  }

  bot.start(async (ctx) => {
    // Web App tugmalari faqat shaxsiy chatda ishlaydi; guruhdagi /start e'tiborsiz qoldiriladi
    if (!isPrivate(ctx)) return;
    registration.delete(ctx.from.id);
    const code = ctx.startPayload;
    if (!code) return greet(ctx);

    try {
      const { user, org, role } = await acceptInvite(code, ctx.from as TelegramProfile);
      const buttons = [
        ...appRow,
        ...(role === "BOSS" ? [[Markup.button.callback("Xodim uchun havola", "inv:emp")]] : []),
      ];
      await ctx.reply(
        `Xush kelibsiz, ${escapeHtml(user.fullName)}.\nSiz <b>${escapeHtml(org.name)}</b> tashkilotiga ${ROLE_TEXT[role]} sifatida qo'shildingiz.\n\nIsmingizni ilovada o'zgartirishingiz mumkin.`,
        { ...html, ...Markup.inlineKeyboard(buttons) },
      );
    } catch (err) {
      if (err instanceof DomainError) await ctx.reply(err.message);
      else throw err;
    }
  });

  // --- Boshliqni ro'yxatdan o'tkazish: tashkilot nomi → telefon → platforma egasiga so'rov ---

  bot.action("org:new", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isPrivate(ctx)) return;
    registration.set(ctx.from.id, { step: "name", at: Date.now() });
    await ctx.reply("Tashkilotingiz nomini yozing.\nMasalan: Yangihayot tumani MFY uyushmasi", Markup.forceReply());
  });

  function activeRegistration(ctx: Context) {
    if (!ctx.from || !isPrivate(ctx)) return null;
    const state = registration.get(ctx.from.id);
    if (!state) return null;
    if (Date.now() - state.at > REGISTRATION_TTL_MS) {
      registration.delete(ctx.from.id);
      return null;
    }
    return state;
  }

  const phoneKeyboard = Markup.keyboard([Markup.button.contactRequest("Raqamni yuborish")]).oneTime().resize();

  async function submitRegistration(ctx: Context, name: string, phone: string) {
    registration.delete(ctx.from!.id);
    try {
      const { org, user, autoApproved } = await requestOrganization(ctx.from as TelegramProfile, name, phone);
      if (autoApproved) {
        await ctx.reply(`<b>${escapeHtml(org.name)}</b> yaratildi. Siz boshliq va platforma egasisiz.`, { ...html, ...Markup.removeKeyboard() });
        return;
      }
      await ctx.reply(
        `So'rovingiz yuborildi: <b>${escapeHtml(org.name)}</b>.\nShartnoma bo'yicha siz bilan ${escapeHtml(phone)} raqami orqali bog'lanamiz. Tasdiqlangach shu yerda xabar olasiz.`,
        { ...html, ...Markup.removeKeyboard() },
      );

      const owners = await prisma.user.findMany({ where: { isPlatformOwner: true, telegramId: { not: null } } });
      const text = [
        "<b>Yangi boshliq ro'yxatdan o'tdi</b>",
        `Tashkilot: <b>${escapeHtml(org.name)}</b>`,
        `Boshliq: ${escapeHtml(user.fullName)}${user.username ? ` (@${escapeHtml(user.username)})` : ""}`,
        `Telefon: ${escapeHtml(phone)}`,
        "",
        "Shartnoma kelishilgach tasdiqlang. Shundan keyin u xodimlarini taklif qila oladi.",
      ].join("\n");
      for (const owner of owners) {
        await bot.telegram
          .sendMessage(String(owner.telegramId), text, {
            ...html,
            ...Markup.inlineKeyboard([
              Markup.button.callback("Tasdiqlash", `org:ok:${org.id}`),
              Markup.button.callback("Rad etish", `org:no:${org.id}`),
            ]),
          })
          .catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof DomainError) await ctx.reply(err.message, Markup.removeKeyboard());
      else throw err;
    }
  }

  bot.on("contact", async (ctx, next) => {
    const state = activeRegistration(ctx);
    if (!state || state.step !== "phone") return next();
    // Faqat o'z raqami (boshqa odamning kontaktini yuborib bo'lmaydi)
    if (ctx.message.contact.user_id !== ctx.from.id) {
      await ctx.reply("Iltimos, pastdagi tugma orqali o'z raqamingizni yuboring.", phoneKeyboard);
      return;
    }
    await submitRegistration(ctx, state.name, normalizePhone(ctx.message.contact.phone_number));
  });

  bot.on("text", async (ctx, next) => {
    const state = activeRegistration(ctx);
    if (!state || ctx.message.text.startsWith("/")) return next();

    if (state.step === "name") {
      const name = ctx.message.text.trim().replace(/\s+/g, " ");
      if (name.length < 3 || name.length > 120) {
        await ctx.reply("Nom 3–120 belgidan iborat bo'lishi kerak. Qaytadan yozing.", Markup.forceReply());
        return;
      }
      registration.set(ctx.from.id, { step: "phone", name, at: Date.now() });
      await ctx.reply("Telefon raqamingizni yuboring — shartnoma bo'yicha siz bilan bog'lanamiz.", phoneKeyboard);
      return;
    }

    // Raqamni qo'lda yozsa ham qabul qilinadi
    const digits = ctx.message.text.replace(/[^\d]/g, "");
    if (digits.length < 9 || digits.length > 15) {
      await ctx.reply("Raqam noto'g'ri. Pastdagi «Raqamni yuborish» tugmasini bosing yoki +998901234567 ko'rinishida yozing.", phoneKeyboard);
      return;
    }
    await submitRegistration(ctx, state.name, normalizePhone(digits));
  });

  // --- Boshliq: xodim uchun bir martalik havola (botning o'zidan, ilovaga kirmasdan) ---

  async function sendEmployeeInvite(ctx: Context, orgId: string, createdById: string) {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const invite = await createInvite(org.id, "EMPLOYEE", createdById);
    const link = inviteLink(invite.code);
    const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`${org.name}: xodim sifatida qo'shilish uchun havola`)}`;
    await ctx.reply(
      [
        `<b>${escapeHtml(org.name)}</b> — xodim uchun havola:`,
        link,
        "",
        `Bitta xodim uchun, ${INVITE_TTL_DAYS} kun amal qiladi. Har bir xodimga alohida havola oling.`,
      ].join("\n"),
      {
        ...html,
        ...Markup.inlineKeyboard([[Markup.button.url("Xodimga yuborish", share)], [Markup.button.callback("Yana havola", "inv:emp")]]),
      },
    );
  }

  async function handleEmployeeInvite(ctx: Context) {
    if (!isPrivate(ctx)) return;
    const user = await findUser(ctx);
    const orgs = await bossOrgs(ctx);
    if (!user || orgs.length === 0) {
      await ctx.reply("Xodimlarni faqat tasdiqlangan tashkilot boshlig'i taklif qila oladi.");
      return;
    }
    if (orgs.length === 1) return sendEmployeeInvite(ctx, orgs[0]!.id, user.id);
    await ctx.reply("Qaysi tashkilot uchun?", Markup.inlineKeyboard(orgs.map((o) => [Markup.button.callback(o.name, `inv:emp:${o.id}`)])));
  }

  bot.command("havola", handleEmployeeInvite);
  bot.action("inv:emp", async (ctx) => {
    await ctx.answerCbQuery();
    await handleEmployeeInvite(ctx);
  });
  bot.action(/^inv:emp:(.+)$/, async (ctx) => {
    const user = await findUser(ctx);
    const org = (await bossOrgs(ctx)).find((o) => o.id === ctx.match[1]);
    if (!user || !org) return ctx.answerCbQuery("Faqat shu tashkilot boshlig'i uchun");
    await ctx.answerCbQuery();
    await sendEmployeeInvite(ctx, org.id, user.id);
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
            ? [
                `<b>${escapeHtml(org.name)}</b> tasdiqlandi. Siz boshliqsiz.`,
                "",
                "1. Ilovada «MFY'lar» bo'limida MFY ro'yxatini Excel'dan yuklang.",
                "2. Har bir xodimingizga havola yuboring («Xodim uchun havola» tugmasi yoki /havola).",
                "3. Xodimlar MFY'larni o'zaro bo'lishib oladi.",
                "4. Natijalar guruhga borishi uchun botni guruhga qo'shing va u yerda /ulash yozing.",
              ].join("\n")
            : `<b>${escapeHtml(org.name)}</b> so'rovi rad etildi.`;
        const buttons = [
          ...appRow,
          [Markup.button.callback("Xodim uchun havola", "inv:emp")],
        ];
        await bot.telegram
          .sendMessage(String(requester.telegramId), text, { ...html, ...(decision === "ok" ? Markup.inlineKeyboard(buttons) : {}) })
          .catch(() => undefined);
      }
    } catch (err) {
      await ctx.answerCbQuery(err instanceof DomainError ? err.message : "Xatolik");
    }
  });

  bot.command("tashkilotlar", async (ctx) => {
    if (!isPrivate(ctx) || !(await requireOwner(ctx))) return;
    const orgs = await prisma.organization.findMany({
      where: { status: { not: "REJECTED" } },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: {
        requestedBy: true,
        _count: { select: { memberships: { where: { isActive: true } }, mahallas: { where: { isActive: true } } } },
      },
    });
    if (orgs.length === 0) return ctx.reply("Hali tashkilot yo'q.");

    const lines = orgs.map((o, i) => {
      const line = `${i + 1}. <b>${escapeHtml(o.name)}</b> — ${ORG_STATUS_TEXT[o.status]}, ${o._count.memberships} a'zo, ${o._count.mahallas} MFY`;
      if (o.status !== "PENDING" || !o.requestedBy) return line;
      const who = [o.requestedBy.fullName, o.requestedBy.username && `@${o.requestedBy.username}`, o.requestedBy.phone].filter(Boolean).join(", ");
      return `${line}\n    So'rovchi: ${escapeHtml(who)}`;
    });
    // Kutilayotgan so'rovni shu yerdan ham tasdiqlash mumkin (dastlabki xabar yo'qolgan bo'lsa)
    const buttons = orgs.flatMap((o, i) =>
      o.status === "PENDING"
        ? [[Markup.button.callback(`${i + 1}. Tasdiqlash`, `org:ok:${o.id}`), Markup.button.callback("Rad etish", `org:no:${o.id}`)]]
        : o.status === "ACTIVE"
          ? [[Markup.button.callback(`${i + 1}. Boshliq taklifi`, `org:boss:${o.id}`)]]
          : [],
    );
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
  await bot.telegram.setMyCommands(
    [
      { command: "start", description: "Boshlash" },
      { command: "havola", description: "Xodim uchun taklif havolasi (boshliq)" },
    ],
    { scope: { type: "all_private_chats" } },
  );
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
