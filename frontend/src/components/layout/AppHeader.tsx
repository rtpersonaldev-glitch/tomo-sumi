import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useToggleStatus } from "@/features/settings/hooks/useSettings";
import { useLogout } from "@/features/auth/hooks/useAuth";
import { useUnreadActivityCount } from "@/features/activity/hooks/useActivity";

/* ── ログアウト確認モーダル ────────────────────────────────────────── */

interface LogoutConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function LogoutConfirmModal({ onConfirm, onCancel, isPending }: LogoutConfirmModalProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
      >
        <h2 id="logout-dialog-title" className="text-base font-semibold">
          ログアウト
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          本当にログアウトしますか？
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ログアウト中...
              </span>
            ) : (
              "ログアウト"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── ユーザーメニュー（ボトムシート） ────────────────────────────── */

interface UserMenuSheetProps {
  onClose: () => void;
  onLogoutRequest: () => void;
}

function UserMenuSheet({ onClose, onLogoutRequest }: UserMenuSheetProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const toggleStatus = useToggleStatus();

  if (!user) return null;

  const isAtHome = user.status === "at_home";

  const handleToggleStatus = async () => {
    try {
      await toggleStatus.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleLogoutClick = () => {
    onClose();
    onLogoutRequest();
  };

  const handleNav = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border border-border bg-card pb-safe shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="ユーザーメニュー"
      >
        <div className="mx-auto mt-3 mb-4 h-1 w-9 rounded-full bg-border" />

        {/* User info */}
        <div className="flex items-center gap-3 border-b border-border px-5 pb-4">
          {user.icon_url ? (
            <img
              src={user.icon_url}
              alt={user.nickname}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {user.nickname?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.nickname}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Status toggle */}
        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={toggleStatus.isPending}
          className="flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`在宅ステータスを${isAtHome ? "外出" : "在宅"}に切り替え`}
        >
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-secondary/60 text-base">
            {isAtHome ? "🏠" : "🚶"}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">在宅ステータス</p>
            <p className="text-xs text-muted-foreground">タップで切り替え</p>
          </div>
          {toggleStatus.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                isAtHome
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isAtHome ? "bg-green-500" : "bg-slate-400",
                )}
                aria-hidden="true"
              />
              {isAtHome ? "在宅" : "外出"}
            </span>
          )}
        </button>

        <div className="mx-5 my-1.5 h-px bg-border" />

        {/* Nav items */}
        {[
          { icon: "👤", label: "プロフィール設定", path: "/settings/profile" },
          { icon: "🔔", label: "通知設定", path: "/settings/notifications" },
          { icon: "⚙️", label: "ホーム設定", path: "/settings/home" },
        ].map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => handleNav(item.path)}
            className="flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-secondary/60 text-base">
              {item.icon}
            </div>
            <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
            <span className="text-muted-foreground/50 text-lg leading-none">›</span>
          </button>
        ))}

        <div className="mx-5 my-1.5 h-px bg-border" />

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogoutClick}
          className="flex w-full items-center gap-3 px-5 py-3.5 transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-red-50 text-base dark:bg-red-950/30">
            🚪
          </div>
          <span className="flex-1 text-left text-sm font-medium text-destructive">
            ログアウト
          </span>
        </button>

        <div className="h-6" />
      </div>
    </>
  );
}

/* ── AppHeader ────────────────────────────────────────────────────── */

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const home = useAuthStore((s) => s.home);
  const { data: unreadData } = useUnreadActivityCount();
  const unreadCount = unreadData?.count ?? 0;
  const logout = useLogout();

  if (!user) return null;

  const isAtHome = user.status === "at_home";

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  const handleConfirmLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setLogoutConfirmOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-card/95 px-4 backdrop-blur-sm">
        <span className="flex-1 truncate pr-3 text-base font-semibold">
          {home?.name ?? "ホーム"}
        </span>

        {/* Activity bell */}
        <button
          type="button"
          onClick={() => navigate("/activity")}
          className="relative mr-1 flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={unreadCount > 0 ? `アクティビティ（未読${unreadCount}件）` : "アクティビティ"}
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span
              className="absolute right-0.5 top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-[3px] py-px text-[9px] font-extrabold leading-none text-white ring-2 ring-card"
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="relative ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="ユーザーメニューを開く"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
        >
          {user.icon_url ? (
            <img
              src={user.icon_url}
              alt={user.nickname}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
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
        </button>
      </header>

      {menuOpen && (
        <UserMenuSheet
          onClose={() => setMenuOpen(false)}
          onLogoutRequest={() => setLogoutConfirmOpen(true)}
        />
      )}

      <AnimatePresence>
        {logoutConfirmOpen && (
          <LogoutConfirmModal
            onConfirm={handleConfirmLogout}
            onCancel={() => setLogoutConfirmOpen(false)}
            isPending={logout.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}
