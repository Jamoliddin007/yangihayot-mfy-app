import { useEffect, useState } from "react";
import type { Employee, Mahalla } from "../types";
import { api } from "../lib/api";
import { confirmAction, haptic, shareViaTelegram } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { Sheet } from "../ui/Sheet";
import { Avatar, Row, Section, TextField } from "../ui/List";
import { PrimaryAction } from "../ui/nativeButtons";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Havola nusxalandi", "success");
  } catch {
    showToast(text, "info");
  }
}

function shareInvite(link: string, name: string) {
  if (!shareViaTelegram(link, `${name}, Yangihayot MFY uyushmasi ilovasiga kirish havolasi`)) void copyText(link);
}

function InviteSection({ link, name }: { link: string; name: string }) {
  return (
    <Section title="Taklif havolasi" footer="Xodim havolani ochib, botda «Start» tugmasini bosadi — shundan keyin ilovaga kira oladi.">
      <Row title="Telegram orqali yuborish" tone="accent" onClick={() => shareInvite(link, name)} />
      <Row title="Havolani nusxalash" tone="accent" onClick={() => void copyText(link)} />
    </Section>
  );
}

interface EmployeeSheetProps {
  employee: Employee | null;
  employees: Employee[];
  mahallas: Mahalla[];
  onClose: () => void;
  onChanged: () => void;
}

export function EmployeeSheet({ employee, employees, mahallas, onClose, onChanged }: EmployeeSheetProps) {
  const [picking, setPicking] = useState(false);
  const [shown, setShown] = useState<Employee | null>(employee);
  if (employee && employee !== shown) setShown(employee);
  const current = employee ?? shown;

  useEffect(() => {
    if (!employee) setPicking(false);
  }, [employee]);

  if (!current) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const owned = mahallas.filter((m) => m.assignedToId === current.id);
  const others = employees.filter((e) => e.isActive && e.id !== current.id);

  const act = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      haptic.success();
      showToast(success, "success");
      onChanged();
      return true;
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
      return false;
    }
  };

  const transferTo = async (target: Employee) => {
    if (!(await confirmAction(`${owned.length} ta MFY ${target.fullName}ga o'tkazilsinmi?`))) return;
    if (await act(() => api.post(`/api/users/${current.id}/transfer`, { toUserId: target.id }), `MFY'lar ${target.fullName}ga o'tkazildi`)) {
      setPicking(false);
    }
  };

  const toggleActive = async () => {
    if (current.isActive) {
      if (!(await confirmAction(`${current.fullName} o'chirilsinmi? U ilovaga kira olmaydi.`))) return;
      if (await act(() => api.patch(`/api/users/${current.id}`, { isActive: false }), "Xodim o'chirildi")) onClose();
    } else {
      await act(() => api.patch(`/api/users/${current.id}`, { isActive: true }), "Xodim qayta faollashtirildi");
    }
  };

  const relink = async () => {
    if (!(await confirmAction(`${current.fullName}ning Telegram hisobi uziladi va yangi taklif havolasi yaratiladi. Davom etasizmi?`))) return;
    await act(() => api.post(`/api/users/${current.id}/reinvite`), "Yangi havola yaratildi");
  };

  const status = !current.isActive ? "O'chirilgan" : current.telegramId ? "Telegram'ga ulangan" : "Taklifni kutmoqda";

  return (
    <Sheet open={!!employee} onClose={onClose}>
      <div className="flex flex-col items-center px-6 pt-3 pb-1 text-center">
        <Avatar name={current.fullName} size={64} />
        <div className="mt-2.5 text-[20px] font-semibold text-ink">{current.fullName}</div>
        <div className="mt-0.5 text-[14px] text-hint">
          {status}
          {current.phone ? ` · ${current.phone}` : ""}
        </div>
      </div>

      {current.isActive && !current.telegramId && current.inviteLink && <InviteSection link={current.inviteLink} name={current.fullName} />}

      <Section title={`MFY'lari · ${owned.length}`}>
        {owned.length === 0 && <Row title={<span className="text-hint">Biriktirilmagan</span>} />}
        {owned.map((m) => (
          <Row key={m.id} title={m.name} subtitle={m.chairmanName} />
        ))}
      </Section>

      {owned.length > 0 && others.length > 0 && (
        <Section footer={picking ? "Barcha MFY'lar va joriy topshiriqdagi bog'lanilmagan qo'ng'iroqlar tanlangan xodimga o'tadi." : undefined}>
          {!picking && <Row title="Boshqa xodimga o'tkazish" tone="accent" chevron onClick={() => setPicking(true)} />}
          {picking &&
            others.map((other) => (
              <Row
                key={other.id}
                leading={<Avatar name={other.fullName} size={30} />}
                title={other.fullName}
                subtitle={`${other._count.mahallas} ta MFY`}
                onClick={() => void transferTo(other)}
              />
            ))}
          {picking && <Row title="Bekor qilish" center tone="accent" onClick={() => setPicking(false)} />}
        </Section>
      )}

      <Section>
        {current.isActive && current.telegramId && <Row title="Telegram hisobini qayta ulash" tone="danger" center onClick={() => void relink()} />}
        <Row
          title={current.isActive ? "Xodimni o'chirish" : "Qayta faollashtirish"}
          tone={current.isActive ? "danger" : "accent"}
          center
          onClick={() => void toggleActive()}
        />
      </Section>
    </Sheet>
  );
}

export function AddEmployeeSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; link: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setPhone("");
    setCreated(null);
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const { inviteLink } = await api.post<{ inviteLink: string }>("/api/users/invite", {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      haptic.success();
      setCreated({ name: fullName.trim(), link: inviteLink });
      onAdded();
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={created ? "Xodim qo'shildi" : "Yangi xodim"}>
      {!created && (
        <Section footer="Qo'shilgandan keyin xodimga yuboriladigan taklif havolasi chiqadi.">
          <TextField value={fullName} onChange={setFullName} placeholder="Ism familiya" autoFocus />
          <TextField value={phone} onChange={setPhone} placeholder="Telefon (ixtiyoriy)" inputMode="tel" />
        </Section>
      )}
      {created && <InviteSection link={created.link} name={created.name} />}
      <PrimaryAction
        text={created ? "Tayyor" : "Qo'shish"}
        onClick={created ? onClose : () => void submit()}
        active={open}
        disabled={!created && !fullName.trim()}
        loading={saving}
      />
    </Sheet>
  );
}
