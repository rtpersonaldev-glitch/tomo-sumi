import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import type { HomeMemberResponse } from "@/features/home/types";
import { useAuthStore } from "@/store/authStore";
import {
  useReminders,
  useDeleteReminder,
  useDeleteReminderContent,
  useToggleReminderContent,
} from "../hooks/useReminder";
import type { ReminderResponse } from "../types";

type StatusFilter = "all" | "incomplete" | "complete";

const REPEAT_LABEL: Record<string, string> = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
};

function MemberAvatar({
  member,
  size = "sm",
}: {
  member: HomeMemberResponse;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]";
  if (member.icon_url) {
    return (
      <img
        src={member.icon_url}
        alt={member.nickname}
        className={cn(dim, "rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "inline-flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
      )}
    >
      {member.nickname.charAt(0)}
    </span>
  );
}

function CreatorChip({
  userId,
  members,
  size = "sm",
}: {
  userId: number | null;
  members: HomeMemberResponse[];
  size?: "sm" | "md";
}) {
  if (!userId) return null;
  const member = members.find((m) => m.id === userId);
  if (!member) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <MemberAvatar member={member} size={size} />
      <span className="text-xs text-muted-foreground">{member.nickname}</span>
    </span>
  );
}

function GroupCard({
  reminder,
  members,
  currentUserId,
  onToggle,
  onDelete,
  onDeleteContent,
  isToggling,
}: {
  reminder: ReminderResponse;
  members: HomeMemberResponse[];
  currentUserId: number | undefined;
  onToggle: (contentId: number) => void;
  onDelete: (id: number) => void;
  onDeleteContent: (contentId: number, reminderId: number) => void;
  isToggling: boolean;
}) {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteContentConfirmId, setDeleteContentConfirmId] = useState<number | null>(null);
  const deleteReminder = useDeleteReminder();
  const deleteContent = useDeleteReminderContent();

  const allActive =
    reminder.contents.length > 0 && reminder.contents.every((c) => c.is_active);

  const handleDelete = async () => {
    try {
      await deleteReminder.mutateAsync(reminder.id);
      toast.success("リマインダーを削除しました");
      onDelete(reminder.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteConfirm(false);
    }
  };

  const handleDeleteContent = async (contentId: number) => {
    try {
      await deleteContent.mutateAsync({ contentId, reminderId: reminder.id });
      toast.success("項目を削除しました");
      onDeleteContent(contentId, reminder.id);
      setDeleteContentConfirmId(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteContentConfirmId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm dark:shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 bg-secondary/30 border-b border-border">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base leading-snug">{reminder.list_name}</span>
            {allActive && reminder.contents.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                ✓ 全完了
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <CreatorChip userId={reminder.created_by} members={members} size="sm" />
            <span className="text-xs text-muted-foreground">
              · {format(parseISO(reminder.created_at), "yyyy年M月d日", { locale: ja })} 作成
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/reminders/${reminder.id}/edit`)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-sm transition-colors hover:border-primary/40"
            aria-label={`${reminder.list_name} を編集`}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            disabled={deleteConfirm}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-background text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40 dark:border-red-900"
            aria-label={`${reminder.list_name} を削除`}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Content items */}
      {reminder.contents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">項目がありません</p>
      ) : (
        <ul className="divide-y divide-border" role="list">
          {reminder.contents.map((item) => (
            <li key={item.id}>
              <div className="flex items-start gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  disabled={isToggling}
                  aria-label={item.is_active ? `${item.title} のチェックを外す` : `${item.title} をチェックする`}
                  aria-pressed={item.is_active}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    item.is_active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background",
                  )}
                >
                  {item.is_active && (
                    <span className="text-[11px] font-bold leading-none">✓</span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      item.is_active && "line-through text-muted-foreground",
                    )}
                  >
                    {item.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <CreatorChip userId={item.created_by} members={members} size="sm" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                  {item.time && (
                    <span className="text-[10px] text-muted-foreground">
                      {item.time.slice(0, 5)}
                    </span>
                  )}
                  {item.repeat && REPEAT_LABEL[item.repeat] && (
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                      {REPEAT_LABEL[item.repeat]}
                    </span>
                  )}
                  {(item.created_by === null || item.created_by === currentUserId) && (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/reminders/contents/${item.id}/edit`)}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label={`${item.title} を編集`}
                      >
                        <span className="text-[11px]">✏️</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteContentConfirmId(item.id)}
                        disabled={deleteContent.isPending}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        aria-label={`${item.title} を削除`}
                      >
                        <span className="text-[11px]">🗑️</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {deleteContentConfirmId === item.id && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <span className="flex-1 text-xs text-destructive">この項目を削除しますか？</span>
                  <button
                    type="button"
                    onClick={() => setDeleteContentConfirmId(null)}
                    className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteContent(item.id)}
                    disabled={deleteContent.isPending}
                    className="flex items-center gap-1 rounded bg-destructive px-2 py-0.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    {deleteContent.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      "削除"
                    )}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add item */}
      <button
        type="button"
        onClick={() => navigate(`/reminders/${reminder.id}/contents/new`)}
        className="flex w-full items-center gap-1.5 border-t border-dashed border-border px-4 py-2.5 text-xs font-semibold text-primary hover:bg-secondary/30 transition-colors"
      >
        ＋ 項目を追加
      </button>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-3 space-y-2">
          <p className="text-xs text-center text-destructive font-medium">
            このリマインダーを削除しますか？この操作は元に戻せません。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteReminder.isPending}
              className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
            >
              {deleteReminder.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                "削除する"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReminderListPage() {
  const navigate = useNavigate();
  const { data: reminders, isLoading, isError } = useReminders();
  const { data: members = [] } = useHomeMembers();
  const toggleContent = useToggleReminderContent();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredReminders = useMemo(() => {
    if (!reminders) return [];
    const q = searchQuery.trim().toLowerCase();
    return reminders.filter((r) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "complete" && r.complete_flag) ||
        (statusFilter === "incomplete" && !r.complete_flag);
      const matchesQuery =
        q === "" ||
        r.list_name.toLowerCase().includes(q) ||
        r.contents.some((c) => c.title.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [reminders, searchQuery, statusFilter]);

  const handleToggle = (contentId: number, reminderId: number) => {
    toggleContent.mutate(
      { contentId, reminderId },
      { onError: (err) => toast.error(getErrorMessage(err)) },
    );
  };

  const handleDeleteContent = () => {};

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "incomplete", label: "未完了" },
    { value: "complete", label: "完了" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">リマインダー</h1>
        <button
          type="button"
          onClick={() => navigate("/reminders/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
        >
          ＋ 作成
        </button>
      </div>

      {/* フィルターバー */}
      {!isLoading && !isError && (reminders?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワードで検索..."
              aria-label="リマインダーを検索"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
            />
          </div>
          <div
            className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit"
            role="group"
            aria-label="完了ステータスで絞り込み"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                aria-pressed={statusFilter === tab.value}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  statusFilter === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="読み込み中" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          リマインダーの取得に失敗しました
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {reminders?.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>🔔</span>
              <p className="text-sm">まだリマインダーがありません</p>
            </div>
          )}

          {(reminders?.length ?? 0) > 0 && filteredReminders.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>🔍</span>
              <p className="text-sm">条件に一致するリマインダーがありません</p>
            </div>
          )}

          <div className="space-y-4">
            {filteredReminders.map((reminder) => (
              <GroupCard
                key={reminder.id}
                reminder={reminder}
                members={members}
                currentUserId={currentUserId}
                onToggle={(contentId) => handleToggle(contentId, reminder.id)}
                onDelete={() => {}}
                onDeleteContent={handleDeleteContent}
                isToggling={toggleContent.isPending}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
