import { useState } from "react";
import { showToast } from "../lib/toast";

interface Props {
  onCreate: (title: string, description?: string) => Promise<unknown>;
}

export function CreateCampaignForm({ onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate(title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
      showToast("Yangi vazifa yaratildi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line">
      <p className="mb-1 font-semibold text-ink">Yangi vazifa yaratish</p>
      <p className="mb-3 text-sm text-muted">Barcha faol mahalla raislari ro'yxatga qo'shiladi.</p>
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='Masalan: "Bugun 09:00 majlis haqida xabar berish"'
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qo'shimcha izoh (ixtiyoriy)"
          rows={2}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <button
          disabled={submitting || !title.trim()}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          Boshlash
        </button>
      </div>
    </form>
  );
}
