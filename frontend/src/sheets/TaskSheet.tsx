import { useEffect, useState } from "react";
import type { CallTask, ResultStatus, SessionUser } from "../types";
import { STATUS_LABEL } from "../types";
import { Sheet } from "../ui/Sheet";
import { Row, Section, TextField } from "../ui/List";
import { PhoneIcon } from "../ui/Icons";
import { StatusDot, StatusText, formatTime } from "../ui/Status";
import { confirmAction, haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { parsePhones } from "../lib/phone";

interface Props {
  task: CallTask | null;
  user: SessionUser;
  campaignActive: boolean;
  onClose: () => void;
  onStart: (id: string, help?: boolean) => Promise<CallTask>;
  onResult: (id: string, status: ResultStatus, note?: string, help?: boolean) => Promise<CallTask>;
  onSaveNote: (id: string, note: string) => Promise<CallTask>;
  onReset: (id: string) => Promise<CallTask>;
}

const RESULTS: { status: ResultStatus; label: string; tone: string }[] = [
  { status: "REACHED", label: "Bog'landi", tone: "text-ok" },
  { status: "NO_ANSWER", label: "Ko'tarmadi", tone: "text-warn" },
  { status: "PHONE_OFF", label: "O'chiq", tone: "text-off" },
];

// Bitta MFY: qo'ng'iroq qilish, natija va izoh. Qo'ng'iroqdan qaytgach oyna ochiq turadi.
export function TaskSheet({ task, user, campaignActive, onClose, onStart, onResult, onSaveNote, onReset }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [helping, setHelping] = useState(false);
  const [note, setNote] = useState("");
  // Yopilish animatsiyasi paytida ham kontent ko'rinib turishi uchun oxirgi vazifa eslab qolinadi
  const [shown, setShown] = useState<CallTask | null>(task);
  if (task && task !== shown) setShown(task);
  const current = task ?? shown;

  const taskId = task?.id;
  useEffect(() => {
    if (!taskId) return;
    setHelping(false);
    setNote(task?.note ?? "");
    // Faqat boshqa vazifa ochilganda qayta to'ldiriladi (socket yangilanishi yozilayotgan izohni o'chirmasin)
  }, [taskId]);

  if (!current) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const isBoss = user.role === "BOSS";
  const isMine = current.assignedToId === user.id;
  const done = current.status === "REACHED";
  const canEdit = campaignActive && !done && (isBoss || isMine || helping);
  const canOfferHelp = campaignActive && !done && !isBoss && !isMine && !helping;
  const help = !isBoss && !isMine;
  const phones = parsePhones(current.mahalla.phone);
  const noteChanged = note.trim() !== (current.note ?? "");

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

  const startHelping = async () => {
    const owner = current.assignedTo?.fullName ?? "boshqa xodim";
    if (!(await confirmAction(`${owner}ning MFY'siga yordam berasizmi? Boshliq buni ko'radi.`))) return;
    haptic.tap();
    setHelping(true);
  };

  // tel: havolasi o'zi qo'ng'iroq oynasini ochadi; parallel ravishda "qo'ng'iroq qilinmoqda" holati yoziladi
  const handleCall = () => {
    haptic.tap();
    if (current.status !== "IN_PROGRESS") void run("call", () => onStart(current.id, help));
  };

  const handleResult = async (status: ResultStatus) => {
    const ok = await run(status, () => onResult(current.id, status, note.trim(), help), `${STATUS_LABEL[status]} — saqlandi`);
    if (ok) onClose();
  };

  const handleReset = async () => {
    if (!(await confirmAction(`${current.mahalla.name} MFY natijasini bekor qilasizmi?`))) return;
    await run("reset", () => onReset(current.id), "Natija bekor qilindi");
  };

  const helper = current.calledBy && current.calledBy.id !== current.assignedToId ? current.calledBy : null;
  const canEditNote = campaignActive && (isBoss || isMine || current.calledById === user.id);

  return (
    <Sheet open={!!task} onClose={onClose}>
      <div className="px-6 pt-3 pb-1 text-center">
        <div className="text-[20px] font-semibold leading-tight text-ink">{current.mahalla.name} MFY</div>
        <div className="mt-1 text-[15px] text-muted">{current.mahalla.chairmanName}</div>
        <div className="mt-2 inline-flex items-center gap-2 text-[14px]">
          <StatusDot status={current.status} />
          <StatusText status={current.status} />
          {current.calledAt && current.status !== "PENDING" && <span className="text-hint">· {formatTime(current.calledAt)}</span>}
        </div>
      </div>

      {canEdit && (
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

      {canOfferHelp && (
        <Section footer="Bu MFY boshqa xodimga biriktirilgan. Yordam bersangiz, natijada sizning ismingiz va kimning o'rniga ekani ko'rsatiladi.">
          <Row title="Yordam berish" tone="accent" center onClick={() => void startHelping()} />
        </Section>
      )}

      {canEdit && (
        <>
          <Section title="Izoh (ixtiyoriy)">
            <TextField value={note} onChange={setNote} placeholder="Masalan: rais kasalxonada, boshqa raqam berdi" multiline />
          </Section>
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

      {/* Natija belgilangan, lekin izohni keyin o'zgartirish kerak bo'lsa */}
      {!canEdit && done && canEditNote && (
        <Section title="Izoh">
          <TextField value={note} onChange={setNote} placeholder="Izoh qo'shish" multiline />
          {noteChanged && <Row title={busy === "note" ? "..." : "Izohni saqlash"} tone="accent" center onClick={() => void run("note", () => onSaveNote(current.id, note.trim()), "Izoh saqlandi")} />}
        </Section>
      )}

      <Section title="Ma'lumot">
        <Row title="Telefon" after={<span className="text-ink tabular-nums">{phones.map((p) => p.display).join(", ") || current.mahalla.phone}</span>} />
        <Row title="Mas'ul xodim" after={<span className="text-ink">{current.assignedTo?.fullName ?? "Biriktirilmagan"}</span>} />
        {helper && <Row title="Bajardi" after={<span className="text-ink">{helper.fullName}</span>} />}
        {current.note && !canEdit && !(done && canEditNote) && <Row title="Izoh" subtitle={<span className="whitespace-normal text-ink">{current.note}</span>} />}
      </Section>

      {isBoss && campaignActive && current.status !== "PENDING" && (
        <Section>
          <Row title={busy === "reset" ? "..." : "Natijani bekor qilish"} tone="danger" center onClick={() => void handleReset()} />
        </Section>
      )}
    </Sheet>
  );
}

export function TaskRow({ task, onOpen, showAssignee }: { task: CallTask; onOpen: (task: CallTask) => void; showAssignee?: boolean }) {
  const helper = task.calledBy && task.calledBy.id !== task.assignedToId ? task.calledBy.fullName : null;
  // Eng muhim ma'lumot ikkinchi qatorda: izoh > yordam > rais (va kerak bo'lsa mas'ul)
  const subtitle = task.note
    ? `«${task.note}»`
    : helper
      ? `Bajardi: ${helper}`
      : showAssignee && task.assignedTo
        ? `${task.mahalla.chairmanName} · ${task.assignedTo.fullName}`
        : task.mahalla.chairmanName;
  return (
    <Row
      leading={<StatusDot status={task.status} />}
      title={task.mahalla.name}
      subtitle={subtitle}
      after={task.status !== "PENDING" ? <StatusText status={task.status} className="text-[14px]" short /> : undefined}
      chevron
      onClick={() => onOpen(task)}
    />
  );
}
