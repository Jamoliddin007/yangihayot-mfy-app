import { useMemo, useRef, useState } from "react";
import type { CurrentUser, Employee, Mahalla } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { useList } from "../hooks/useList";
import { api } from "../lib/api";
import { confirmAction, haptic } from "../lib/telegram";
import { showToast } from "../lib/toast";
import { Pager } from "../ui/Pager";
import { Avatar, EmptyState, Row, Section, TextField } from "../ui/List";
import { PlusIcon, SearchIcon, UploadIcon } from "../ui/Icons";
import { PrimaryAction } from "../ui/nativeButtons";
import { reachedCount } from "../ui/Status";
import { TaskRow, TaskSheet } from "../sheets/TaskSheet";
import { MahallaSheet } from "../sheets/MahallaSheet";
import { AddEmployeeSheet, EmployeeSheet } from "../sheets/EmployeeSheet";
import { CampaignSummary, groupByAssignee } from "./shared";

const MAX_EMPLOYEES = 5;

export function BossHome({ user }: { user: CurrentUser }) {
  const [page, setPage] = useState(0);
  const campaignState = useCampaign();
  const mahallas = useList<Mahalla>("/api/mahalla");
  const employees = useList<Employee>("/api/users");

  const reloadPeople = () => {
    void mahallas.reload();
    void employees.reload();
  };

  return (
    <Pager tabs={["Topshiriq", "Raislar", "Xodimlar"]} index={page} onIndexChange={setPage}>
      <TaskPage user={user} active={page === 0} state={campaignState} mahallas={mahallas.items} />
      <MahallaPage mahallas={mahallas.items} employees={employees.items} loading={mahallas.loading} onChanged={reloadPeople} />
      <EmployeesPage employees={employees.items} mahallas={mahallas.items} loading={employees.loading} onChanged={reloadPeople} />
    </Pager>
  );
}

// ---------- 1. Topshiriq ----------

function TaskPage({
  user,
  active,
  state,
  mahallas,
}: {
  user: CurrentUser;
  active: boolean;
  state: ReturnType<typeof useCampaign>;
  mahallas: Mahalla[];
}) {
  const { campaign, loading, startTask, resultTask, resetTask, createCampaign, closeCampaign } = state;
  const [openId, setOpenId] = useState<string | null>(null);
  const tasks = useMemo(() => campaign?.tasks ?? [], [campaign]);
  const groups = useMemo(() => groupByAssignee(tasks), [tasks]);
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  const handleClose = async () => {
    if (!campaign) return;
    const reached = reachedCount(tasks);
    if (!(await confirmAction(`Topshiriq yakunlansinmi? ${reached} / ${tasks.length} MFY bilan bog'lanildi. Hisobot guruhga yuboriladi.`))) return;
    try {
      await closeCampaign(campaign.id);
      haptic.success();
      showToast("Topshiriq yakunlandi, hisobot guruhga yuborildi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  if (loading) return null;
  if (!campaign) return <CreateCampaign active={active} mahallas={mahallas} onCreate={createCampaign} />;

  return (
    <div>
      <CampaignSummary campaign={campaign} tasks={tasks} caption="Joriy topshiriq" />
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
      <Section footer="Yakunlangach xodimlar natija belgilay olmaydi va guruhga yakuniy hisobot yuboriladi.">
        <Row title="Topshiriqni yakunlash" tone="danger" center onClick={() => void handleClose()} />
      </Section>

      <TaskSheet
        task={openTask}
        user={user}
        editable={campaign.status === "ACTIVE"}
        onClose={() => setOpenId(null)}
        onStart={startTask}
        onResult={resultTask}
        onReset={resetTask}
      />
    </div>
  );
}

function CreateCampaign({
  active,
  mahallas,
  onCreate,
}: {
  active: boolean;
  mahallas: Mahalla[];
  onCreate: (title: string, description?: string) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const unassigned = mahallas.filter((m) => !m.assignedToId).length;
  const employeeCount = new Set(mahallas.map((m) => m.assignedToId).filter(Boolean)).size;

  const submit = async () => {
    setSaving(true);
    try {
      await onCreate(title.trim(), description.trim() || undefined);
      haptic.success();
      showToast("Topshiriq boshlandi", "success");
      setTitle("");
      setDescription("");
    } catch (err) {
      haptic.error();
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <EmptyState title="Faol topshiriq yo'q" text="Yangi topshiriq bering — har bir xodim o'ziga biriktirilgan MFY raislariga qo'ng'iroq qiladi." />
      <Section
        title="Yangi topshiriq"
        footer={
          unassigned > 0
            ? `${mahallas.length} ta MFY, ${employeeCount} ta xodim. Diqqat: ${unassigned} ta MFY hech kimga biriktirilmagan — «Raislar» bo'limida biriktiring.`
            : `${mahallas.length} ta MFY ${employeeCount} ta xodimga taqsimlangan.`
        }
      >
        <TextField value={title} onChange={setTitle} placeholder="Nima haqida xabar berish kerak?" />
        <TextField value={description} onChange={setDescription} placeholder="Qo'shimcha izoh (ixtiyoriy)" multiline />
      </Section>
      <PrimaryAction text="Topshiriqni boshlash" onClick={() => void submit()} active={active} disabled={!title.trim()} loading={saving} />
    </div>
  );
}

// ---------- 2. Raislar ----------

function MahallaPage({
  mahallas,
  employees,
  loading,
  onChanged,
}: {
  mahallas: Mahalla[];
  employees: Employee[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Mahalla | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? mahallas.filter((m) => [m.name, m.chairmanName, m.phone].some((v) => v.toLowerCase().includes(q)))
      : mahallas;
    const byEmployee = new Map<string, { name: string; items: Mahalla[] }>();
    for (const m of filtered) {
      const key = m.assignedToId ?? "none";
      const group = byEmployee.get(key) ?? { name: m.assignedTo?.fullName ?? "Biriktirilmagan", items: [] };
      group.items.push(m);
      byEmployee.set(key, group);
    }
    return [...byEmployee.entries()].sort(([a, ga], [b, gb]) => (a === "none" ? 1 : b === "none" ? -1 : ga.name.localeCompare(gb.name)));
  }, [mahallas, query]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.post<{ created: number; assigned: number; skipped: number; unknownEmployees: string[] }>("/api/mahalla/import", form);
      const parts = [`${r.created} ta qo'shildi`, `${r.assigned} ta biriktirildi`];
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
      <div className="px-3 pt-3">
        <label className="flex h-9 items-center gap-2 rounded-[10px] bg-soft px-2.5 text-hint">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="MFY, rais yoki telefon"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-hint"
          />
        </label>
      </div>

      {groups.length === 0 && <EmptyState title={query ? "Hech narsa topilmadi" : "MFY'lar yo'q"} />}

      {groups.map(([key, group]) => (
        <Section key={key} title={`${group.name} · ${group.items.length}`}>
          {group.items.map((m) => (
            <Row key={m.id} title={m.name} subtitle={`${m.chairmanName} · ${m.phone}`} chevron onClick={() => setEditing(m)} />
          ))}
        </Section>
      ))}

      {!query && (
        <Section footer="Excel: 1-ustun MFY nomi, 2-ustun rais F.I.Sh, 3-ustun telefon, 4-ustun mas'ul xodim ismi (ixtiyoriy). Bor MFY qayta qo'shilmaydi — faqat mas'uli yangilanadi.">
          <Row leading={<PlusIcon className="h-5 w-5 text-link" />} title="MFY qo'shish" tone="accent" onClick={() => setEditing(null)} />
          <Row
            leading={<UploadIcon className="h-5 w-5 text-link" />}
            title={importing ? "Yuklanmoqda..." : "Excel'dan yuklash"}
            tone="accent"
            onClick={() => fileRef.current?.click()}
          />
        </Section>
      )}
      <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleImport(e)} />

      <MahallaSheet
        open={editing !== undefined}
        mahalla={editing ?? null}
        employees={employees}
        onClose={() => setEditing(undefined)}
        onSaved={onChanged}
      />
    </div>
  );
}

// ---------- 3. Xodimlar ----------

function EmployeesPage({
  employees,
  mahallas,
  loading,
  onChanged,
}: {
  employees: Employee[];
  mahallas: Mahalla[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const active = employees.filter((e) => e.isActive);
  const inactive = employees.filter((e) => !e.isActive);
  const openEmployee = employees.find((e) => e.id === openId) ?? null;

  if (loading) return null;

  const row = (e: Employee) => (
    <Row
      key={e.id}
      leading={<Avatar name={e.fullName} />}
      title={e.fullName}
      subtitle={`${e._count.mahallas} ta MFY · ${e.telegramId ? "ulangan" : "taklifni kutmoqda"}`}
      dimmed={!e.isActive}
      chevron
      onClick={() => setOpenId(e.id)}
    />
  );

  return (
    <div>
      <Section title={`Xodimlar · ${active.length}`} footer={`Ko'pi bilan ${MAX_EMPLOYEES} ta faol xodim.`}>
        {active.map(row)}
        {active.length < MAX_EMPLOYEES && (
          <Row leading={<PlusIcon className="h-5 w-5 text-link" />} title="Xodim qo'shish" tone="accent" onClick={() => setAdding(true)} />
        )}
      </Section>

      {inactive.length > 0 && <Section title="O'chirilganlar">{inactive.map(row)}</Section>}

      <Section title="Umumiy">
        <Row title="MFY'lar" after={<span className="tabular-nums">{mahallas.length}</span>} />
        <Row title="Biriktirilmagan" after={<span className="tabular-nums">{mahallas.filter((m) => !m.assignedToId).length}</span>} />
      </Section>

      <EmployeeSheet employee={openEmployee} employees={employees} mahallas={mahallas} onClose={() => setOpenId(null)} onChanged={onChanged} />
      <AddEmployeeSheet open={adding} onClose={() => setAdding(false)} onAdded={onChanged} />
    </div>
  );
}
