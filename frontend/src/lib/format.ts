const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dayDiff(date: Date, now = new Date()) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

// "Bugun, 14:00" / "Ertaga, 14:00" / "Juma, 17-oktabr, 14:00"
export function formatSchedule(iso: string) {
  const date = new Date(iso);
  const diff = dayDiff(date);
  const time = formatClock(date);
  if (diff === 0) return `Bugun, ${time}`;
  if (diff === 1) return `Ertaga, ${time}`;
  if (diff === -1) return `Kecha, ${time}`;
  const weekday = WEEKDAYS[date.getDay()]!;
  return `${weekday[0]!.toUpperCase()}${weekday.slice(1)}, ${date.getDate()}-${MONTHS[date.getMonth()]}, ${time}`;
}

export function formatDay(iso: string) {
  const date = new Date(iso);
  return `${date.getDate()}-${MONTHS[date.getMonth()]}`;
}

// <input type="date"> uchun YYYY-MM-DD (mahalliy vaqt bo'yicha)
export function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
