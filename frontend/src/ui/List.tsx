import type { ReactNode } from "react";
import { ChevronRight, SearchIcon } from "./Icons";

// Telegram/iOS uslubidagi guruhlangan ro'yxat: sarlavha, oq blok, ichki chiziqlar, izoh

export function Section({ title, footer, children, className = "" }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`mt-6 first:mt-3 ${className}`}>
      {title && <div className="px-7 pb-1.5 text-[13px] uppercase tracking-[0.02em] text-header">{title}</div>}
      <div className="mx-3 overflow-hidden rounded-xl bg-surface">{children}</div>
      {footer && <div className="px-7 pt-1.5 text-[13px] leading-snug text-hint">{footer}</div>}
    </div>
  );
}

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  after?: ReactNode;
  chevron?: boolean;
  tone?: "default" | "accent" | "danger";
  center?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

const TONE = {
  default: "text-ink",
  accent: "text-link",
  danger: "text-danger",
};

export function Row({ title, subtitle, leading, after, chevron, tone = "default", center, dimmed, onClick }: RowProps) {
  const content = (
    <>
      {leading && <div className="flex shrink-0 items-center pr-3">{leading}</div>}
      <div className="list-row-inner flex min-h-[46px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-4">
        <div className={`min-w-0 flex-1 ${center ? "text-center" : ""}`}>
          <div className={`truncate ${TONE[tone]} ${dimmed ? "opacity-50" : ""}`}>{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-[13px] text-hint">{subtitle}</div>}
        </div>
        {after && <div className="shrink-0 text-[15px] text-hint">{after}</div>}
        {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-hint opacity-60" />}
      </div>
    </>
  );

  if (!onClick) return <div className="list-row flex w-full items-stretch pl-4">{content}</div>;
  return (
    <button type="button" onClick={onClick} className="list-row pressable flex w-full items-stretch pl-4 text-left">
      {content}
    </button>
  );
}

// Ismdan doimiy rang: har bir xodim har doim bir xil rangda ko'rinadi
const AVATAR_COLORS = ["#e17076", "#7bc862", "#65aadd", "#a695e7", "#ee7aae", "#6ec9cb", "#faa774"];

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
    >
      {initials}
    </span>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="px-10 py-16 text-center">
      <div className="text-[17px] font-semibold text-ink">{title}</div>
      {text && <div className="mt-1.5 text-[14px] leading-snug text-hint">{text}</div>}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  inputMode,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  inputMode?: "text" | "tel";
  autoFocus?: boolean;
}) {
  const className = "list-row-inner block w-full bg-transparent py-3 pr-4 text-ink outline-none placeholder:text-hint";
  return (
    <div className="list-row pl-4">
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className={`${className} resize-none`} />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoFocus={autoFocus}
          className={className}
        />
      )}
    </div>
  );
}

// iOS uslubidagi o'chirib-yoqgich
export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${checked ? "bg-ok" : "bg-soft"}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-transform duration-200 ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

// Ro'yxatda tanlash belgisi (doiracha). danger — bo'shatish uchun tanlanganda qizil
export function SelectMark({ checked, danger }: { checked: boolean; danger?: boolean }) {
  return (
    <span
      className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors ${
        checked ? (danger ? "bg-danger text-white" : "bg-accent text-on-accent") : "border-[1.5px] border-hint opacity-60"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      )}
    </span>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="px-3 pt-3">
      <label className="flex h-9 items-center gap-2 rounded-[10px] bg-soft px-2.5 text-hint">
        <SearchIcon />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-hint"
        />
      </label>
    </div>
  );
}

// Bo'lim sarlavhasi o'ng tomonida kichik amal (masalan "Hammasi", "Bo'shatish")
export function SectionTitle({ text, action, onAction }: { text: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate">{text}</span>
      {action && (
        <button type="button" onClick={onAction} className="-my-1 shrink-0 py-1 text-[14px] normal-case tracking-normal text-link">
          {action}
        </button>
      )}
    </span>
  );
}
