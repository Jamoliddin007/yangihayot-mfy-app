import { retrieveLaunchParams } from "@telegram-apps/sdk";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function getInitDataRaw(): string | null {
  try {
    const { initDataRaw } = retrieveLaunchParams();
    return initDataRaw ? String(initDataRaw) : null;
  } catch {
    return null;
  }
}

// Faqat development uchun: Telegram tashqarisida (brauzerda) sinash imkonini beradi.
// Backendda NODE_ENV=production bo'lsa bu header e'tiborga olinmaydi.
export function getDevTelegramId(): string | null {
  return localStorage.getItem("dev_telegram_id");
}

export function setDevTelegramId(id: string) {
  localStorage.setItem("dev_telegram_id", id);
}

export function clearDevTelegramId() {
  localStorage.removeItem("dev_telegram_id");
}

function buildHeaders(isFormData: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";

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
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...buildHeaders(isFormData), ...(options.headers as Record<string, string> | undefined) },
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
