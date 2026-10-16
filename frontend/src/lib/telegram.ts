// index.html'dagi rasmiy telegram-web-app.js beradigan obyekt.

type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotification = "error" | "success" | "warning";

interface NativeButton {
  setParams(params: { text?: string; is_active?: boolean; is_visible?: boolean; color?: string; text_color?: string }): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  initData: string;
  version: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  onEvent?(event: "themeChanged", cb: () => void): void;
  showConfirm?(message: string, cb: (ok: boolean) => void): void;
  isVersionAtLeast?(version: string): boolean;
  openTelegramLink?(url: string): void;
  HapticFeedback?: {
    impactOccurred(style: HapticImpact): void;
    notificationOccurred(type: HapticNotification): void;
    selectionChanged(): void;
  };
  MainButton?: NativeButton;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
}

export const tg: TelegramWebApp | undefined = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram
  ?.WebApp;

// Telegram tashqarisida skript yuklanadi, lekin initData bo'sh bo'ladi
export function getInitDataRaw(): string | null {
  return tg?.initData || null;
}

export const insideTelegram = !!getInitDataRaw();

const atLeast = (version: string) => !!tg?.isVersionAtLeast?.(version);

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  // Ro'yxatni pastga aylantirganda ilova yopilib ketmasligi uchun
  if (atLeast("7.7")) tg.disableVerticalSwipes?.();
  const applyTheme = () => {
    document.documentElement.style.colorScheme = tg.colorScheme;
    tg.setHeaderColor?.("secondary_bg_color");
    tg.setBackgroundColor?.("secondary_bg_color");
  };
  applyTheme();
  tg.onEvent?.("themeChanged", applyTheme);
}

export const haptic = {
  tap: () => tg?.HapticFeedback?.impactOccurred("light"),
  select: () => tg?.HapticFeedback?.selectionChanged(),
  success: () => tg?.HapticFeedback?.notificationOccurred("success"),
  warning: () => tg?.HapticFeedback?.notificationOccurred("warning"),
  error: () => tg?.HapticFeedback?.notificationOccurred("error"),
};

// Telegram'ning native tasdiqlash oynasi; Telegram tashqarisida brauzer confirm()
export function confirmAction(message: string): Promise<boolean> {
  if (tg?.showConfirm && atLeast("6.2")) {
    return new Promise((resolve) => tg.showConfirm!(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

// Native tugmalar faqat Telegram ichida (6.1+) ishlatiladi; tashqarida oddiy HTML tugma chiqadi
export const nativeMainButton = insideTelegram && atLeast("6.1") ? tg!.MainButton : undefined;
export const nativeBackButton = insideTelegram && atLeast("6.1") ? tg!.BackButton : undefined;

// Taklif havolasini Telegram'ning "kimga yuborish" oynasi orqali ulashish
export function shareViaTelegram(url: string, text: string): boolean {
  if (!insideTelegram || !tg?.openTelegramLink) return false;
  tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
  return true;
}
