import { useState } from "react";
import type { CurrentUser } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { ProgressSummary } from "../components/ProgressSummary";
import { TaskCard } from "../components/TaskCard";
import { CreateCampaignForm } from "../components/CreateCampaignForm";
import { ManageEmployees } from "../components/ManageEmployees";
import { ManageMahalla } from "../components/ManageMahalla";
import { showToast } from "../lib/toast";

type Tab = "tasks" | "employees" | "mahalla";

const ROLE_LABEL: Record<CurrentUser["role"], string> = {
  BOSS: "Boshliq",
  EMPLOYEE: "Xodim",
};

export function Dashboard({ user }: { user: CurrentUser }) {
  const [tab, setTab] = useState<Tab>("tasks");
  const { campaign, loading, startTask, resultTask, resetTask, createCampaign, closeCampaign } = useCampaign();

  const handleClose = async () => {
    if (!campaign) return;
    try {
      await closeCampaign(campaign.id);
      showToast("Vazifa yakunlandi", "success");
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  return (
    <div className="min-h-full bg-gray-50 pb-8">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Yangihayot MFY Uyushmasi</h1>
            <p className="text-xs text-gray-400">
              {user.fullName} · {ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>

        {user.role === "BOSS" && (
          <div className="mt-3 flex gap-1.5 rounded-lg bg-gray-100 p-1">
            {(
              [
                ["tasks", "Vazifalar"],
                ["employees", "Xodimlar"],
                ["mahalla", "Raislar"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                  tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        {tab === "tasks" && (
          <>
            {loading && <p className="text-center text-sm text-gray-400">Yuklanmoqda...</p>}

            {!loading && !campaign && user.role === "BOSS" && <CreateCampaignForm onCreate={createCampaign} />}

            {!loading && !campaign && user.role === "EMPLOYEE" && (
              <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
                <p className="text-gray-500">Hozircha faol vazifa yo'q.</p>
              </div>
            )}

            {campaign && (
              <>
                <ProgressSummary campaign={campaign} />

                {user.role === "BOSS" && campaign.status === "ACTIVE" && (
                  <button
                    onClick={handleClose}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600"
                  >
                    Vazifani yakunlash
                  </button>
                )}

                <div className="space-y-2.5">
                  {campaign.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      currentUser={user}
                      onStart={startTask}
                      onResult={resultTask}
                      onReset={resetTask}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "employees" && user.role === "BOSS" && <ManageEmployees />}
        {tab === "mahalla" && user.role === "BOSS" && <ManageMahalla />}
      </main>
    </div>
  );
}
