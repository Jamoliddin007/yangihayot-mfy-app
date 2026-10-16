import { useState } from "react";
import { useSession } from "./hooks/useSession";
import { BossHome } from "./screens/BossHome";
import { EmployeeHome } from "./screens/EmployeeHome";
import { DevLogin } from "./components/DevLogin";
import { ToastHost } from "./components/ToastHost";
import { ProfileSheet } from "./sheets/ProfileSheet";
import { Avatar, EmptyState } from "./ui/List";
import { getDevTelegramId } from "./lib/api";
import { insideTelegram } from "./lib/telegram";

export default function App() {
  const canAuth = insideTelegram || !!getDevTelegramId();

  return (
    // Telegram ko'rsatgan barqaror balandlik: klaviatura ochilganda sahifa sakramaydi
    <div className="flex flex-col" style={{ height: "var(--tg-viewport-stable-height, 100dvh)" }}>
      <ToastHost />
      {canAuth ? <Session /> : <DevLogin />}
    </div>
  );
}

function Session() {
  const { me, user, loading, error, switchOrg, rename } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);

  if (loading) return null;
  if (error || !me) {
    return <EmptyState title="Kirish imkoni yo'q" text={`${error ?? ""}. Botga /start yozing yoki boshliqdan taklif havolasini so'rang.`} />;
  }
  if (!user) {
    return (
      <EmptyState
        title="Siz hali tashkilotga qo'shilmagansiz"
        text="Xodim bo'lsangiz — boshlig'ingizdan taklif havolasini so'rang. Tashkilotingizni ro'yxatdan o'tkazish uchun botga /start yozing."
      />
    );
  }

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 bg-page px-4 pt-2.5 pb-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-hint">{user.orgName}</div>
        </div>
        <button type="button" onClick={() => setProfileOpen(true)} aria-label="Profil" className="shrink-0 active:opacity-70">
          <Avatar name={user.fullName} size={30} />
        </button>
      </header>

      {/* key: tashkilot almashganda butun ekran (va real-time ulanish) yangidan quriladi */}
      {user.role === "BOSS" ? <BossHome key={user.orgId} user={user} /> : <EmployeeHome key={user.orgId} user={user} />}

      <ProfileSheet open={profileOpen} me={me} orgId={user.orgId} onClose={() => setProfileOpen(false)} onRename={rename} onSwitchOrg={switchOrg} />
    </>
  );
}
