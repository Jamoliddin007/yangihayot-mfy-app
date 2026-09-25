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
          <p className="text-gray-400">Yuklanmoqda...</p>
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto mt-24 max-w-sm rounded-xl bg-white p-5 text-center shadow ring-1 ring-black/5">
          <p className="mb-2 font-semibold text-gray-900">Ruxsat yo'q</p>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="mt-3 text-xs text-gray-400">Botga /start yozing yoki boshliqdan taklif havolasini so'rang.</p>
        </div>
      )}

      {!loading && user && <Dashboard user={user} />}
    </>
  );
}
