import { useState } from "react";
import type { CallStatus, CallTask, CurrentUser } from "../types";
import { STATUS_STYLE } from "../types";
import { showToast } from "../lib/toast";

interface Props {
  task: CallTask;
  currentUser: CurrentUser;
  onStart: (taskId: string) => Promise<CallTask>;
  onResult: (taskId: string, status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">) => Promise<CallTask>;
  onReset: (taskId: string) => Promise<CallTask>;
}

export function TaskCard({ task, currentUser, onStart, onResult, onReset }: Props) {
  const [busy, setBusy] = useState(false);
  const isMine = task.assignedTo?.id === currentUser.id;
  const style = STATUS_STYLE[task.status];

  const handleCall = async () => {
    setBusy(true);
    try {
      if (task.status === "PENDING") {
        await onStart(task.id);
      }
      window.location.href = `tel:${task.mahalla.phone}`;
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleResult = async (status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">) => {
    setBusy(true);
    try {
      await onResult(task.id, status);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    try {
      await onReset(task.id);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl p-4 shadow-sm ring-1 ring-black/5 ${style.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{task.mahalla.name} MFY</p>
          <p className="truncate text-sm text-gray-500">{task.mahalla.chairmanName}</p>
          <p className="text-sm text-gray-400">{task.mahalla.phone}</p>
        </div>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full mt-1 ${style.dot}`} />
      </div>

      {task.assignedTo && (
        <p className="mt-2 text-xs text-gray-500">
          {isMine ? "Siz band qildingiz" : `Band qildi: ${task.assignedTo.fullName}`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {task.status === "PENDING" && (
          <button
            disabled={busy}
            onClick={handleCall}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            📞 Qo'ng'iroq qilish
          </button>
        )}

        {isMine && task.status !== "PENDING" && task.status !== "REACHED" && (
          <>
            <button
              disabled={busy}
              onClick={handleCall}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              📞 Qayta
            </button>
            <button
              disabled={busy}
              onClick={() => handleResult("REACHED")}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              ✅ Bog'landi
            </button>
            <button
              disabled={busy}
              onClick={() => handleResult("NO_ANSWER")}
              className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              📵 Ko'tarmadi
            </button>
            <button
              disabled={busy}
              onClick={() => handleResult("PHONE_OFF")}
              className="rounded-lg bg-gray-400 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              ⚠️ O'chiq
            </button>
          </>
        )}

        {currentUser.role === "BOSS" && task.status !== "PENDING" && (
          <button
            disabled={busy}
            onClick={handleReset}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
          >
            ↺ Qayta boshlash
          </button>
        )}
      </div>
    </div>
  );
}
