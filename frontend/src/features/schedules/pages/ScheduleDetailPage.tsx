import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useSchedule, useDeleteSchedule } from "../hooks/useSchedule";
import { useHomeMembers } from "@/features/home/hooks/useHome";

export default function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scheduleId = parseInt(id!, 10);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data, isLoading, isError } = useSchedule(scheduleId);
  const { data: members = [] } = useHomeMembers();
  const deleteSchedule = useDeleteSchedule();

  const handleDelete = async () => {
    try {
      await deleteSchedule.mutateAsync(scheduleId);
      toast.success("スケジュールを削除しました");
      navigate("/schedules");
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
        <p className="text-sm text-muted-foreground">スケジュールの取得に失敗しました</p>
      </div>
    );
  }

  const creator = data.created_by
    ? (members.find((m) => m.id === data.created_by) ?? null)
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-primary hover:underline"
          aria-label="一覧に戻る"
        >
          ‹ 戻る
        </button>
        <h1 className="text-xl font-semibold">スケジュール詳細</h1>
      </div>

      {/* Detail card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm dark:shadow-none">
        <h2 className="text-xl font-bold leading-snug">{data.title}</h2>
        <hr className="border-border" />
        <dl className="space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs text-muted-foreground shrink-0 pt-0.5">📅 開始</dt>
            <dd className="font-medium text-right">
              {format(parseISO(data.start_day), "yyyy年M月d日（E） HH:mm", { locale: ja })}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs text-muted-foreground shrink-0 pt-0.5">🏁 終了</dt>
            <dd className="font-medium text-right">
              {format(parseISO(data.end_day), "yyyy年M月d日（E） HH:mm", { locale: ja })}
            </dd>
          </div>
          {data.memo && (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-xs text-muted-foreground shrink-0 pt-0.5">📝 メモ</dt>
              <dd className="text-muted-foreground text-right whitespace-pre-wrap">{data.memo}</dd>
            </div>
          )}
          {creator && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs text-muted-foreground shrink-0">👤 作成者</dt>
              <dd className="flex items-center gap-1.5">
                {creator.icon_url ? (
                  <img
                    src={creator.icon_url}
                    alt={creator.nickname}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {creator.nickname.charAt(0)}
                  </span>
                )}
                <span>{creator.nickname}</span>
              </dd>
            </div>
          )}
          <div className="flex items-start justify-between gap-4">
            <dt className="text-xs text-muted-foreground shrink-0 pt-0.5">🕐 作成日</dt>
            <dd className="text-xs text-muted-foreground">
              {format(parseISO(data.created_at), "yyyy年M月d日", { locale: ja })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Edit / Delete */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm dark:shadow-none">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/schedules/${scheduleId}/edit`)}
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
              このスケジュールを削除しますか？この操作は元に戻せません。
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
                disabled={deleteSchedule.isPending}
                className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
              >
                {deleteSchedule.isPending ? (
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
