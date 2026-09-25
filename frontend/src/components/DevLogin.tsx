import { useState } from "react";
import { setDevTelegramId } from "../lib/api";

export function DevLogin() {
  const [id, setId] = useState("");

  return (
    <div className="mx-auto mt-20 max-w-sm rounded-xl bg-white p-5 shadow ring-1 ring-black/5">
      <p className="mb-2 font-semibold text-gray-900">Dev rejim</p>
      <p className="mb-3 text-sm text-gray-500">
        Siz Telegram tashqarisidasiz. Test uchun Telegram ID kiriting (bu faqat backend production rejimida bo'lmaganda ishlaydi).
      </p>
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="Telegram ID"
        className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <button
        onClick={() => {
          setDevTelegramId(id.trim());
          window.location.reload();
        }}
        disabled={!id.trim()}
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Kirish
      </button>
    </div>
  );
}
