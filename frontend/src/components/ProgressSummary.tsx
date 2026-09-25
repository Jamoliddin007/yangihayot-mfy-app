import type { Campaign } from "../types";
import { STATUS_LABEL, STATUS_STYLE } from "../types";

export function ProgressSummary({ campaign }: { campaign: Campaign }) {
  const total = campaign.tasks.length;
  const done = campaign.tasks.filter((t) => t.status === "REACHED").length;

  const byStatus = campaign.tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const byEmployee = campaign.tasks.reduce<Record<string, number>>((acc, t) => {
    if (t.assignedTo) acc[t.assignedTo.fullName] = (acc[t.assignedTo.fullName] ?? 0) + 1;
    return acc;
  }, {});

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-900">{campaign.title}</p>
        <span className="text-sm font-semibold text-emerald-600">
          {done}/{total}
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((status) => (
          <span key={status} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status].badge}`}>
            {STATUS_LABEL[status]}: {byStatus[status] ?? 0}
          </span>
        ))}
      </div>

      {Object.keys(byEmployee).length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="mb-1 text-xs font-medium text-gray-400">Xodimlar bo'yicha (band qilingan):</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(byEmployee).map(([name, count]) => (
              <span key={name} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {name}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
