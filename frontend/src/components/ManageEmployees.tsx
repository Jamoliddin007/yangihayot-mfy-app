import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";
import type { Employee } from "../types";

export function ManageEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get<Employee[]>("/api/users")
      .then(setEmployees)
      .catch((err) => showToast((err as Error).message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Havola nusxalandi", "success");
    } catch {
      showToast(link, "info");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setSubmitting(true);
    try {
      const { inviteLink } = await api.post<{ inviteLink: string }>("/api/users/invite", {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setFullName("");
      setPhone("");
      load();
      await copyLink(inviteLink);
      showToast("Xodim qo'shildi, taklif havolasi nusxalandi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (employee: Employee) => {
    try {
      await api.patch(`/api/users/${employee.id}`, { isActive: !employee.isActive });
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const reinvite = async (employee: Employee) => {
    try {
      const { inviteLink } = await api.post<{ inviteLink: string }>(`/api/users/${employee.id}/reinvite`);
      await copyLink(inviteLink);
      load();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleInvite} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <p className="mb-3 font-semibold text-gray-900">Yangi xodim qo'shish</p>
        <div className="space-y-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="F.I.Sh"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon (ixtiyoriy)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            disabled={submitting || !fullName.trim() || employees.filter((e) => e.isActive).length >= 5}
            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {employees.filter((e) => e.isActive).length >= 5 ? "Maksimal (5) xodimga yetdi" : "Qo'shish va havola olish"}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {loading && <p className="text-sm text-gray-400">Yuklanmoqda...</p>}
        {employees.map((emp) => (
          <div key={emp.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{emp.fullName}</p>
              <p className="text-xs text-gray-400">
                {emp.telegramId ? "✅ Botga ulangan" : "⏳ Taklifni kutmoqda"}
                {!emp.isActive && " · o'chirilgan"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {!emp.telegramId && (
                <button
                  onClick={() => reinvite(emp)}
                  className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700"
                >
                  Havola
                </button>
              )}
              <button
                onClick={() => toggleActive(emp)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  emp.isActive ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {emp.isActive ? "O'chirish" : "Yoqish"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
