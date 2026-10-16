import { useEffect, useState } from "react";
import type { MeResponse } from "../types";
import { ROLE_LABEL } from "../types";
import { haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { Sheet } from "../ui/Sheet";
import { Avatar, Row, Section, TextField } from "../ui/List";
import { CheckIcon } from "../ui/Icons";
import { PrimaryAction } from "../ui/nativeButtons";

interface Props {
  open: boolean;
  me: MeResponse;
  orgId: string;
  onClose: () => void;
  onRename: (fullName: string) => Promise<void>;
  onSwitchOrg: (orgId: string) => void;
}

// O'z profili: ism (Telegram'dan olingan, to'g'rilash mumkin) va bir nechta tashkilot bo'lsa — almashtirish
export function ProfileSheet({ open, me, orgId, onClose, onRename, onSwitchOrg }: Props) {
  const [name, setName] = useState(me.user.fullName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(me.user.fullName);
  }, [open, me.user.fullName]);

  const changed = name.trim().length >= 2 && name.trim() !== me.user.fullName;

  const save = async () => {
    setSaving(true);
    try {
      await onRename(name.trim());
      haptic.success();
      showToast("Ism saqlandi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center px-6 pt-3 pb-1 text-center">
        <Avatar name={me.user.fullName} size={64} />
        <div className="mt-2.5 text-[20px] font-semibold text-ink">{me.user.fullName}</div>
      </div>

      <Section title="Ism-familiya" footer="Boshqalar sizni shu ism bilan ko'radi: ro'yxatlarda va guruh xabarlarida.">
        <TextField value={name} onChange={setName} placeholder="Ism-familiya" />
      </Section>

      <Section title={me.memberships.length > 1 ? "Tashkilotlar" : "Tashkilot"}>
        {me.memberships.map((m) => (
          <Row
            key={m.orgId}
            title={m.orgName}
            subtitle={ROLE_LABEL[m.role]}
            after={m.orgId === orgId ? <CheckIcon className="h-5 w-5 text-link" /> : undefined}
            onClick={
              m.orgId === orgId
                ? undefined
                : () => {
                    haptic.select();
                    onSwitchOrg(m.orgId);
                    onClose();
                  }
            }
          />
        ))}
      </Section>

      <PrimaryAction text="Saqlash" onClick={() => void save()} active={open && changed} loading={saving} />
    </Sheet>
  );
}
