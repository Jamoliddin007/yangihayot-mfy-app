import type { CallStatus, CallTask, Campaign } from "../types";
import { KIND_LABEL, STATUS_ORDER, STATUS_TONE } from "../types";
import { formatSchedule } from "../lib/format";
import { ProgressBar, reachedCount } from "../ui/Status";

export interface TaskGroup {
  key: string;
  name: string;
  tasks: CallTask[];
}

export function sortTasks(tasks: CallTask[]) {
  return [...tasks].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.mahalla.sortOrder - b.mahalla.sortOrder,
  );
}

// Vazifalarni mas'ul xodim bo'yicha guruhlash; biriktirilmaganlar oxirida
export function groupByAssignee(tasks: CallTask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = task.assignedTo?.id ?? "none";
    const group = groups.get(key) ?? { key, name: task.assignedTo?.fullName ?? "Biriktirilmagan", tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, tasks: sortTasks(g.tasks) }))
    .sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : a.name.localeCompare(b.name)));
}

const LEGEND: [CallStatus, string][] = [
  ["REACHED", "bog'landi"],
  ["NO_ANSWER", "ko'tarmadi"],
  ["PHONE_OFF", "o'chiq"],
  ["PENDING", "navbatda"],
];

// Topshiriq: nima, qachon, qayerda + katta raqam + ko'p rangli progress
export function CampaignSummary({ campaign, tasks, caption }: { campaign: Campaign; tasks: CallTask[]; caption?: string }) {
  const reached = reachedCount(tasks);
  const count = (status: CallStatus) =>
    tasks.filter((t) => (status === "PENDING" ? t.status === "PENDING" || t.status === "IN_PROGRESS" : t.status === status)).length;

  return (
    <div className="mx-3 mt-3 rounded-xl bg-surface px-4 pt-3.5 pb-4">
      <div className="text-[13px] text-hint">{caption ?? KIND_LABEL[campaign.kind]}</div>
      <div className="mt-0.5 text-[17px] font-semibold leading-snug text-ink">{campaign.title}</div>
      {(campaign.scheduledAt || campaign.location) && (
        <div className="mt-1 text-[15px] font-medium text-link">
          {[campaign.scheduledAt && formatSchedule(campaign.scheduledAt), campaign.location].filter(Boolean).join(" · ")}
        </div>
      )}
      {campaign.description && <div className="mt-1 text-[14px] leading-snug text-muted">{campaign.description}</div>}

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[34px] font-semibold leading-none tracking-tight text-ink tabular-nums">{reached}</span>
        <span className="text-[17px] text-hint tabular-nums">/ {tasks.length}</span>
        <span className="ml-1 text-[15px] text-hint">bog'lanildi</span>
      </div>
      <div className="mt-3">
        <ProgressBar tasks={tasks} height={8} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-hint">
        {LEGEND.map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1.5 tabular-nums">
            <span className={`h-2 w-2 rounded-full ${STATUS_TONE[status].dot}`} />
            {count(status)} {label}
          </span>
        ))}
      </div>
    </div>
  );
}
