import { useEffect, useState } from "react";
import { onToast, type ToastMessage } from "../lib/toast";

const DOT: Record<ToastMessage["type"], string> = {
  error: "bg-danger",
  success: "bg-ok",
  info: "bg-hint",
};

// Yuqorida qisqa xabar: ixcham, neytral fon, holat rangli nuqta bilan
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return onToast((toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), toast.type === "error" ? 4000 : 2400);
    });
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="toast flex max-w-sm items-center gap-2.5 rounded-2xl bg-[#1c1c1e]/92 px-4 py-2.5 text-[14px] font-medium text-white shadow-lg backdrop-blur"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[toast.type]}`} />
          <span className="leading-snug">{toast.text}</span>
        </div>
      ))}
    </div>
  );
}
