import { getInitDataRaw } from "./telegram";

export { getInitDataRaw };

// Bo'sh = same-origin: frontend backend'ning o'zidan (yoki Vite proxy orqali) beriladi
export const API_URL = import.meta.env.VITE_API_URL ?? "";

// Faqat development uchun: Telegram tashqarisida (brauzerda) sinash imkonini beradi.
// Backendda NODE_ENV=production bo'lsa bu header e'tiborga olinmaydi.
export function getDevTelegramId(): string | null {
  // Faqat `npm run dev`da: ?dev=<id> bilan to'g'ridan-to'g'ri kirish (avtomatik test va skrinshotlar uchun)
  if (import.meta.env.DEV) {
    const fromUrl = new URLSearchParams(window.location.search).get("dev");
    if (fromUrl) localStorage.setItem("dev_telegram_id", fromUrl);
  }
  return localStorage.getItem("dev_telegram_id");
}

export function setDevTelegramId(id: string) {
  localStorage.setItem("dev_telegram_id", id);
}

export function clearDevTelegramId() {
  localStorage.removeItem("dev_telegram_id");
}

// Tanlangan tashkilot: har bir so'rov shu tashkilot doirasida bajariladi (server a'zolikni tekshiradi)
let currentOrgId: string | null = null;
export function setCurrentOrg(orgId: string | null) {
  currentOrgId = orgId;
}
export function getCurrentOrg() {
  return currentOrgId;
}

function buildHeaders(hasJsonBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasJsonBody) headers["Content-Type"] = "application/json";
  if (currentOrgId) headers["x-org-id"] = currentOrgId;

  const initData = getInitDataRaw();
  if (initData) {
    headers["Authorization"] = `tma ${initData}`;
    return headers;
  }

  const devId = getDevTelegramId();
  if (devId) headers["x-dev-telegram-id"] = devId;
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const hasJsonBody = options.body !== undefined && !(options.body instanceof FormData);
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...buildHeaders(hasJsonBody), ...(options.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error ?? "So'rovda xatolik yuz berdi");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
    }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
