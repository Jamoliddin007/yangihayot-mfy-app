import { useMemo, useRef, useState } from "react";
import type { CampaignHistoryItem, CampaignKind, Mahalla, Member, Role, SessionUser } from "../types";
import { KIND_LABEL, ROLE_LABEL } from "../types";
import { useCampaign, type NewCampaign } from "../hooks/useCampaign";
import { useList } from "../hooks/useList";
import { useMahallas } from "../hooks/useMahallas";
import { api } from "../lib/api";
import { formatDay, formatSchedule, toDateInput } from "../lib/format";
import { confirmAction, haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { Pager } from "../ui/Pager";
import { Avatar, EmptyState, Row, SearchField, Section, Switch, TextField } from "../ui/List";
import { PlusIcon, UploadIcon } from "../ui/Icons";
import { PrimaryAction } from "../ui/nativeButtons";
import { reachedCount } from "../ui/Status";
import { TaskRow, TaskSheet } from "../sheets/TaskSheet";
import { MahallaSheet } from "../sheets/MahallaSheet";
import { AddMemberSheet, InviteLinkSection, MemberSheet } from "../sheets/MemberSheet";
import { Sheet } from "../ui/Sheet";
import { CampaignSummary, groupByAssignee } from "./shared";

export function BossHome({ user }: { user: SessionUser }) {
  const [page, setPage] = useState(0);
  const campaignState = useCampaign();
  const mahallas = useMahallas();
  const members = useList<Member>("/api/members");

  const reloadPeople = () => {
    void mahallas.reload();
    void members.reload();
  };

  return (
    <Pager tabs={["Topshiriq", "MFY'lar", "Xodimlar"]} index={page} onIndexChange={setPage}>
      <TaskPage user={user} active={page === 0} state={campaignState} mahallas={mahallas.items} />
      <MahallaPage state={mahallas} members={members.items} onChanged={reloadPeople} />
      <MembersPage user={user} members={members.items} mahallas={mahallas.items} loading={members.loading} onChanged={reloadPeople} />
    </Pager>
  );
}

// ---------- 1. Topshiriq ----------

function TaskPage({ user, active, state, mahallas }: { user: SessionUser; active: boolean; state: ReturnType<typeof useCampaign>; mahallas: Mahalla[] }) {
  const { campaign, loading, startTask, resultTask, saveNote, resetTask, createCampaign, closeCampaign } = state;
  const [openId, setOpenId] = useState<string | null>(null);
  const tasks = useMemo(() => campaign?.tasks ?? [], [campaign]);
  const groups = useMemo(() => groupByAssignee(tasks), [tasks]);
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  const handleClose = async () => {
    if (!campaign) return;
    const reached = reachedCount(tasks);
    if (!(await confirmAction(`Yakunlansinmi? ${reached} / ${tasks.length} MFY bilan bog'lanildi. Hisobot guruhga yuboriladi.`))) return;
    try {
      await closeCampaign(campaign.id);
      haptic.success();
      showToast("Yakunlandi, hisobot guruhga yuborildi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  if (loading) return null;
  if (!campaign) return <CreateCampaign active={active} mahallas={mahallas} onCreate={createCampaign} />;

  return (
    <div>
      <CampaignSummary campaign={campaign} tasks={tasks} />
      {groups.map((group) => (
        <Section
          key={group.key}
          title={
            <span className="flex justify-between">
              <span>{group.name}</span>
              <span className="tabular-nums normal-case">
                {reachedCount(group.tasks)} / {group.tasks.length}
              </span>
            </span>
          }
        >
          {group.tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={(t) => setOpenId(t.id)} />
          ))}
        </Section>
      ))}
      <Section footer="Yakunlangach natija belgilab bo'lmaydi va guruhga xodimlar bo'yicha hisobot yuboriladi.">
        <Row title="Yakunlash" tone="danger" center onClick={() => void handleClose()} />
      </Section>

      <TaskSheet
        task={openTask}
        user={user}
        campaignActive={campaign.status === "ACTIVE"}
        onClose={() => setOpenId(null)}
        onStart={startTask}
        onResult={resultTask}
        onSaveNote={saveNote}
        onReset={resetTask}
      />
    </div>
  );
}

const KIND_HINT: Record<CampaignKind, string> = {
  MEETING: "Yig'ilish mavzusi, masalan: Hokimiyatda yig'ilish",
  EVENT: "Tadbir nomi, masalan: Mahalla bayrami",
  OTHER: "Nima haqida xabar berish kerak?",
};

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mx-3 flex rounded-[10px] bg-soft p-0.5">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            haptic.select();
            onChange(key);
          }}
          className={`flex-1 rounded-[8px] py-1.5 text-[14px] font-medium transition ${value === key ? "bg-accent text-on-accent shadow-sm" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Boshliq uchun eng sodda forma: nima, qachon, qayerda
function CreateCampaign({ active, mahallas, onCreate }: { active: boolean; mahallas: Mahalla[]; onCreate: (input: NewCampaign) => Promise<unknown> }) {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const [kind, setKind] = useState<CampaignKind>("MEETING");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInput(tomorrow));
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const history = useList<CampaignHistoryItem>("/api/campaigns");

  const needsTime = kind !== "OTHER";
  const scheduledAt = date && time ? new Date(`${date}T${time}`) : null;
  const valid = title.trim().length >= 2 && (!needsTime || scheduledAt);
  const unassigned = mahallas.filter((m) => !m.assignedToId).length;
  const people = new Set(mahallas.map((m) => m.assignedToId).filter(Boolean)).size;

  const submit = async () => {
    const when = scheduledAt ? ` (${formatSchedule(scheduledAt.toISOString())})` : "";
    if (!(await confirmAction(`${KIND_LABEL[kind]}: ${title.trim()}${when}. Xodimlarga xabar yuborilsinmi?`))) return;
    setSaving(true);
    try {
      await onCreate({
        kind,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: scheduledAt?.toISOString(),
        location: location.trim() || undefined,
      });
      haptic.success();
      showToast("Boshlandi — xodimlarga xabar yuborildi", "success");
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const dateChip = (label: string, value: string) => (
    <button
      type="button"
      onClick={() => {
        haptic.select();
        setDate(value);
      }}
      className={`rounded-full px-3.5 py-1.5 text-[14px] font-medium ${date === value ? "bg-accent text-on-accent" : "bg-surface text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="px-7 pt-5 pb-2 text-[13px] uppercase tracking-[0.02em] text-header">Yangi topshiriq</div>
      <Segmented value={kind} onChange={setKind} options={[["MEETING", "Yig'ilish"], ["EVENT", "Tadbir"], ["OTHER", "Boshqa"]]} />

      <Section title="Nima">
        <TextField value={title} onChange={setTitle} placeholder={KIND_HINT[kind]} />
      </Section>

      <div className="px-7 pt-6 pb-1.5 text-[13px] uppercase tracking-[0.02em] text-header">Qachon{needsTime ? "" : " (ixtiyoriy)"}</div>
      <div className="flex gap-2 px-3 pb-2">
        {dateChip("Bugun", toDateInput(today))}
        {dateChip("Ertaga", toDateInput(tomorrow))}
      </div>
      <div className="mx-3 overflow-hidden rounded-xl bg-surface">
        <label className="list-row flex items-center pl-4">
          <span className="list-row-inner flex min-h-[46px] flex-1 items-center justify-between pr-4">
            <span className="text-ink">Sana</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right text-link outline-none" />
          </span>
        </label>
        <label className="list-row flex items-center pl-4">
          <span className="list-row-inner flex min-h-[46px] flex-1 items-center justify-between pr-4">
            <span className="text-ink">Vaqt</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent text-right text-link outline-none" />
          </span>
        </label>
      </div>

      <Section title="Qayerda (ixtiyoriy)">
        <TextField value={location} onChange={setLocation} placeholder="Masalan: Hokimiyat, majlislar zali" />
      </Section>

      <Section
        title="Izoh (ixtiyoriy)"
        footer={
          unassigned > 0
            ? `${mahallas.length} ta MFY, ${people} kishiga biriktirilgan. Diqqat: ${unassigned} ta MFY hech kimga biriktirilmagan.`
            : `${mahallas.length} ta MFY ${people} kishiga biriktirilgan. Har biriga botdan xabar boradi.`
        }
      >
        <TextField value={description} onChange={setDescription} placeholder="Raislarga qo'shimcha nima deyish kerak" multiline />
      </Section>

      <PrimaryAction text="Boshlash" onClick={() => void submit()} active={active} disabled={!valid} loading={saving} />

      {history.items.length > 0 && (
        <Section title="Oldingilar">
          {history.items.slice(0, 10).map((c) => (
            <Row
              key={c.id}
              title={c.title}
              subtitle={`${KIND_LABEL[c.kind]} · ${c.scheduledAt ? formatSchedule(c.scheduledAt) : formatDay(c.createdAt)}`}
              after={
                <span className="tabular-nums">
                  {c.reached} / {c.total}
                </span>
              }
            />
          ))}
        </Section>
      )}
    </div>
  );
}

// ---------- 2. MFY'lar ----------

function MahallaPage({ state, members, onChanged }: { state: ReturnType<typeof useMahallas>; members: Member[]; onChanged: () => void }) {
  const { items: mahallas, loading, selfAssign, changeSelfAssign, unassignAll } = state;
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Mahalla | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? mahallas.filter((m) => [m.name, m.chairmanName, m.phone].some((v) => v.toLowerCase().includes(q))) : mahallas;
    const byPerson = new Map<string, { name: string; items: Mahalla[] }>();
    for (const m of filtered) {
      const key = m.assignedToId ?? "none";
      const group = byPerson.get(key) ?? { name: m.assignedTo?.fullName ?? "Bo'sh (hech kim olmagan)", items: [] };
      group.items.push(m);
      byPerson.set(key, group);
    }
    return [...byPerson.entries()].sort(([a, ga], [b, gb]) => (a === "none" ? 1 : b === "none" ? -1 : ga.items[0]!.sortOrder - gb.items[0]!.sortOrder));
  }, [mahallas, query]);

  const assignedCount = mahallas.filter((m) => m.assignedToId).length;

  const handleSelfAssign = async (value: boolean) => {
    haptic.select();
    try {
      await changeSelfAssign(value);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleUnassignAll = async () => {
    if (!(await confirmAction(`Barcha ${assignedCount} ta MFY xodimlardan olinadi va bo'sh bo'ladi. Xodimlar qaytadan tanlaydi. Davom etilsinmi?`))) return;
    try {
      const r = await unassignAll();
      if (!selfAssign) await changeSelfAssign(true);
      haptic.success();
      showToast(`${r.count} ta MFY bo'shatildi`, "success");
      onChanged();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.post<{ created: number; updated: number; unknownEmployees: string[] }>("/api/mahalla/import", form);
      const parts = [`${r.created} ta qo'shildi`, `${r.updated} ta yangilandi`];
      if (r.unknownEmployees.length) parts.push(`topilmagan xodim: ${r.unknownEmployees.join(", ")}`);
      showToast(parts.join(", "), r.unknownEmployees.length ? "error" : "success");
      onChanged();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) return null;

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="MFY, rais yoki telefon" />

      {!query && mahallas.length > 0 && (
        <Section
          footer={
            selfAssign
              ? `Xodimlar «MFY'lar» bo'limida bo'sh MFY'larni o'zlari belgilab oladi. ${assignedCount} / ${mahallas.length} bo'lingan. Bo'lib bo'lingach, o'chirib qo'ying.`
              : `Taqsimot yopiq: MFY'larni faqat siz biriktirasiz. ${assignedCount} / ${mahallas.length} bo'lingan.`
          }
        >
          <Row title="Xodimlar o'zlari tanlaydi" after={<Switch checked={selfAssign} onChange={(v) => void handleSelfAssign(v)} />} />
        </Section>
      )}

      {groups.length === 0 && <EmptyState title={query ? "Hech narsa topilmadi" : "MFY'lar yo'q"} text={query ? undefined : "Qo'lda qo'shing yoki Excel'dan yuklang."} />}

      {groups.map(([key, group]) => (
        <Section key={key} title={`${group.name} · ${group.items.length}`}>
          {group.items.map((m) => (
            <Row
              key={m.id}
              leading={<span className="w-5 text-right text-[13px] text-hint tabular-nums">{m.sortOrder}</span>}
              title={m.name}
              subtitle={`${m.chairmanName}${m.sector ? ` · ${m.sector}-sektor` : ""}`}
              chevron
              onClick={() => setEditing(m)}
            />
          ))}
        </Section>
      ))}

      {!query && (
        <Section footer="Excel ustunlari: 1 — MFY nomi, 2 — rais F.I.Sh, 3 — telefon, 4 — mas'ul xodim ismi, 5 — sektor. 4 va 5 ixtiyoriy: mas'ul yozilmasa, xodimlar o'zlari tanlab oladi. Bor MFY qayta qo'shilmaydi — ma'lumoti yangilanadi.">
          <Row leading={<PlusIcon className="h-5 w-5 text-link" />} title="MFY qo'shish" tone="accent" onClick={() => setEditing(null)} />
          <Row leading={<UploadIcon className="h-5 w-5 text-link" />} title={importing ? "Yuklanmoqda..." : "Excel'dan yuklash"} tone="accent" onClick={() => fileRef.current?.click()} />
        </Section>
      )}
      {!query && assignedCount > 0 && (
        <Section footer="Masalan, yangi yil boshida qaytadan bo'lishish uchun.">
          <Row title="Taqsimotni qaytadan boshlash" tone="danger" center onClick={() => void handleUnassignAll()} />
        </Section>
      )}
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleImport(e)} />

      <MahallaSheet open={editing !== undefined} mahalla={editing ?? null} members={members} onClose={() => setEditing(undefined)} onSaved={onChanged} />
    </div>
  );
}

// ---------- 3. Xodimlar ----------

function MembersPage({ user, members, mahallas, loading, onChanged }: { user: SessionUser; members: Member[]; mahallas: Mahalla[]; loading: boolean; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Role | null>(null);
  const [bossLink, setBossLink] = useState<string | null>(null);
  const active = members.filter((m) => m.isActive);
  const bosses = active.filter((m) => m.role === "BOSS");
  const employees = active.filter((m) => m.role === "EMPLOYEE");
  const inactive = members.filter((m) => !m.isActive);
  const openMember = members.find((m) => m.userId === openId) ?? null;

  const inviteBoss = async () => {
    try {
      const { inviteLink } = await api.post<{ inviteLink: string }>("/api/invites", { role: "BOSS" });
      setBossLink(inviteLink);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  if (loading) return null;

  const row = (m: Member) => (
    <Row
      key={m.userId}
      leading={<Avatar name={m.fullName} />}
      title={m.userId === user.id ? `${m.fullName} (siz)` : m.fullName}
      subtitle={`${m.mahallaCount} ta MFY · ${m.joined ? "ulangan" : "taklifni kutmoqda"}`}
      dimmed={!m.isActive}
      chevron
      onClick={() => setOpenId(m.userId)}
    />
  );

  return (
    <div>
      <Section title={`Xodimlar · ${employees.length}`}>
        {employees.map(row)}
        <Row leading={<PlusIcon className="h-5 w-5 text-link" />} title="Xodim qo'shish" tone="accent" onClick={() => setAdding("EMPLOYEE")} />
      </Section>

      <Section title={`Boshliqlar · ${bosses.length}`} footer="Boshliqlar topshiriq beradi, MFY va xodimlarni boshqaradi.">
        {bosses.map(row)}
        <Row leading={<PlusIcon className="h-5 w-5 text-link" />} title="Boshliq taklif qilish" tone="accent" onClick={() => void inviteBoss()} />
      </Section>

      {inactive.length > 0 && <Section title="O'chirilganlar">{inactive.map(row)}</Section>}

      <MemberSheet
        member={openMember}
        me={user.id}
        members={members}
        mahallas={mahallas}
        orgName={user.orgName}
        onClose={() => setOpenId(null)}
        onChanged={onChanged}
      />
      <AddMemberSheet open={adding !== null} role={adding ?? "EMPLOYEE"} orgName={user.orgName} onClose={() => setAdding(null)} onAdded={onChanged} />
      <Sheet open={bossLink !== null} onClose={() => setBossLink(null)} title={`${ROLE_LABEL.BOSS} taklifi`}>
        {bossLink && (
          <InviteLinkSection
            link={bossLink}
            text={`${user.orgName} ilovasiga boshliq sifatida kirish havolasi`}
            footer="Havolani ochgan odam Telegram'dagi ismi bilan boshliq sifatida qo'shiladi. Bir martalik, 14 kun amal qiladi."
          />
        )}
      </Sheet>
    </div>
  );
}
