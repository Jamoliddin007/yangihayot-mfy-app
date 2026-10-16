import type { CallStatus, CallTask } from "../types";
import { STATUS_LABEL, STATUS_TONE } from "../types";

export function StatusDot({ status }: { status: CallStatus }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_TONE[status].dot}`} />;
}

export function StatusText({ status, className = "" }: { status: CallStatus; className?: string }) {
  return <span className={`${STATUS_TONE[status].text} ${className}`}>{STATUS_LABEL[status]}</span>;
}

// Ko'p rangli progress: yashil — bog'landi, to'q sariq — ko'tarmadi, kulrang — o'chiq, ko'k — hozir
export function ProgressBar({ tasks, height = 6 }: { tasks: Pick<CallTask, "status">[]; height?: number }) {
  const total = tasks.length || 1;
  const count = (status: CallStatus) => tasks.filter((t) => t.status === status).length;
  const parts: [CallStatus, number][] = [
    ["REACHED", count("REACHED")],
    ["IN_PROGRESS", count("IN_PROGRESS")],
    ["NO_ANSWER", count("NO_ANSWER")],
    ["PHONE_OFF", count("PHONE_OFF")],
  ];
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-soft" style={{ height }}>
      {parts.map(([status, n]) =>
        n > 0 ? (
          <span key={status} className={`h-full ${STATUS_TONE[status].dot} transition-[width] duration-500`} style={{ width: `${(n / total) * 100}%` }} />
        ) : null,
      )}
    </div>
  );
}

export function reachedCount(tasks: Pick<CallTask, "status">[]) {
  return tasks.filter((t) => t.status === "REACHED").length;
}

const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export function formatTime(iso: string | null) {
  return iso ? timeFormat.format(new Date(iso)) : "";
}
