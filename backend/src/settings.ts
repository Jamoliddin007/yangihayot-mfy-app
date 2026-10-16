import { prisma } from "./db.js";

const GROUP_CHAT_KEY = "group_chat_id";

// Bitta jarayon ishlaydi — xotirada keshlash yetarli (har xabarda DB'ga borilmaydi)
let groupChatId: string | null | undefined;

// Guruh boshliqning /ulash buyrug'i bilan DB'ga yoziladi; .env'dagi GROUP_CHAT_ID — eski usul, zaxira sifatida
export async function getGroupChatId(): Promise<string | null> {
  if (groupChatId === undefined) {
    const row = await prisma.setting.findUnique({ where: { key: GROUP_CHAT_KEY } });
    groupChatId = row?.value || process.env.GROUP_CHAT_ID || null;
  }
  return groupChatId;
}

export async function setGroupChatId(chatId: string) {
  await prisma.setting.upsert({
    where: { key: GROUP_CHAT_KEY },
    create: { key: GROUP_CHAT_KEY, value: chatId },
    update: { value: chatId },
  });
  groupChatId = chatId;
}
