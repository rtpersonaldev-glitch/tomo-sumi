import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
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

function ActivityCard({ log }: { log: ActivityLog }) {
  const initial = log.nickname.charAt(0);
  const categoryLabel = CATEGORY_LABEL[log.target_type] ?? log.target_type;
  const relativeTime = formatDistanceToNow(parseISO(log.created_at), {
    addSuffix: true,
    locale: ja,
  });

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm dark:shadow-none",
        !log.is_read && "border-l-[3px] border-l-primary bg-primary/5",
      )}
    >
      {log.icon_url ? (
        <img
          src={log.icon_url}
          alt={log.nickname}
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

      {!log.is_read && (
        <span
          className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default function ActivityPage() {
  const { data, isLoading, isError } = useActivityLogs();
  const markAsRead = useMarkActivityAsRead();

  useEffect(() => {
    markAsRead.mutate();
  }, []);

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
