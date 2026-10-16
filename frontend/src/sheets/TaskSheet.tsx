import { useState } from "react";
import type { CallTask, CurrentUser, ResultStatus } from "../types";
import { STATUS_LABEL } from "../types";
import { Sheet } from "../ui/Sheet";
import { Row, Section } from "../ui/List";
import { PhoneIcon } from "../ui/Icons";
import { StatusDot, StatusText, formatTime } from "../ui/Status";
import { confirmAction, haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { parsePhones } from "../lib/phone";

interface Props {
  task: CallTask | null;
  user: CurrentUser;
  editable: boolean;
  onClose: () => void;
  onStart: (id: string) => Promise<CallTask>;
  onResult: (id: string, status: ResultStatus) => Promise<CallTask>;
  onReset: (id: string) => Promise<CallTask>;
}

const RESULTS: { status: ResultStatus; label: string; tone: string }[] = [
  { status: "REACHED", label: "Bog'landi", tone: "text-ok" },
  { status: "NO_ANSWER", label: "Ko'tarmadi", tone: "text-warn" },
  { status: "PHONE_OFF", label: "O'chiq", tone: "text-off" },
];

// Bitta MFY: qo'ng'iroq qilish va natijani belgilash. Qo'ng'iroqdan qaytgach oyna ochiq turadi.
export function TaskSheet({ task, user, editable, onClose, onStart, onResult, onReset }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  // Yopilish animatsiyasi paytida ham kontent ko'rinib turishi uchun oxirgi vazifa eslab qolinadi
  const [shown, setShown] = useState<CallTask | null>(task);
  if (task && task !== shown) setShown(task);
  const current = task ?? shown;

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) {
        haptic.success();
        showToast(success, "success");
      }
      return true;
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  // tel: havolasi o'zi qo'ng'iroq oynasini ochadi; parallel ravishda "qo'ng'iroq qilinmoqda" holati yoziladi
  const handleCall = () => {
    if (!current || !editable) return;
    haptic.tap();
    if (current.status !== "IN_PROGRESS" && current.status !== "REACHED") void run("call", () => onStart(current.id));
  };

  const handleResult = async (status: ResultStatus) => {
    if (!current) return;
    const ok = await run(status, () => onResult(current.id, status), `${STATUS_LABEL[status]} — saqlandi`);
    if (ok) onClose();
  };

  const handleReset = async () => {
    if (!current) return;
    if (!(await confirmAction(`${current.mahalla.name} MFY natijasini bekor qilasizmi?`))) return;
    await run("reset", () => onReset(current.id), "Natija bekor qilindi");
  };

  const isBoss = user.role === "BOSS";
  const phones = current ? parsePhones(current.mahalla.phone) : [];
  const done = current?.status === "REACHED";

  return (
    <Sheet open={!!task} onClose={onClose}>
      {current && (
        <>
          <div className="px-6 pt-3 pb-1 text-center">
            <div className="text-[20px] font-semibold leading-tight text-ink">{current.mahalla.name} MFY</div>
            <div className="mt-1 text-[15px] text-muted">{current.mahalla.chairmanName}</div>
            <div className="mt-2 inline-flex items-center gap-2 text-[14px]">
              <StatusDot status={current.status} />
              <StatusText status={current.status} />
              {current.calledAt && current.status !== "PENDING" && <span className="text-hint">· {formatTime(current.calledAt)}</span>}
            </div>
          </div>

          {editable && !done && (
            <div className="space-y-2 px-3 pt-5">
              {phones.map((phone, i) => (
                <a
                  key={phone.tel}
                  href={`tel:${phone.tel}`}
                  onClick={handleCall}
                  className={`flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[16px] font-semibold tabular-nums active:opacity-85 ${
                    i === 0 ? "bg-accent text-on-accent" : "bg-surface text-link"
                  }`}
                >
                  <PhoneIcon className="h-[18px] w-[18px]" />
                  {phone.display}
                </a>
              ))}
            </div>
          )}

          {editable && !done && (
            <>
              <div className="px-7 pt-6 pb-1.5 text-[13px] uppercase tracking-[0.02em] text-header">Natija</div>
              <div className="grid grid-cols-3 gap-2 px-3">
                {RESULTS.map(({ status, label, tone }) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void handleResult(status)}
                    className={`pressable h-[52px] rounded-xl bg-surface text-[15px] font-semibold ${tone} disabled:opacity-50 ${
                      current.status === status ? "ring-2 ring-current ring-inset" : ""
                    }`}
                  >
                    {busy === status ? "..." : label}
                  </button>
                ))}
              </div>
            </>
          )}

          <Section title="Ma'lumot">
            <Row
              title="Telefon"
              after={<span className="text-ink tabular-nums">{phones.map((p) => p.display).join(", ") || current.mahalla.phone}</span>}
            />
            <Row title="Mas'ul xodim" after={<span className="text-ink">{current.assignedTo?.fullName ?? "Biriktirilmagan"}</span>} />
          </Section>

          {!editable && !isBoss && (
            <div className="px-7 pt-3 text-[13px] text-hint">Bu MFY boshqa xodimga biriktirilgan — faqat ko'rish mumkin.</div>
          )}

          {isBoss && editable && current.status !== "PENDING" && (
            <Section>
              <Row title={busy === "reset" ? "..." : "Natijani bekor qilish"} tone="danger" center onClick={() => void handleReset()} />
            </Section>
          )}
        </>
      )}
    </Sheet>
  );
}

export function TaskRow({ task, onOpen, showAssignee }: { task: CallTask; onOpen: (task: CallTask) => void; showAssignee?: boolean }) {
  const subtitle = showAssignee && task.assignedTo ? `${task.mahalla.chairmanName} · ${task.assignedTo.fullName}` : task.mahalla.chairmanName;
  return (
    <Row
      leading={<StatusDot status={task.status} />}
      title={`${task.mahalla.name}`}
      subtitle={subtitle}
      after={task.status !== "PENDING" ? <StatusText status={task.status} className="text-[14px]" /> : undefined}
      chevron
      onClick={() => onOpen(task)}
    />
  );
}
