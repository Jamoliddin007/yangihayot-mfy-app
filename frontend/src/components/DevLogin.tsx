import { useState } from "react";
import { setDevTelegramId } from "../lib/api";
import { Section, TextField } from "../ui/List";

// Faqat lokal test: Telegram tashqarisida ID bilan kirish (backend DEV_AUTH=true bo'lsagina ishlaydi)
export function DevLogin() {
  const [id, setId] = useState("");

  return (
    <div className="pt-16">
      <Section title="Test rejimi" footer="Telegram tashqarisida sinash uchun. Faqat lokal serverda DEV_AUTH=true bo'lganda ishlaydi.">
        <TextField value={id} onChange={setId} placeholder="Telegram ID" inputMode="tel" />
      </Section>
      <div className="px-3 pt-6">
        <button
          type="button"
          disabled={!id.trim()}
          onClick={() => {
            setDevTelegramId(id.trim());
            window.location.reload();
          }}
          className="h-[50px] w-full rounded-xl bg-accent text-[16px] font-semibold text-on-accent disabled:opacity-40"
        >
          Kirish
        </button>
      </div>
    </div>
  );
}
