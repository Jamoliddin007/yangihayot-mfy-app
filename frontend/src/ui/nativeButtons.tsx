import { useEffect, useLayoutEffect, useRef } from "react";
import { haptic, nativeBackButton, nativeMainButton } from "../lib/telegram";

// Telegram'ning pastki asosiy tugmasi (MainButton) va "Orqaga" tugmasi bitta — lekin ularni
// bir nechta ekran/oyna ishlatmoqchi bo'ladi. Stek: oxirgi ochilgan (eng ustdagi) boshqaradi.

interface MainEntry {
  text: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

const mainStack: MainEntry[] = [];
let mainHandler: (() => void) | null = null;

function applyMain() {
  const button = nativeMainButton;
  if (!button) return;
  if (mainHandler) button.offClick(mainHandler);
  mainHandler = null;

  const top = mainStack[mainStack.length - 1];
  if (!top) {
    button.hideProgress();
    button.hide();
    return;
  }
  button.setParams({ text: top.text, is_active: !top.disabled && !top.loading, is_visible: true });
  if (top.loading) button.showProgress(false);
  else button.hideProgress();
  mainHandler = () => {
    if (top.disabled || top.loading) return;
    haptic.tap();
    top.onClick();
  };
  button.onClick(mainHandler);
}

interface PrimaryActionProps {
  text: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

// Telegram ichida — native pastki tugma; tashqarida (brauzerda test) — oddiy tugma
export function PrimaryAction({ text, onClick, active = true, disabled = false, loading = false }: PrimaryActionProps) {
  const entry = useRef<MainEntry>({ text, disabled, loading, onClick });
  // Har renderdan keyin eng so'nggi onClick (eski state'ni ushlab qolmasligi uchun)
  useLayoutEffect(() => {
    entry.current.onClick = onClick;
  });

  useEffect(() => {
    if (!active || !nativeMainButton) return;
    const current = entry.current;
    mainStack.push(current);
    applyMain();
    return () => {
      mainStack.splice(mainStack.indexOf(current), 1);
      applyMain();
    };
  }, [active]);

  useEffect(() => {
    Object.assign(entry.current, { text, disabled, loading });
    if (nativeMainButton && mainStack[mainStack.length - 1] === entry.current) applyMain();
  }, [text, disabled, loading]);

  if (nativeMainButton || !active) return null;
  return (
    <div className="px-3 pt-6">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="h-[50px] w-full rounded-xl bg-accent text-[16px] font-semibold text-on-accent transition-opacity disabled:opacity-40"
      >
        {loading ? "..." : text}
      </button>
    </div>
  );
}

const backStack: (() => void)[] = [];
let backHandler: (() => void) | null = null;

function applyBack() {
  const button = nativeBackButton;
  if (!button) return;
  if (backHandler) button.offClick(backHandler);
  const top = backStack[backStack.length - 1];
  backHandler = top ?? null;
  if (top) {
    button.onClick(top);
    button.show();
  } else {
    button.hide();
  }
}

// Ochiq oyna bo'lsa Telegram sarlavhasida "Orqaga" ko'rinadi va oynani yopadi
export function useBackButton(onBack: () => void, active: boolean) {
  const handler = useRef(onBack);
  useLayoutEffect(() => {
    handler.current = onBack;
  });

  useEffect(() => {
    if (!active || !nativeBackButton) return;
    const fn = () => handler.current();
    backStack.push(fn);
    applyBack();
    return () => {
      backStack.splice(backStack.indexOf(fn), 1);
      applyBack();
    };
  }, [active]);
}
