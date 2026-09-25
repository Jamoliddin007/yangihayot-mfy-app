import { useEffect, useState } from "react";
import { onToast, type ToastMessage } from "../lib/toast";

const STYLES: Record<ToastMessage["type"], string> = {
  error: "bg-red-600 text-white",
  success: "bg-emerald-600 text-white",
  info: "bg-gray-900 text-white",
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return onToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3200);
    });
  }, []);

  return (
    <div className="fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${STYLES[toast.type]}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
