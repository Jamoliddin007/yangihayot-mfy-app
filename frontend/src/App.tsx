import { useAuth } from "./hooks/useAuth";
import { BossHome } from "./screens/BossHome";
import { EmployeeHome } from "./screens/EmployeeHome";
import { DevLogin } from "./components/DevLogin";
import { ToastHost } from "./components/ToastHost";
import { EmptyState } from "./ui/List";
import { getDevTelegramId } from "./lib/api";
import { insideTelegram } from "./lib/telegram";

export default function App() {
  const hasDevId = !!getDevTelegramId();
  const { user, loading, error } = useAuth();

  return (
    // Telegram ko'rsatgan barqaror balandlik: klaviatura ochilganda sahifa sakramaydi
    <div className="flex flex-col" style={{ height: "var(--tg-viewport-stable-height, 100dvh)" }}>
      <ToastHost />
      {!insideTelegram && !hasDevId && <DevLogin />}
      {(insideTelegram || hasDevId) && !loading && error && (
        <EmptyState title="Kirish imkoni yo'q" text={`${error}. Botga /start yozing yoki boshliqdan taklif havolasini so'rang.`} />
      )}
      {user && (user.role === "BOSS" ? <BossHome user={user} /> : <EmployeeHome user={user} />)}
    </div>
  );
}
