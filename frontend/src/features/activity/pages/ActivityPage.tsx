import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useActivityLogs,
  useMarkActivityAsRead,
  type ActivityLog,
} from "../hooks/useActivity";

const CATEGORY_LABEL: Record<string, string> = {
  todo: "TODO",
  schedule: "スケジュール",
  announce: "お知らせ",
  post: "投稿",
  album: "アルバム",
  reminder: "リマインダー",
  cost: "家計",
  seisan: "清算",
  chat: "チャット",
};

function resolveActivityPath(targetType: string, targetId: number | null): string | null {
  switch (targetType) {
    case "todo":
      return targetId != null ? `/todos/${targetId}` : null;
    case "schedule":
      return targetId != null ? `/schedules/${targetId}` : null;
    case "announce":
      return targetId != null ? `/announces/${targetId}` : null;
    case "post":
      return targetId != null ? `/posts/${targetId}` : null;
    case "album":
      return targetId != null ? `/albums/${targetId}` : null;
    case "cost":
      return targetId != null ? `/costs/${targetId}` : null;
    case "seisan":
      return targetId != null ? `/costs/seisan/${targetId}` : null;
    case "reminder":
      return "/reminders";
    case "chat":
      return "/chat";
    default:
      return null;
  }
}

function ActivityCard({ log }: { log: ActivityLog }) {
  const navigate = useNavigate();
  const initial = log.nickname?.charAt(0) ?? "?";
  const categoryLabel = CATEGORY_LABEL[log.target_type] ?? log.target_type;
  const relativeTime = formatDistanceToNow(parseISO(log.created_at), {
    addSuffix: true,
    locale: ja,
  });
  const path = resolveActivityPath(log.target_type, log.target_id);

  const handleClick = () => {
    if (!path) {
      toast.error("この項目は削除されています");
      return;
    }
    navigate(path);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:shadow-none",
        !log.is_read && "border-l-[3px] border-l-primary bg-primary/5",
      )}
    >
      {log.icon_url ? (
        <img
          src={log.icon_url}
          alt={log.nickname ?? ""}
          className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initial}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-semibold text-primary">{log.nickname}</span>
          <span className="text-foreground">さんが{log.action}</span>
          {log.target_label && (
            <span className="font-medium">「{log.target_label}」</span>
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            {categoryLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">{relativeTime}</span>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        {!log.is_read && (
          <span
            className="h-2 w-2 rounded-full bg-primary"
            aria-hidden="true"
          />
        )}
        {path && (
          <span className="text-lg leading-none text-muted-foreground/50" aria-hidden="true">
            ›
          </span>
        )}
      </div>
    </button>
  );
}

export default function ActivityPage() {
  const { data, isLoading, isError } = useActivityLogs();
  const markAsRead = useMarkActivityAsRead();
  const markedRef = useRef(false);

  useEffect(() => {
    if (data && !markedRef.current) {
      markedRef.current = true;
      markAsRead.mutate();
    }
  }, [data]);

  const unread = data?.filter((l) => !l.is_read) ?? [];
  const read = data?.filter((l) => l.is_read) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">アクティビティ</h1>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="読み込み中" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          アクティビティの取得に失敗しました
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <span className="text-4xl" aria-hidden>📋</span>
          <p className="text-sm">まだアクティビティがありません</p>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <>
          {unread.length > 0 && (
            <section aria-label="新着">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                新着（{unread.length}件）
              </p>
              <div className="space-y-2">
                {unread.map((log) => (
                  <ActivityCard key={log.id} log={log} />
                ))}
              </div>
            </section>
          )}

          {read.length > 0 && (
            <section aria-label="過去のアクティビティ">
              {unread.length > 0 && (
                <div className="my-4 border-t border-border" />
              )}
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                過去のアクティビティ
              </p>
              <div className="space-y-2">
                {read.map((log) => (
                  <ActivityCard key={log.id} log={log} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
