import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useTodos, useDeleteTodo } from "../hooks/useTodo";
import { SwipeToDeleteRow } from "@/components/SwipeToDeleteRow";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import type { HomeMemberResponse } from "@/features/home/types";

function MemberChip({ member }: { member: HomeMemberResponse | null }) {
  if (!member) return null;
  return (
    <span className="flex items-center gap-1">
      {member.icon_url ? (
        <img
          src={member.icon_url}
          alt={member.nickname}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          {member.nickname.charAt(0)}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{member.nickname}</span>
    </span>
  );
}

export default function TodoListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState<"" | "created_at">("");

  const params = {
    ...(search ? { search } : {}),
    ...(ordering ? { ordering } : {}),
  };

  const { data: todos, isLoading, isError } = useTodos(params);
  const { data: members = [] } = useHomeMembers();
  const deleteTodo = useDeleteTodo();

  const handleDelete = (id: number) => {
    deleteTodo.mutate(id, {
      onSuccess: () => toast.success("TODOリストを削除しました"),
      onError: (err) => toast.error(getErrorMessage(err)),
    });
  };

  const findMember = (id: number | null) =>
    id ? (members.find((m) => m.id === id) ?? null) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">TODO</h1>
        <button
          type="button"
          onClick={() => navigate("/todos/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
        >
          ＋ 作成
        </button>
      </div>

      {/* Search + ordering */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タイトルで検索…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value as "" | "created_at")}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="並び順"
        >
          <option value="">新しい順</option>
          <option value="created_at">古い順</option>
        </select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="読み込み中" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          TODOリストの取得に失敗しました
        </div>
      )}

      {/* List */}
      {!isLoading && !isError && (
        <>
          {todos?.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>
                📭
              </span>
              <p className="text-sm">まだTODOリストがありません</p>
            </div>
          )}

          <div className="space-y-3">
            {todos?.map((todo) => {
              const total = todo.contents.length;
              const checked = todo.contents.filter((c) => c.check_flag).length;
              const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
              const creator = findMember(todo.created_by);

              return (
                <SwipeToDeleteRow key={todo.id} onDelete={() => handleDelete(todo.id)}>
                <button
                  type="button"
                  onClick={() => navigate(`/todos/${todo.id}`)}
                  className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors shadow-sm dark:shadow-none"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm leading-snug">{todo.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {todo.complete_flag && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          ✓ 全完了
                        </span>
                      )}
                      {!todo.complete_flag && total > 0 && checked > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          進行中
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs" aria-hidden>›</span>
                    </div>
                  </div>

                  {creator && (
                    <div className="mb-2">
                      <MemberChip member={creator} />
                    </div>
                  )}

                  {total > 0 && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {checked} / {total}
                      </span>
                    </div>
                  )}

                  {total === 0 && (
                    <p className="text-xs text-muted-foreground mb-1.5">項目なし</p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(todo.created_at), "yyyy年M月d日", { locale: ja })}
                  </p>
                </button>
                </SwipeToDeleteRow>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
