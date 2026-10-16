import type { ReactNode } from "react";
import { ChevronRight } from "./Icons";

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
