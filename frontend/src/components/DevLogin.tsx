import { useState } from "react";
import { setDevTelegramId } from "../lib/api";

export function DevLogin() {
  const [id, setId] = useState("");

  return (
    <div className="mx-auto mt-20 max-w-sm rounded-xl bg-surface p-5 shadow ring-1 ring-line">
      <p className="mb-2 font-semibold text-ink">Dev rejim</p>
      <p className="mb-3 text-sm text-muted">
        Siz Telegram tashqarisidasiz. Test uchun Telegram ID kiriting (bu faqat backend production rejimida bo'lmaganda ishlaydi).
      </p>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="Telegram ID"
        className="mb-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
      />
      <button
        onClick={() => {
          setDevTelegramId(id.trim());
          window.location.reload();
        }}
        disabled={!id.trim()}
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
      >
        Kirish
      </button>
    </div>
  );
}
