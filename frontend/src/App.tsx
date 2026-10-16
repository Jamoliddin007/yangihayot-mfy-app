import { useAuth } from "./hooks/useAuth";
import { Dashboard } from "./pages/Dashboard";
import { DevLogin } from "./components/DevLogin";
import { ToastHost } from "./components/ToastHost";
import { getDevTelegramId, getInitDataRaw } from "./lib/api";

export default function App() {
  const insideTelegram = !!getInitDataRaw();
  const hasDevId = !!getDevTelegramId();
  const { user, loading, error } = useAuth();

  if (!insideTelegram && !hasDevId) {
    return (
      <>
        <ToastHost />
        <DevLogin />
      </>
    );
  }

  return (
    <>
      <ToastHost />

      {loading && (
        <div className="flex h-screen items-center justify-center">
          <p className="text-hint">Yuklanmoqda...</p>
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto mt-24 max-w-sm rounded-xl bg-surface p-5 text-center shadow ring-1 ring-line">
          <p className="mb-2 font-semibold text-ink">Ruxsat yo'q</p>
          <p className="text-sm text-muted">{error}</p>
          <p className="mt-3 text-xs text-hint">Botga /start yozing yoki boshliqdan taklif havolasini so'rang.</p>
        </div>
      )}

      {!loading && user && <Dashboard user={user} />}
    </>
  );
}
