import { useEffect, useState } from "react";
import type { Mahalla, Member } from "../types";
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
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}

export function MahallaSheet({ open, mahalla, members, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [chairmanName, setChairmanName] = useState("");
  const [phone, setPhone] = useState("");
  const [sector, setSector] = useState("");
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Har ochilganda formani tanlangan MFY bilan to'ldirish
  useEffect(() => {
    if (!open) return;
    setName(mahalla?.name ?? "");
    setChairmanName(mahalla?.chairmanName ?? "");
    setPhone(mahalla?.phone ?? "");
    setSector(mahalla?.sector ? String(mahalla.sector) : "");
    setAssignedToId(mahalla?.assignedToId ?? null);
  }, [open, mahalla]);

  const valid = name.trim() && chairmanName.trim() && phone.trim().length >= 5;
  const dirty =
    !mahalla ||
    name !== mahalla.name ||
    chairmanName !== mahalla.chairmanName ||
    phone !== mahalla.phone ||
    sector !== (mahalla.sector ? String(mahalla.sector) : "") ||
    assignedToId !== mahalla.assignedToId;

  const save = async () => {
    setSaving(true);
    try {
      const sectorNumber = Number.parseInt(sector, 10);
      const body = {
        name: name.trim(),
        chairmanName: chairmanName.trim(),
        phone: phone.trim(),
        sector: Number.isFinite(sectorNumber) ? sectorNumber : null,
        assignedToId,
      };
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

  const activeMembers = members.filter((m) => m.isActive);

  return (
    <Sheet open={open} onClose={onClose} title={mahalla ? `${mahalla.name} MFY` : "Yangi MFY"}>
      <Section title="Ma'lumot">
        <TextField value={name} onChange={setName} placeholder="MFY nomi" />
        <TextField value={chairmanName} onChange={setChairmanName} placeholder="Rais F.I.Sh" />
        <TextField value={phone} onChange={setPhone} placeholder="Telefon raqami (bir nechta bo'lsa — vergul bilan)" inputMode="tel" />
        <TextField value={sector} onChange={(v) => setSector(v.replace(/\D/g, ""))} placeholder="Sektor raqami (ixtiyoriy)" inputMode="tel" />
      </Section>

      <Section title="Mas'ul xodim" footer="Yangi topshiriqda bu MFY'ga shu xodim qo'ng'iroq qiladi. Joriy topshiriqda ham darhol o'tadi.">
        {activeMembers.map((member) => (
          <Row
            key={member.userId}
            leading={<Avatar name={member.fullName} size={30} />}
            title={member.fullName}
            subtitle={`${member.mahallaCount} ta MFY`}
            after={assignedToId === member.userId ? <CheckIcon className="h-5 w-5 text-link" /> : undefined}
            onClick={() => {
              haptic.select();
              setAssignedToId(member.userId);
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
