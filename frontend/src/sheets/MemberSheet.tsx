import { useEffect, useState } from "react";
import type { Mahalla, Member, Role } from "../types";
import { ROLE_LABEL } from "../types";
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

function share(link: string, text: string) {
  if (!shareViaTelegram(link, text)) void copyText(link);
}

export function InviteLinkSection({ link, text, footer }: { link: string; text: string; footer?: string }) {
  return (
    <Section title="Taklif havolasi" footer={footer ?? "Havola bir martalik, 14 kun amal qiladi. Ochgan odam botda «Start»ni bosadi va qo'shiladi."}>
      <Row title="Telegram orqali yuborish" tone="accent" onClick={() => share(link, text)} />
      <Row title="Havolani nusxalash" tone="accent" onClick={() => void copyText(link)} />
    </Section>
  );
}

interface MemberSheetProps {
  member: Member | null;
  me: string;
  members: Member[];
  mahallas: Mahalla[];
  orgName: string;
  onClose: () => void;
  onChanged: () => void;
}

// A'zo kartochkasi: ism, taklif havolasi, MFY'lari, o'tkazish, rol va o'chirish (xavfli amallar eng pastda)
export function MemberSheet({ member, me, members, mahallas, orgName, onClose, onChanged }: MemberSheetProps) {
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Member | null>(member);
  if (member && member !== shown) setShown(member);
  const current = member ?? shown;

  const memberId = member?.userId;
  useEffect(() => {
    if (!memberId) return;
    setPicking(false);
    setName(member?.fullName ?? "");
    // Faqat boshqa a'zo ochilganda qayta to'ldiriladi
  }, [memberId]);

  if (!current) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const owned = mahallas.filter((m) => m.assignedToId === current.userId);
  const others = members.filter((m) => m.isActive && m.userId !== current.userId);
  const isMe = current.userId === me;

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const patch = (body: Record<string, unknown>, success: string) => act(() => api.patch(`/api/members/${current.userId}`, body), success);

  const transferTo = async (target: Member) => {
    if (!(await confirmAction(`${owned.length} ta MFY ${target.fullName}ga o'tkazilsinmi? Joriy topshiriqdagi bog'lanilmaganlari ham o'tadi.`))) return;
    if (await act(() => api.post(`/api/members/${current.userId}/transfer`, { toUserId: target.userId }), `MFY'lar ${target.fullName}ga o'tkazildi`)) {
      setPicking(false);
    }
  };

  const changeRole = async (role: Role) => {
    const text = role === "BOSS" ? `${current.fullName} boshliq qilinsinmi? U MFY va xodimlarni boshqara oladi.` : `${current.fullName} xodim qilinsinmi?`;
    if (await confirmAction(text)) await patch({ role }, "Rol o'zgartirildi");
  };

  const toggleActive = async () => {
    if (current.isActive) {
      if (!(await confirmAction(`${current.fullName} o'chirilsinmi? U ilovaga kira olmaydi.`))) return;
      if (await patch({ isActive: false }, "O'chirildi")) onClose();
    } else {
      await patch({ isActive: true }, "Qayta faollashtirildi");
    }
  };

  const newLink = () => act(() => api.post(`/api/members/${current.userId}/invite`), "Yangi havola yaratildi");

  const status = !current.isActive ? "O'chirilgan" : current.joined ? ROLE_LABEL[current.role] : `${ROLE_LABEL[current.role]} · taklifni kutmoqda`;
  const nameChanged = name.trim().length >= 2 && name.trim() !== current.fullName;

  return (
    <Sheet open={!!member} onClose={onClose}>
      <div className="flex flex-col items-center px-6 pt-3 pb-1 text-center">
        <Avatar name={current.fullName} size={64} />
        <div className="mt-2.5 text-[20px] font-semibold text-ink">{current.fullName}</div>
        <div className="mt-0.5 text-[14px] text-hint">
          {status}
          {current.username ? ` · @${current.username}` : ""}
          {current.phone ? ` · ${current.phone}` : ""}
        </div>
      </div>

      <Section title="Ism-familiya">
        <TextField value={name} onChange={setName} placeholder="Ism-familiya" />
      </Section>

      {current.isActive && !current.joined && current.inviteLink && (
        <InviteLinkSection link={current.inviteLink} text={`${current.fullName}, ${orgName} ilovasiga kirish havolasi`} />
      )}
      {current.isActive && !current.joined && (
        <Section footer={current.inviteLink ? undefined : "Havola muddati o'tgan yoki ishlatilgan."}>
          <Row title="Yangi havola yaratish" tone="accent" center onClick={() => void newLink()} />
        </Section>
      )}

      <Section title={`MFY'lari · ${owned.length}`}>
        {owned.length === 0 && <Row title={<span className="text-hint">Biriktirilmagan</span>} />}
        {owned.map((m) => (
          <Row key={m.id} title={m.name} subtitle={m.chairmanName} />
        ))}
      </Section>

      {owned.length > 0 && others.length > 0 && (
        <Section footer={picking ? "Barcha MFY'lar va joriy topshiriqdagi bog'lanilmagan qo'ng'iroqlar tanlangan kishiga o'tadi." : undefined}>
          {!picking && <Row title="Boshqa xodimga o'tkazish" tone="accent" chevron onClick={() => setPicking(true)} />}
          {picking &&
            others.map((other) => (
              <Row
                key={other.userId}
                leading={<Avatar name={other.fullName} size={30} />}
                title={other.fullName}
                subtitle={`${other.mahallaCount} ta MFY`}
                onClick={() => void transferTo(other)}
              />
            ))}
          {picking && <Row title="Bekor qilish" center tone="accent" onClick={() => setPicking(false)} />}
        </Section>
      )}

      {!isMe && current.isActive && (
        <Section>
          <Row
            title={current.role === "BOSS" ? "Xodim qilish" : "Boshliq qilish"}
            tone="accent"
            center
            onClick={() => void changeRole(current.role === "BOSS" ? "EMPLOYEE" : "BOSS")}
          />
          <Row title="O'chirish" tone="danger" center onClick={() => void toggleActive()} />
        </Section>
      )}
      {!current.isActive && (
        <Section>
          <Row title="Qayta faollashtirish" tone="accent" center onClick={() => void toggleActive()} />
        </Section>
      )}

      <PrimaryAction text="Ismni saqlash" onClick={() => void patch({ fullName: name.trim() }, "Saqlandi")} active={!!member && nameChanged} loading={busy} />
    </Sheet>
  );
}

// Yangi a'zo: ism bilan oldindan qo'shish (MFY'larni darhol biriktirish mumkin) yoki umumiy havola
export function AddMemberSheet({ open, role, orgName, onClose, onAdded }: { open: boolean; role: Role; orgName: string; onClose: () => void; onAdded: () => void }) {
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
      const { inviteLink } = await api.post<{ inviteLink: string }>("/api/members", {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
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

  const title = role === "BOSS" ? "Boshliq qo'shish" : "Xodim qo'shish";
  return (
    <Sheet open={open} onClose={onClose} title={created ? "Qo'shildi" : title}>
      {!created && (
        <Section footer="Ism Telegram'dagidan farq qilsa ham bo'ladi — keyin o'zgartirish mumkin. Qo'shilgach shaxsiy taklif havolasi chiqadi.">
          <TextField value={fullName} onChange={setFullName} placeholder="Ism-familiya" autoFocus />
          <TextField value={phone} onChange={setPhone} placeholder="Telefon (ixtiyoriy)" inputMode="tel" />
        </Section>
      )}
      {created && <InviteLinkSection link={created.link} text={`${created.name}, ${orgName} ilovasiga kirish havolasi`} />}
      <PrimaryAction
        text={created ? "Tayyor" : "Qo'shish"}
        onClick={created ? onClose : () => void submit()}
        active={open}
        disabled={!created && fullName.trim().length < 2}
        loading={saving}
      />
    </Sheet>
  );
}
