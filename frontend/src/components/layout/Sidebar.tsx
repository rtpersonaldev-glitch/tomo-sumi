import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlarmClock,
  Bell,
  Calendar,
  CheckSquare,
  Home,
  ImageIcon,
  Loader2,
  MessageCircle,
  Newspaper,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useToggleStatus } from "@/features/settings/hooks/useSettings";
import { useUnreadActivityCount } from "@/features/activity/hooks/useActivity";

const NAV_ITEMS = [
  { icon: Home, label: "ホーム", path: "/home" },
  { icon: MessageCircle, label: "チャット", path: "/chat" },
  { icon: Newspaper, label: "投稿", path: "/posts" },
  { icon: Calendar, label: "カレンダー", path: "/schedules" },
  { icon: Bell, label: "お知らせ", path: "/announces" },
  { icon: CheckSquare, label: "TODO", path: "/todos" },
  { icon: AlarmClock, label: "リマインダー", path: "/reminders" },
  { icon: Wallet, label: "家計", path: "/costs" },
  { icon: ImageIcon, label: "アルバム", path: "/albums" },
  { icon: Activity, label: "アクティビティ", path: "/activity" },
] as const;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const home = useAuthStore((s) => s.home);
  const { data: unreadData } = useUnreadActivityCount();
  const unreadCount = unreadData?.count ?? 0;
  const toggleStatus = useToggleStatus();

  if (!user) return null;

  const isAtHome = user.status === "at_home";
  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const handleToggleStatus = async () => {
    try {
      await toggleStatus.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <aside
      className="hidden md:flex md:w-[260px] md:flex-col flex-shrink-0 border-r border-border bg-card"
      aria-label="サイドバーナビゲーション"
    >
      {/* Home name */}
      <div className="flex h-14 items-center border-b border-border px-5">
        <span className="truncate text-base font-bold text-primary">
          {home?.name ?? "ホーム"}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="メインナビゲーション">
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const isActive =
            location.pathname === path ||
            (path !== "/home" && location.pathname.startsWith(path));
          const showBadge = path === "/activity" && unreadCount > 0;

          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {showBadge && (
                <span
                  className="flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 py-0.5 text-[9px] font-extrabold leading-none text-white"
                  aria-label={`未読${unreadCount}件`}
                >
                  {badgeLabel}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="space-y-1 border-t border-border p-3">
        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={toggleStatus.isPending}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/60 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`在宅ステータスを${isAtHome ? "外出" : "在宅"}に切り替え`}
        >
          <div className="relative shrink-0">
            {user.icon_url ? (
              <img
                src={user.icon_url}
                alt={user.nickname}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {user.nickname?.charAt(0) ?? "?"}
              </div>
            )}
            <span
              className={cn(
                "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                isAtHome ? "bg-green-500" : "bg-slate-400",
              )}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold">{user.nickname}</p>
            <p className="text-[10px] text-muted-foreground">
              {isAtHome ? "在宅" : "外出"} · クリックで切替
            </p>
          </div>
          {toggleStatus.isPending && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate("/settings/profile")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden>⚙️</span>
          <span>設定</span>
        </button>
      </div>
    </aside>
  );
}
