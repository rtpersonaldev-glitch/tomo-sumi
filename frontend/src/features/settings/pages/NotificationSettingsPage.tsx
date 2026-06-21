import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useToggleNotification } from "../hooks/useSettings";

const NOTIFICATION_TYPES = [
  { icon: "📢", label: "お知らせ", description: "新しいお知らせが届いたとき" },
  { icon: "⏰", label: "リマインダー", description: "タスクの期限が近づいたとき" },
  { icon: "💬", label: "チャット", description: "新しいメッセージが届いたとき" },
] as const;

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const toggleNotification = useToggleNotification();

  if (!user) return null;

  const isEnabled = user.notification_flag;

  const handleToggle = async () => {
    try {
      await toggleNotification.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-semibold">通知設定</h1>
      </div>

      {/* Info banner */}
      {isEnabled ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          <span className="mt-0.5 shrink-0">💡</span>
          <span>
            通知が有効です。お知らせ・リマインダー・チャットの新着をプッシュ通知でお伝えします。
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="mt-0.5 shrink-0">⚠️</span>
          <span>
            プッシュ通知がオフになっています。重要なお知らせを見逃す可能性があります。
          </span>
        </div>
      )}

      {/* Push notification toggle */}
      <div className="mb-4 rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            プッシュ通知
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div
            className={cn(
              "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-base",
              isEnabled ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/60",
            )}
          >
            {isEnabled ? "🔔" : "🔕"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">プッシュ通知を受け取る</p>
            <p className="text-xs text-muted-foreground">アプリ外でも通知を受信</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={`プッシュ通知を${isEnabled ? "オフ" : "オン"}にする`}
            onClick={handleToggle}
            disabled={toggleNotification.isPending}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              isEnabled ? "bg-primary" : "bg-muted",
            )}
          >
            {toggleNotification.isPending ? (
              <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-white" />
            ) : (
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  isEnabled ? "translate-x-5" : "translate-x-0",
                )}
              />
            )}
          </button>
        </div>
      </div>

      {/* Notification types */}
      <div
        className={cn(
          "rounded-xl border border-border bg-card shadow-sm transition-opacity",
          !isEnabled && "opacity-50",
        )}
      >
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            通知の種類
          </p>
        </div>
        {NOTIFICATION_TYPES.map((item, i) => (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5",
              i > 0 && "border-t border-border",
            )}
          >
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-muted/60 text-base">
              {item.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <span
              className={cn(
                "text-xs font-semibold",
                isEnabled ? "text-primary" : "text-muted-foreground",
              )}
            >
              {isEnabled ? "有効" : "無効"}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        ※ 通知の許可はデバイスの設定からも変更できます
      </p>
    </div>
  );
}
