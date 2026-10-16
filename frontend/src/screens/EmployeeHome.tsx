import { useEffect, useMemo, useRef, useState } from "react";
import type { SessionUser } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { useMahallas } from "../hooks/useMahallas";
import { Pager } from "../ui/Pager";
import { EmptyState, Section } from "../ui/List";
import { reachedCount } from "../ui/Status";
import { TaskRow, TaskSheet } from "../sheets/TaskSheet";
import { CampaignSummary, groupByAssignee, sortTasks } from "./shared";
import { MahallaPicker } from "./MahallaPicker";

// Xodim: 1-sahifa — topshiriq bo'yicha o'z MFY'lari; 2-sahifa — jamoa: hammaning MFY'lari va holati
// (boshqanikiga faqat "Yordam berish" orqali qo'ng'iroq qilinadi); 3-sahifa — MFY'larni bo'lishib olish
export function EmployeeHome({ user }: { user: SessionUser }) {
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const { campaign, loading, startTask, resultTask, saveNote, resetTask } = useCampaign();
  const mahallas = useMahallas();

  // Hali MFY tanlamagan xodim (faol topshiriq yo'q paytda) ilovani ochsa — darhol tanlash sahifasi
  const routed = useRef(false);
  useEffect(() => {
    if (routed.current || loading || mahallas.loading) return;
    routed.current = true;
    const hasOwn = mahallas.items.some((m) => m.assignedToId === user.id);
    const hasFree = mahallas.items.some((m) => !m.assignedToId);
    if (!campaign && !hasOwn && hasFree && mahallas.selfAssign) setPage(2);
  }, [loading, mahallas.loading, mahallas.items, mahallas.selfAssign, campaign, user.id]);

  const allTasks = useMemo(() => campaign?.tasks ?? [], [campaign]);
  const mine = useMemo(() => sortTasks(allTasks.filter((t) => t.assignedToId === user.id)), [allTasks, user.id]);
  const queue = mine.filter((t) => t.status !== "REACHED");
  const done = mine.filter((t) => t.status === "REACHED");
  // O'z guruhi birinchi, keyin boshqalar
  const groups = useMemo(
    () => groupByAssignee(allTasks).sort((a, b) => (a.key === user.id ? -1 : b.key === user.id ? 1 : 0)),
    [allTasks, user.id],
  );
  const openTask = allTasks.find((t) => t.id === openId) ?? null;
  const open = (id: string) => setOpenId(id);

  if (loading) return null;

  return (
    <>
      <Pager tabs={["Topshiriq", "Jamoa", "MFY'lar"]} index={page} onIndexChange={setPage}>
        <div>
          {!campaign && <EmptyState title="Faol topshiriq yo'q" text="Boshliq topshiriq berganda MFY'laringiz shu yerda chiqadi va botdan xabar keladi." />}
          {campaign && mine.length === 0 && (
            <EmptyState
              title="Sizga MFY biriktirilmagan"
              text={
                mahallas.selfAssign
                  ? "«MFY'lar» bo'limida o'zingizga tegishli MFY'larni tanlang. «Jamoa» bo'limida boshqalarga yordam berishingiz mumkin."
                  : "Boshliqdan MFY'larni sizga biriktirishini so'rang. «Jamoa» bo'limida boshqalarga yordam berishingiz mumkin."
              }
            />
          )}
          {campaign && mine.length > 0 && (
            <>
              <CampaignSummary campaign={campaign} tasks={mine} />
              {queue.length > 0 && (
                <Section title={`Qo'ng'iroq qilish kerak · ${queue.length}`}>
                  {queue.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => open(t.id)} />
                  ))}
                </Section>
              )}
              {queue.length === 0 && <div className="px-7 pt-6 text-center text-[15px] text-ok">Barcha MFY'laringiz bilan bog'lanildi</div>}
              {done.length > 0 && (
                <Section title={`Bog'lanildi · ${done.length}`}>
                  {done.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => open(t.id)} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        <div>
          {!campaign && <EmptyState title="Faol topshiriq yo'q" />}
          {campaign && (
            <>
              <CampaignSummary campaign={campaign} tasks={allTasks} caption="Umumiy holat" />
              {groups.map((group) => (
                <Section
                  key={group.key}
                  title={
                    <span className="flex justify-between">
                      <span>{group.key === user.id ? `${group.name} (siz)` : group.name}</span>
                      <span className="tabular-nums normal-case">
                        {reachedCount(group.tasks)} / {group.tasks.length}
                      </span>
                    </span>
                  }
                >
                  {group.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => open(t.id)} />
                  ))}
                </Section>
              ))}
            </>
          )}
        </div>

        <MahallaPicker user={user} active={page === 2} state={mahallas} />
      </Pager>

      <TaskSheet
        task={openTask}
        user={user}
        campaignActive={campaign?.status === "ACTIVE"}
        onClose={() => setOpenId(null)}
        onStart={startTask}
        onResult={resultTask}
        onSaveNote={saveNote}
        onReset={resetTask}
      />
    </>
  );
}
