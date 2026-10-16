import type { CallStatus } from "@prisma/client";

// Guruhga boradigan xabarlar matni. Telegram HTML rejimida ishlatiladi.

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Tashkent",
  hour: "2-digit",
  minute: "2-digit",
});

export const STATUS_TEXT: Record<CallStatus, string> = {
  PENDING: "Qo'ng'iroq qilinmagan",
  IN_PROGRESS: "Qo'ng'iroq qilinmoqda",
  REACHED: "Bog'landi",
  NO_ANSWER: "Ko'tarmadi",
  PHONE_OFF: "Telefon o'chiq",
};

interface ResultMessageInput {
  status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">;
  mahallaName: string;
  chairmanName: string;
  employeeName: string;
  reached: number;
  total: number;
  at: Date;
}

export function resultMessage(input: ResultMessageInput) {
  return [
    `<b>${STATUS_TEXT[input.status]}</b> — ${escapeHtml(input.mahallaName)} MFY`,
    `Rais: ${escapeHtml(input.chairmanName)}`,
    `Xodim: ${escapeHtml(input.employeeName)}, ${timeFormat.format(input.at)}`,
    `Jami bog'lanildi: ${input.reached} / ${input.total}`,
  ].join("\n");
}

interface ReportTask {
  status: CallStatus;
  mahalla: { name: string };
  assignedTo: { fullName: string } | null;
}

export function finalReportMessage(title: string, tasks: ReportTask[]) {
  const reached = tasks.filter((t) => t.status === "REACHED").length;
  const noAnswer = tasks.filter((t) => t.status === "NO_ANSWER").length;
  const phoneOff = tasks.filter((t) => t.status === "PHONE_OFF").length;

  const byEmployee = new Map<string, ReportTask[]>();
  for (const task of tasks) {
    const name = task.assignedTo?.fullName ?? "Biriktirilmagan";
    byEmployee.set(name, [...(byEmployee.get(name) ?? []), task]);
  }

  const lines = [`<b>Topshiriq yakunlandi</b>`, escapeHtml(title), "", `Bog'lanildi: <b>${reached} / ${tasks.length}</b>`];
  if (noAnswer || phoneOff) lines.push(`Ko'tarmadi: ${noAnswer}, telefon o'chiq: ${phoneOff}`);

  // Har bir xodim: natijasi va ostida bog'lanilmagan MFY'lari — kim nimani qilmagani bir qarashda ko'rinadi
  for (const [name, own] of byEmployee) {
    const ownReached = own.filter((t) => t.status === "REACHED").length;
    lines.push("", `<b>${escapeHtml(name)}</b> — ${ownReached} / ${own.length}`);
    for (const task of own.filter((t) => t.status !== "REACHED")) {
      lines.push(`  ${escapeHtml(task.mahalla.name)} — ${STATUS_TEXT[task.status].toLowerCase()}`);
    }
  }

  return lines.join("\n");
}
