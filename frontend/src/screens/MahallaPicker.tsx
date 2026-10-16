import { useMemo, useState } from "react";
import type { Mahalla, SessionUser } from "../types";
import type { useMahallas } from "../hooks/useMahallas";
import { confirmAction, haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { Avatar, EmptyState, Row, SearchField, Section, SectionTitle, SelectMark } from "../ui/List";
import { PrimaryAction } from "../ui/nativeButtons";

type Mode = "claim" | "release";

const sectorTitle = (sector: number | null) => (sector ? `${sector}-sektor` : "Sektorsiz");

function listNames(items: Mahalla[], max = 4) {
  const names = items.slice(0, max).map((m) => m.name);
  return items.length > max ? `${names.join(", ")} va yana ${items.length - max} ta` : names.join(", ");
}

// Xodim: MFY'larni bo'lishib olish. Bo'sh MFY'larni belgilab o'ziga oladi, keyingi xodimga qolgani ko'rinadi.
// O'zinikini bo'shatish yashirin — "Bo'shatish" bosilgandagina belgilash chiqadi.
export function MahallaPicker({ user, active, state }: { user: SessionUser; active: boolean; state: ReturnType<typeof useMahallas> }) {
  const { items, selfAssign, loading, claim, release } = state;
  const [mode, setMode] = useState<Mode>("claim");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const mine = useMemo(() => items.filter((m) => m.assignedToId === user.id), [items, user.id]);
  const free = useMemo(() => items.filter((m) => !m.assignedToId), [items]);
  const others = useMemo(() => {
    const byPerson = new Map<string, { name: string; items: Mahalla[] }>();
    for (const m of items) {
      if (!m.assignedToId || m.assignedToId === user.id) continue;
      const group = byPerson.get(m.assignedToId) ?? { name: m.assignedTo?.fullName ?? "Xodim", items: [] };
      group.items.push(m);
      byPerson.set(m.assignedToId, group);
    }
    return [...byPerson.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [items, user.id]);

  const freeGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? free.filter((m) => [m.name, m.chairmanName].some((v) => v.toLowerCase().includes(q))) : free;
    const bySector = new Map<number | null, Mahalla[]>();
    for (const m of list) bySector.set(m.sector, [...(bySector.get(m.sector) ?? []), m]);
    return [...bySector.entries()].sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity));
  }, [free, query]);
  const hasSectors = free.some((m) => m.sector !== null);

  // Boshqa xodim olib qo'ygan yoki o'zgargan MFY'lar tanlovdan avtomatik tushib qoladi
  const pool = mode === "claim" ? free : mine;
  const selected = useMemo(() => pool.filter((m) => picked.has(m.id)), [pool, picked]);

  const toggle = (id: string) => {
    haptic.select();
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (group: Mahalla[]) => {
    haptic.select();
    const allPicked = group.every((m) => picked.has(m.id));
    setPicked((prev) => {
      const next = new Set(prev);
      for (const m of group) {
        if (allPicked) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setPicked(new Set());
  };

  const submit = async () => {
    if (selected.length === 0) return;
    const ids = selected.map((m) => m.id);
    const question =
      mode === "claim"
        ? `${selected.length} ta MFY sizga biriktiriladi: ${listNames(selected)}.`
        : `${selected.length} ta MFY bo'shatiladi va boshqa xodimlar uni tanlay oladi: ${listNames(selected)}.`;
    if (!(await confirmAction(question))) return;

    setBusy(true);
    try {
      if (mode === "claim") {
        const r = await claim(ids);
        haptic.success();
        if (r.taken > 0) showToast(`${r.claimed} ta olindi, ${r.taken} tasini boshqa xodim olib bo'ldi`, "error");
        else showToast(`${r.claimed} ta MFY sizga biriktirildi`, "success");
      } else {
        const r = await release(ids);
        haptic.success();
        showToast(`${r.released} ta MFY bo'shatildi`, "success");
        setMode("claim");
      }
      setPicked(new Set());
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (items.length === 0) {
    return <EmptyState title="MFY ro'yxati hali yo'q" text="Boshliq MFY'lar ro'yxatini Excel orqali yuklagach, shu yerda o'zingizga tegishlilarini tanlaysiz." />;
  }

  const assigned = items.length - free.length;
  const releasing = mode === "release";

  return (
    <div>
      <div className="mx-3 mt-3 rounded-xl bg-surface px-4 pt-3.5 pb-4">
        <div className="text-[13px] text-hint">Taqsimot</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-[34px] font-semibold leading-none tracking-tight text-ink tabular-nums">{assigned}</span>
          <span className="text-[17px] text-hint tabular-nums">/ {items.length}</span>
          <span className="ml-1 text-[15px] text-hint">MFY bo'lingan</span>
        </div>
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-soft">
          <span className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(mine.length / items.length) * 100}%` }} />
          <span className="h-full bg-hint opacity-50 transition-[width] duration-500" style={{ width: `${((assigned - mine.length) / items.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-hint tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {mine.length} sizda
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-hint opacity-50" />
            {assigned - mine.length} boshqalarda
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border-[1.5px] border-hint" />
            {free.length} bo'sh
          </span>
        </div>
        {!selfAssign && <div className="mt-3 text-[14px] leading-snug text-warn">Boshliq taqsimotni yopgan. O'zgartirish kerak bo'lsa, boshliqqa ayting.</div>}
      </div>

      {!releasing && free.length > 0 && (
        <>
          <div className="px-7 pt-6 text-[13px] uppercase tracking-[0.02em] text-header">{`Bo'sh MFY'lar · ${free.length}`}</div>
          {free.length > 12 && <SearchField value={query} onChange={setQuery} placeholder="MFY yoki rais" />}
          {freeGroups.length === 0 && <EmptyState title="Hech narsa topilmadi" />}
          {freeGroups.map(([sector, group]) => (
            <Section
              key={sector ?? "none"}
              className="!mt-3"
              title={
                hasSectors || selfAssign ? (
                  <SectionTitle
                    text={hasSectors ? `${sectorTitle(sector)} · ${group.length}` : `${group.length} ta`}
                    action={selfAssign && group.length > 1 ? (group.every((m) => picked.has(m.id)) ? "Bekor qilish" : "Hammasi") : undefined}
                    onAction={() => toggleAll(group)}
                  />
                ) : undefined
              }
            >
              {group.map((m) => (
                <Row
                  key={m.id}
                  leading={selfAssign ? <SelectMark checked={picked.has(m.id)} /> : undefined}
                  title={m.name}
                  subtitle={m.chairmanName}
                  onClick={selfAssign ? () => toggle(m.id) : undefined}
                />
              ))}
            </Section>
          ))}
        </>
      )}
      {!releasing && free.length === 0 && <div className="px-7 pt-6 text-center text-[14px] text-hint">Barcha MFY'lar xodimlar o'rtasida bo'lingan</div>}


      <Section
        title={
          <SectionTitle
            text={`Mening MFY'larim · ${mine.length}`}
            action={selfAssign && mine.length > 0 ? (releasing ? "Bekor qilish" : "Bo'shatish") : undefined}
            onAction={() => switchMode(releasing ? "claim" : "release")}
          />
        }
        footer={releasing ? "Bo'shatiladigan MFY'larni belgilang. Ular boshqa xodimlarga bo'sh bo'lib ko'rinadi." : undefined}
      >
        {mine.length === 0 && <Row title={<span className="text-hint">{selfAssign ? "Hali tanlamadingiz — quyidagi bo'sh MFY'lardan belgilang" : "Sizga MFY biriktirilmagan"}</span>} />}
        {mine.map((m) => (
          <Row
            key={m.id}
            leading={releasing ? <SelectMark checked={picked.has(m.id)} danger /> : undefined}
            title={m.name}
            subtitle={[m.chairmanName, m.sector && sectorTitle(m.sector)].filter(Boolean).join(" · ")}
            onClick={releasing ? () => toggle(m.id) : undefined}
          />
        ))}
      </Section>

      {!releasing && others.length > 0 && (
        <Section title="Boshqa xodimlarda">
          {others.map(([id, group]) => (
            <div key={id}>
              <Row
                leading={<Avatar name={group.name} size={32} />}
                title={group.name}
                subtitle={expanded === id ? undefined : listNames(group.items, 3)}
                after={<span className="tabular-nums">{group.items.length}</span>}
                onClick={() => setExpanded(expanded === id ? null : id)}
              />
              {expanded === id &&
                group.items.map((m) => <Row key={m.id} leading={<span className="w-8" />} title={<span className="text-[15px]">{m.name}</span>} subtitle={m.chairmanName} />)}
            </div>
          ))}
        </Section>
      )}

      <div className="h-6" />

      <PrimaryAction
        active={active && selfAssign && selected.length > 0}
        text={releasing ? `${selected.length} tasini bo'shatish` : `${selected.length} ta MFY'ni olish`}
        loading={busy}
        onClick={() => void submit()}
      />
    </div>
  );
}
