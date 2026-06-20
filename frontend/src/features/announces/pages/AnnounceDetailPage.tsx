import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import {
  useAnnounce,
  useDeleteAnnounce,
  useSendPush,
  useToggleLike,
} from "../hooks/useAnnounce";
import { PRIORITY_CONFIG } from "../types";

export default function AnnounceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const announceId = parseInt(id!, 10);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data, isLoading, isError } = useAnnounce(announceId);
  const { data: homeMembers = [] } = useHomeMembers();
  const toggleLike = useToggleLike(announceId);
  const sendPush = useSendPush();
  const deleteAnnounce = useDeleteAnnounce();

  const handlePush = async () => {
    try {
      await sendPush.mutateAsync(announceId);
      toast.success("プッシュ通知を送信しました");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAnnounce.mutateAsync(announceId);
      toast.success("お知らせを削除しました");
      navigate("/announces");
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
        <p className="text-sm text-muted-foreground">お知らせの取得に失敗しました</p>
      </div>
    );
  }

  const prio = PRIORITY_CONFIG[data.priority];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/announces")}
          className="text-sm text-primary hover:underline"
          aria-label="一覧に戻る"
        >
          ‹ 戻る
        </button>
        <h1 className="text-xl font-semibold">お知らせ詳細</h1>
      </div>

      {/* Content card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
              prio.badgeClass,
            )}
          >
            {prio.label}
          </span>
          <span className="text-xs text-muted-foreground">
            期限: {format(parseISO(data.end_date), "yyyy年M月d日", { locale: ja })}
          </span>
        </div>

        <h2 className="text-xl font-bold leading-snug">{data.title}</h2>
        <hr className="border-border" />
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {data.content}
        </p>
        <hr className="border-border" />

        {/* 宛先 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">宛先:</span>
          {data.recipient_ids.length === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              👥 全員
            </span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {data.recipient_ids.map((uid) => {
                const member = homeMembers.find((m) => m.id === uid);
                if (!member) return null;
                return (
                  <div key={uid} className="flex items-center gap-1">
                    {member.icon_url ? (
                      <img
                        src={member.icon_url}
                        alt={member.nickname}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {member.nickname.charAt(0)}
                      </div>
                    )}
                    <span className="text-xs text-foreground">{member.nickname}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {data.link_url && (
          <Link
            to={data.link_url}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-primary/60 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            🔗 詳細を確認する
          </Link>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>作成: {format(parseISO(data.created_at), "yyyy年M月d日", { locale: ja })}</span>
          <span aria-label={`いいね ${data.like_count}件`}>❤️ {data.like_count} いいね</span>
        </div>
        {data.created_by_user && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>投稿者:</span>
            {data.created_by_user.icon_url ? (
              <img
                src={data.created_by_user.icon_url}
                alt={data.created_by_user.nickname}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {data.created_by_user.nickname.charAt(0)}
              </div>
            )}
            <span className="font-medium text-foreground">{data.created_by_user.nickname}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => toggleLike.mutate()}
          disabled={toggleLike.isPending}
          aria-pressed={data.is_liked}
          aria-label={data.is_liked ? "いいねを取り消す" : "いいねする"}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
            data.is_liked
              ? "border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {toggleLike.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <>
              {data.is_liked ? "❤️" : "🤍"}
              <span>{data.is_liked ? `いいね済み (${data.like_count})` : `いいね (${data.like_count})`}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handlePush}
          disabled={sendPush.isPending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          aria-label="ホームメンバーへプッシュ通知を送信"
        >
          {sendPush.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            "🔔 通知を送る"
          )}
        </button>
      </div>

      {/* Edit / Delete */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm dark:shadow-none">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/announces/${announceId}/edit`)}
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
              このお知らせを削除しますか？この操作は元に戻せません。
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
                disabled={deleteAnnounce.isPending}
                className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
              >
                {deleteAnnounce.isPending ? (
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
