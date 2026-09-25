import { useState } from "react";
import type { CallStatus, CallTask, CurrentUser } from "../types";
import { STATUS_LABEL, STATUS_STYLE } from "../types";
import { showToast } from "../lib/toast";

interface Props {
  task: CallTask;
  currentUser: CurrentUser;
  onStart: (taskId: string) => Promise<CallTask>;
  onResult: (taskId: string, status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">) => Promise<CallTask>;
  onReset: (taskId: string) => Promise<CallTask>;
}

type Action = "call" | "REACHED" | "NO_ANSWER" | "PHONE_OFF" | "reset" | null;

export function TaskCard({ task, currentUser, onStart, onResult, onReset }: Props) {
  const [pending, setPending] = useState<Action>(null);
  const isMine = task.assignedTo?.id === currentUser.id;
  const style = STATUS_STYLE[task.status];
  const busy = pending !== null;

  const handleCall = async () => {
    setPending("call");
    try {
      if (task.status === "PENDING") {
        await onStart(task.id);
      }
      window.location.href = `tel:${task.mahalla.phone}`;
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setPending(null);
    }
  };

  const handleResult = async (status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">) => {
    setPending(status);
    try {
      await onResult(task.id, status);
      showToast(`Natija saqlandi: ${STATUS_LABEL[status]}`, "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setPending(null);
    }
  };

  const handleReset = async () => {
    setPending("reset");
    try {
      await onReset(task.id);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setPending(null);
    }
  };

  const showResultActions = isMine && task.status !== "PENDING" && task.status !== "REACHED";
  const showBossReset = currentUser.role === "BOSS" && task.status !== "PENDING";

  return (
    <div className={`rounded-xl p-4 shadow-sm ring-1 ring-black/5 ${style.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{task.mahalla.name} MFY</p>
          <p className="truncate text-sm text-gray-500">{task.mahalla.chairmanName}</p>
          <p className="text-sm text-gray-400">{task.mahalla.phone}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
          {STATUS_LABEL[task.status]}
        </span>
      </div>

      {task.assignedTo && (
        <p className="mt-2 text-xs text-gray-500">
          {isMine ? "Siz band qildingiz" : `Band qildi: ${task.assignedTo.fullName}`}
        </p>
      )}

      {task.status === "PENDING" && (
        <button
          disabled={busy}
          onClick={handleCall}
          className="mt-3 w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white active:bg-gray-700 disabled:opacity-50"
        >
          {pending === "call" ? "..." : "📞 Qo'ng'iroq qilish"}
        </button>
      )}

      {showResultActions && (
        <div className="mt-3 space-y-2">
          <button
            disabled={busy}
            onClick={handleCall}
            className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100 disabled:opacity-50"
          >
            {pending === "call" ? "..." : "📞 Qayta qo'ng'iroq qilish"}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              disabled={busy}
              onClick={() => handleResult("REACHED")}
              className="rounded-lg bg-emerald-600 py-3 text-xs font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
            >
              {pending === "REACHED" ? "..." : "✅ Bog'landi"}
            </button>
            <button
              disabled={busy}
              onClick={() => handleResult("NO_ANSWER")}
              className="rounded-lg bg-orange-500 py-3 text-xs font-semibold text-white active:bg-orange-600 disabled:opacity-50"
            >
              {pending === "NO_ANSWER" ? "..." : "📵 Ko'tarmadi"}
            </button>
            <button
              disabled={busy}
              onClick={() => handleResult("PHONE_OFF")}
              className="rounded-lg bg-gray-500 py-3 text-xs font-semibold text-white active:bg-gray-600 disabled:opacity-50"
            >
              {pending === "PHONE_OFF" ? "..." : "⚠️ O'chiq"}
            </button>
          </div>
        </div>
      )}

      {showBossReset && (
        <button
          disabled={busy}
          onClick={handleReset}
          className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-500 active:bg-gray-100 disabled:opacity-50"
        >
          {pending === "reset" ? "..." : "↺ Qayta boshlash"}
        </button>
      )}
    </div>
  );
}
