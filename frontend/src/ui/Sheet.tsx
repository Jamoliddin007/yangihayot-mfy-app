import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBackButton } from "./nativeButtons";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}

// Pastdan chiqadigan oyna. Telegram'ning "Orqaga" tugmasi, fon bosilishi yoki Esc bilan yopiladi.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useBackButton(onClose, open);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        className="sheet-backdrop absolute inset-0 bg-black/40"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="sheet-panel absolute inset-x-0 bottom-0 flex max-h-[88%] flex-col rounded-t-2xl bg-page"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
        role="dialog"
        aria-modal
      >
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-9 rounded-full bg-hint opacity-40" />
        </div>
        {title && <div className="px-5 pt-1 pb-1 text-center text-[17px] font-semibold text-ink">{title}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(24px+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
