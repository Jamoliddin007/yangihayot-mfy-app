import type { CallStatus, CampaignKind } from "@prisma/client";

// Telegram'ga boradigan xabarlar matni (HTML rejimi). Vaqtlar tashkilotning o'z vaqt mintaqasida.

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const STATUS_TEXT: Record<CallStatus, string> = {
  PENDING: "Qo'ng'iroq qilinmagan",
  IN_PROGRESS: "Qo'ng'iroq qilinmoqda",
  REACHED: "Bog'landi",
  NO_ANSWER: "Ko'tarmadi",
  PHONE_OFF: "Telefon o'chiq",
};

export const KIND_TEXT: Record<CampaignKind, string> = {
  MEETING: "Yig'ilish",
  EVENT: "Tadbir",
  OTHER: "Topshiriq",
};

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const get = (type: string) => Number(fmt.formatToParts(date).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

export function formatTime(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

// "17-oktabr, 14:00" (o'zbek oy nomlari ICU'ga bog'liq bo'lmasligi uchun qo'lda)
export function formatDateTime(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  return `${p.day}-${MONTHS[p.month - 1]}, ${formatTime(date, timeZone)}`;
}

export interface CampaignInfo {
  kind: CampaignKind;
  title: string;
  description?: string | null;
  scheduledAt?: Date | null;
  location?: string | null;
}

// "Yig'ilish: Hokimiyatda yig'ilish · 17-oktabr, 14:00 · Hokimiyat binosi"
export function campaignLine(c: CampaignInfo, timeZone: string) {
  const bits = [`${KIND_TEXT[c.kind]}: ${escapeHtml(c.title)}`];
  if (c.scheduledAt) bits.push(formatDateTime(c.scheduledAt, timeZone));
  if (c.location) bits.push(escapeHtml(c.location));
  return bits.join(" · ");
}

interface ResultMessageInput {
  status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">;
  mahallaName: string;
  chairmanName: string;
  callerName: string;
  // Mas'ul boshqa xodim bo'lsa — "Ramazon (Diyorbek o'rniga)"
  assigneeName?: string | null;
  note?: string | null;
  reached: number;
  total: number;
  at: Date;
  timeZone: string;
}

export function resultMessage(input: ResultMessageInput) {
  const caller =
    input.assigneeName && input.assigneeName !== input.callerName
      ? `${escapeHtml(input.callerName)} (${escapeHtml(input.assigneeName)} o'rniga)`
      : escapeHtml(input.callerName);
  const lines = [
    `<b>${STATUS_TEXT[input.status]}</b> — ${escapeHtml(input.mahallaName)} MFY`,
    `Rais: ${escapeHtml(input.chairmanName)}`,
    `Xodim: ${caller}, ${formatTime(input.at, input.timeZone)}`,
  ];
  if (input.note) lines.push(`Izoh: ${escapeHtml(input.note)}`);
  lines.push(`Jami bog'lanildi: ${input.reached} / ${input.total}`);
  return lines.join("\n");
}

interface ReportTask {
  status: CallStatus;
  note?: string | null;
  mahalla: { name: string };
  assignedTo: { id: string; fullName: string } | null;
  calledBy?: { id: string; fullName: string } | null;
}

export function finalReportMessage(campaign: CampaignInfo, tasks: ReportTask[], timeZone: string) {
  const reached = tasks.filter((t) => t.status === "REACHED").length;
  const noAnswer = tasks.filter((t) => t.status === "NO_ANSWER").length;
  const phoneOff = tasks.filter((t) => t.status === "PHONE_OFF").length;

  const byEmployee = new Map<string, ReportTask[]>();
  for (const task of tasks) {
    const name = task.assignedTo?.fullName ?? "Biriktirilmagan";
    byEmployee.set(name, [...(byEmployee.get(name) ?? []), task]);
  }

  const lines = [`<b>Yakunlandi</b>`, campaignLine(campaign, timeZone), "", `Bog'lanildi: <b>${reached} / ${tasks.length}</b>`];
  if (noAnswer || phoneOff) lines.push(`Ko'tarmadi: ${noAnswer}, telefon o'chiq: ${phoneOff}`);

  // Har bir xodim: natijasi va ostida bog'lanilmagan MFY'lari (izohi bilan) — kim nimani qilmagani bir qarashda
  for (const [name, own] of byEmployee) {
    const ownReached = own.filter((t) => t.status === "REACHED").length;
    lines.push("", `<b>${escapeHtml(name)}</b> — ${ownReached} / ${own.length}`);
    for (const task of own.filter((t) => t.status !== "REACHED")) {
      const note = task.note ? ` (${escapeHtml(task.note)})` : "";
      lines.push(`  ${escapeHtml(task.mahalla.name)} — ${STATUS_TEXT[task.status].toLowerCase()}${note}`);
    }
  }

  // Boshqa xodimga yordam berganlar
  const helped = new Map<string, number>();
  for (const task of tasks) {
    if (task.calledBy && task.assignedTo && task.calledBy.id !== task.assignedTo.id && task.status !== "PENDING") {
      helped.set(task.calledBy.fullName, (helped.get(task.calledBy.fullName) ?? 0) + 1);
    }
  }
  if (helped.size > 0) {
    lines.push("", "<b>Yordam berganlar</b>");
    for (const [name, count] of helped) lines.push(`${escapeHtml(name)} — ${count} ta MFY`);
  }

  return lines.join("\n");
}

// Xodimga shaxsiy xabar: yangi topshiriq berildi
//   <b>Yig'ilish: Hokimiyatda yig'ilish</b>
//   17-oktabr, 14:00 · Majlislar zali
export function newCampaignMessage(campaign: CampaignInfo, myCount: number, timeZone: string) {
  const lines = [`<b>${KIND_TEXT[campaign.kind]}: ${escapeHtml(campaign.title)}</b>`];
  const when = [campaign.scheduledAt && formatDateTime(campaign.scheduledAt, timeZone), campaign.location && escapeHtml(campaign.location)].filter(Boolean);
  if (when.length) lines.push(when.join(" · "));
  if (campaign.description) lines.push(escapeHtml(campaign.description));
  lines.push("", `Sizga ${myCount} ta MFY biriktirilgan. Raislarga qo'ng'iroq qilib xabar bering.`);
  return lines.join("\n");
}
