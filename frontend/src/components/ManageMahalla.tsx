import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import { confirmAction } from "../lib/telegram";
import type { Mahalla } from "../types";

export function ManageMahalla() {
  const [list, setList] = useState<Mahalla[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [chairmanName, setChairmanName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api
      .get<Mahalla[]>("/api/mahalla")
      .then(setList)
      .catch((err) => showToast((err as Error).message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !chairmanName.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/mahalla", { name: name.trim(), chairmanName: chairmanName.trim(), phone: phone.trim() });
      setName("");
      setChairmanName("");
      setPhone("");
      load();
      showToast("Mahalla qo'shildi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (m: Mahalla) => {
    if (!(await confirmAction(`"${m.name}" MFY ro'yxatdan o'chirilsinmi?`))) return;
    try {
      await api.del(`/api/mahalla/${m.id}`);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await api.post<{ count: number; skipped: number }>("/api/mahalla/import", formData);
      const skippedNote = result.skipped > 0 ? ` (${result.skipped} ta takroriy o'tkazib yuborildi)` : "";
      showToast(`${result.count} ta mahalla import qilindi${skippedNote}`, "success");
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line">
        <p className="mb-3 font-semibold text-ink">Yangi mahalla qo'shish</p>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MFY nomi"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            value={chairmanName}
            onChange={(e) => setChairmanName(e.target.value)}
            placeholder="Rais F.I.Sh"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon raqami"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
          />
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            Qo'shish
          </button>
        </div>

        <div className="mt-3 border-t border-line pt-3">
          <label className="block text-xs font-medium text-hint mb-1.5">
            Yoki Excel orqali import (1-ustun: MFY, 2-ustun: F.I.Sh, 3-ustun: telefon)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={handleImport}
            disabled={importing}
            className="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-soft file:px-3 file:py-2 file:text-sm file:font-medium"
          />
        </div>
      </form>

      <div className="space-y-2">
        {loading && <p className="text-sm text-hint">Yuklanmoqda...</p>}
        {list.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl bg-surface p-3 shadow-sm ring-1 ring-line">
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{m.name} MFY</p>
              <p className="truncate text-xs text-hint">
                {m.chairmanName} · {m.phone}
              </p>
            </div>
            <button onClick={() => handleRemove(m)} className="shrink-0 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-600">
              O'chirish
            </button>
          </div>
        ))}
        {!loading && list.length === 0 && <p className="text-sm text-hint">Hali mahalla qo'shilmagan</p>}
      </div>
    </div>
  );
}
