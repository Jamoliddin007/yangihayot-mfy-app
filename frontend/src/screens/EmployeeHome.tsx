import { useMemo, useState } from "react";
import type { CurrentUser } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { Pager } from "../ui/Pager";
import { Avatar, EmptyState, Row, Section } from "../ui/List";
import { ProgressBar, reachedCount } from "../ui/Status";
import { TaskRow, TaskSheet } from "../sheets/TaskSheet";
import { CampaignSummary, groupByAssignee, sortTasks } from "./shared";

// Xodim: 1-sahifa — o'ziga biriktirilgan MFY'lar, 2-sahifa — jamoa holati (faqat ko'rish)
export function EmployeeHome({ user }: { user: CurrentUser }) {
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const { campaign, loading, startTask, resultTask, resetTask } = useCampaign();

  const allTasks = useMemo(() => campaign?.tasks ?? [], [campaign]);
  const mine = useMemo(() => sortTasks(allTasks.filter((t) => t.assignedToId === user.id)), [allTasks, user.id]);
  const queue = mine.filter((t) => t.status !== "REACHED");
  const done = mine.filter((t) => t.status === "REACHED");
  const groups = useMemo(() => groupByAssignee(allTasks), [allTasks]);
  const openTask = allTasks.find((t) => t.id === openId) ?? null;

  if (loading) return null;

  return (
    <>
      <Pager tabs={["Mening MFY'larim", "Jamoa"]} index={page} onIndexChange={setPage}>
        <div>
          {!campaign && <EmptyState title="Faol topshiriq yo'q" text="Boshliq yangi topshiriq berganda MFY'laringiz shu yerda chiqadi." />}
          {campaign && mine.length === 0 && (
            <EmptyState title="Sizga MFY biriktirilmagan" text="Boshliqdan MFY'larni sizga biriktirishini so'rang." />
          )}
          {campaign && mine.length > 0 && (
            <>
              <CampaignSummary campaign={campaign} tasks={mine} caption="Joriy topshiriq" />
              {queue.length > 0 && (
                <Section title={`Qo'ng'iroq qilish kerak · ${queue.length}`}>
                  {queue.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => setOpenId(t.id)} />
                  ))}
                </Section>
              )}
              {queue.length === 0 && (
                <div className="px-7 pt-6 text-center text-[15px] text-ok">Barcha MFY'lar bilan bog'lanildi</div>
              )}
              {done.length > 0 && (
                <Section title={`Bog'lanildi · ${done.length}`}>
                  {done.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => setOpenId(t.id)} />
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
              <Section title="Xodimlar">
                {groups.map((group) => {
                  const reached = reachedCount(group.tasks);
                  return (
                    <Row
                      key={group.key}
                      leading={<Avatar name={group.name} />}
                      title={group.key === user.id ? `${group.name} (siz)` : group.name}
                      subtitle={
                        <span className="mt-1.5 block">
                          <ProgressBar tasks={group.tasks} height={4} />
                        </span>
                      }
                      after={
                        <span className="tabular-nums">
                          {reached} / {group.tasks.length}
                        </span>
                      }
                    />
                  );
                })}
              </Section>
            </>
          )}
        </div>
      </Pager>

      <TaskSheet
        task={openTask}
        user={user}
        editable={!!openTask && openTask.assignedToId === user.id && campaign?.status === "ACTIVE"}
        onClose={() => setOpenId(null)}
        onStart={startTask}
        onResult={resultTask}
        onReset={resetTask}
      />
    </>
  );
}
