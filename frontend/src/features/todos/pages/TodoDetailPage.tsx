import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useTodo, useUpdateTodo, useDeleteTodo } from "../hooks/useTodo";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import type { HomeMemberResponse } from "@/features/home/types";

function UserAvatar({
  member,
  size = "md",
}: {
  member: HomeMemberResponse;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]";
  const ring = size === "sm" ? "ring-[1.5px]" : "ring-2";
  if (member.icon_url) {
    return (
      <img
        src={member.icon_url}
        alt={member.nickname}
        className={`${dim} rounded-full object-cover ${ring} ring-primary/40`}
      />
    );
  }
  return (
    <span
      className={`inline-flex ${dim} items-center justify-center rounded-full bg-primary font-bold text-primary-foreground ${ring} ring-primary/40`}
    >
      {member.nickname.charAt(0)}
    </span>
  );
}

export default function TodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const todoId = parseInt(id!, 10);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useTodo(todoId);
  const { data: members = [] } = useHomeMembers();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const findMember = (userId: number | null): HomeMemberResponse | null =>
    userId ? (members.find((m) => m.id === userId) ?? null) : null;

  const handleToggle = (contentId: number) => {
    if (!data) return;
    const updatedContents = data.contents.map((c) => {
      if (c.id !== contentId) {
        return { content: c.content, check_flag: c.check_flag, checked_by: c.checked_by };
      }
      const newFlag = !c.check_flag;
      return {
        content: c.content,
        check_flag: newFlag,
        checked_by: newFlag ? (currentUser?.id ?? null) : null,
      };
    });
    const allChecked = updatedContents.length > 0 && updatedContents.every((c) => c.check_flag);
    updateTodo.mutate(
      { id: todoId, body: { title: data.title, complete_flag: allChecked, contents: updatedContents } },
      {
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  };

  const handleDelete = async () => {
    try {
      await deleteTodo.mutateAsync(todoId);
      toast.success("TODOリストを削除しました");
      navigate("/todos");
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="読み込み中" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">TODOリストの取得に失敗しました</p>
      </div>
    );
  }

  const total = data.contents.length;
  const checked = data.contents.filter((c) => c.check_flag).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const creator = findMember(data.created_by);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/todos")}
          className="text-sm text-primary hover:underline"
          aria-label="一覧に戻る"
        >
          ‹ 戻る
        </button>
        <h1 className="text-xl font-semibold">TODOリスト詳細</h1>
      </div>

      {/* Detail card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm dark:shadow-none">
        <h2 className="text-xl font-bold leading-snug">{data.title}</h2>

        {/* Creator + date */}
        <div className="flex items-center gap-3 flex-wrap">
          {creator && (
            <div className="flex items-center gap-1.5">
              <UserAvatar member={creator} size="sm" />
              <span className="text-xs text-muted-foreground">{creator.nickname}</span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {format(parseISO(data.created_at), "yyyy年M月d日作成", { locale: ja })}
          </span>
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>進捗</span>
              <span className="font-semibold text-primary">
                {checked} / {total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <hr className="border-border" />

        {/* Items list */}
        {total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">項目がありません</p>
        )}

        <ul className="space-y-0" role="list">
          {data.contents.map((item) => {
            const checker = findMember(item.checked_by);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item.id)}
                  disabled={updateTodo.isPending}
                  aria-label={
                    item.check_flag
                      ? `${item.content} のチェックを外す`
                      : `${item.content} をチェックする`
                  }
                  aria-pressed={item.check_flag}
                  className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full disabled:opacity-50"
                >
                  {item.check_flag && checker ? (
                    <UserAvatar member={checker} size="md" />
                  ) : item.check_flag ? (
                    /* チェック済みだがチェック者不明の場合は自分のアバター or プライマリ丸 */
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary ring-2 ring-primary/30 text-[10px] font-bold text-primary-foreground">
                      ✓
                    </span>
                  ) : (
                    <span className="inline-flex h-6 w-6 rounded-full border-2 border-border bg-background" />
                  )}
                </button>

                <span
                  className={`text-sm flex-1 ${item.check_flag ? "line-through text-muted-foreground" : ""}`}
                >
                  {item.content}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Edit / Delete */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm dark:shadow-none">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/todos/${todoId}/edit`)}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium transition-colors hover:border-primary/40"
          >
            ✏️ 編集
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            disabled={deleteConfirm}
            className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40 dark:border-red-900"
          >
            🗑️ 削除
          </button>
        </div>

        {deleteConfirm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <p className="text-xs text-center text-destructive font-medium">
              このTODOリストを削除しますか？この操作は元に戻せません。
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
                disabled={deleteTodo.isPending}
                className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
              >
                {deleteTodo.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  "削除する"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
