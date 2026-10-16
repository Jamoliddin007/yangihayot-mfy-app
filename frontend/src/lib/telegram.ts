// index.html'dagi rasmiy telegram-web-app.js beradigan obyekt.
// Avval @telegram-apps/sdk ishlatilgan edi, lekin undan faqat initData olinardi —
// bu ma'lumot shu global obyektda allaqachon bor, ortiqcha paket bundle'ni og'irlashtirardi.

type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotification = "error" | "success" | "warning";

interface TelegramWebApp {
  initData: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: "themeChanged", cb: () => void): void;
  showConfirm?(message: string, cb: (ok: boolean) => void): void;
  HapticFeedback?: {
    impactOccurred(style: HapticImpact): void;
    notificationOccurred(type: HapticNotification): void;
  };
  isVersionAtLeast?(version: string): boolean;
}

export const tg: TelegramWebApp | undefined = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
  ?.WebApp;

// Telegram tashqarisida skript yuklanadi, lekin initData bo'sh bo'ladi
export function getInitDataRaw(): string | null {
  return tg?.initData || null;
}

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  const applyTheme = () => {
    document.documentElement.style.colorScheme = tg.colorScheme;
    tg.setHeaderColor?.("bg_color");
    tg.setBackgroundColor?.("secondary_bg_color");
  };
  applyTheme();
  tg.onEvent?.("themeChanged", applyTheme);
}

export const haptic = {
  tap: () => tg?.HapticFeedback?.impactOccurred("light"),
  success: () => tg?.HapticFeedback?.notificationOccurred("success"),
  error: () => tg?.HapticFeedback?.notificationOccurred("error"),
};

// Telegram'ning native tasdiqlash oynasi; Telegram tashqarisida brauzer confirm()
export function confirmAction(message: string): Promise<boolean> {
  if (tg?.showConfirm && tg.isVersionAtLeast?.("6.2")) {
    return new Promise((resolve) => tg.showConfirm!(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}
