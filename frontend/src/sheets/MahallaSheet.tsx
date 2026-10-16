import { useEffect, useState } from "react";
import type { Employee, Mahalla } from "../types";
import { api } from "../lib/api";
import { confirmAction, haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { Sheet } from "../ui/Sheet";
import { Avatar, Row, Section, TextField } from "../ui/List";
import { CheckIcon } from "../ui/Icons";
import { PrimaryAction } from "../ui/nativeButtons";

interface Props {
  open: boolean;
  // null — yangi MFY qo'shish
  mahalla: Mahalla | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

export function MahallaSheet({ open, mahalla, employees, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [chairmanName, setChairmanName] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Har ochilganda formani tanlangan MFY bilan to'ldirish
  useEffect(() => {
    if (!open) return;
    setName(mahalla?.name ?? "");
    setChairmanName(mahalla?.chairmanName ?? "");
    setPhone(mahalla?.phone ?? "");
    setAssignedToId(mahalla?.assignedToId ?? null);
  }, [open, mahalla]);

  const valid = name.trim() && chairmanName.trim() && phone.trim().length >= 5;
  const dirty =
    !mahalla ||
    name !== mahalla.name ||
    chairmanName !== mahalla.chairmanName ||
    phone !== mahalla.phone ||
    assignedToId !== mahalla.assignedToId;

  const save = async () => {
    setSaving(true);
    try {
      const body = { name: name.trim(), chairmanName: chairmanName.trim(), phone: phone.trim(), assignedToId };
      if (mahalla) await api.put(`/api/mahalla/${mahalla.id}`, body);
      else await api.post("/api/mahalla", body);
      haptic.success();
      showToast(mahalla ? "Saqlandi" : "MFY qo'shildi", "success");
      onSaved();
      onClose();
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!mahalla) return;
    if (!(await confirmAction(`${mahalla.name} MFY ro'yxatdan o'chirilsinmi? Keyingi topshiriqlarga qo'shilmaydi.`))) return;
    try {
      await api.del(`/api/mahalla/${mahalla.id}`);
      showToast("MFY o'chirildi", "success");
      onSaved();
      onClose();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const activeEmployees = employees.filter((e) => e.isActive);

  return (
    <Sheet open={open} onClose={onClose} title={mahalla ? `${mahalla.name} MFY` : "Yangi MFY"}>
      <Section title="Ma'lumot">
        <TextField value={name} onChange={setName} placeholder="MFY nomi" />
        <TextField value={chairmanName} onChange={setChairmanName} placeholder="Rais F.I.Sh" />
        <TextField value={phone} onChange={setPhone} placeholder="Telefon raqami" inputMode="tel" />
      </Section>

      <Section title="Mas'ul xodim" footer="Yangi topshiriqda bu MFY'ga shu xodim qo'ng'iroq qiladi. Joriy topshiriqda ham darhol o'tadi.">
        {activeEmployees.map((employee) => (
          <Row
            key={employee.id}
            leading={<Avatar name={employee.fullName} size={30} />}
            title={employee.fullName}
            after={assignedToId === employee.id ? <CheckIcon className="h-5 w-5 text-link" /> : undefined}
            onClick={() => {
              haptic.select();
              setAssignedToId(employee.id);
            }}
          />
        ))}
        <Row
          title={<span className="text-hint">Biriktirilmagan</span>}
          after={assignedToId === null ? <CheckIcon className="h-5 w-5 text-link" /> : undefined}
          onClick={() => {
            haptic.select();
            setAssignedToId(null);
          }}
        />
      </Section>

      {mahalla && (
        <Section>
          <Row title="MFY'ni o'chirish" tone="danger" center onClick={() => void remove()} />
        </Section>
      )}

      <PrimaryAction text={mahalla ? "Saqlash" : "Qo'shish"} onClick={() => void save()} active={open} disabled={!valid || !dirty} loading={saving} />
    </Sheet>
  );
}
