import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowRight, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useSeisan, useCompleteMeisai } from "../hooks/useCost";
import { useAuthStore } from "@/store/authStore";
import { UserAvatar } from "../components/UserAvatar";
import type { SeisanMeisaiResponse } from "../types";

/* ── 完了モーダル ─────────────────────────────────────────────────── */

interface CompleteModalProps {
  meisai: SeisanMeisaiResponse;
  onClose: () => void;
  onConfirm: (memo: string) => void;
  isPending: boolean;
}

function CompleteModal({ meisai, onClose, onConfirm, isPending }: CompleteModalProps) {
  const homeUsers = useAuthStore((s) => s.homeUsers);
  const [memo, setMemo] = useState("");

  const fromUser = homeUsers.find((u) => u.id === meisai.from_user_id);
  const toUser = homeUsers.find((u) => u.id === meisai.to_user_id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center px-4 pb-safe"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h2 id="complete-modal-title" className="mb-1 text-base font-bold">
          清算明細を完了にする
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          完了にすると取り消せません
        </p>

        {/* 内容 */}
        <div className="mb-4 flex items-center justify-center gap-3 rounded-xl bg-secondary/40 px-4 py-3">
          {fromUser ? (
            <div className="flex items-center gap-1.5">
              <UserAvatar nickname={fromUser.nickname} iconUrl={fromUser.icon_url} userId={fromUser.id} size="sm" />
              <span className="text-sm">{fromUser.nickname}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{meisai.from_nickname}</span>
          )}
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          {toUser ? (
            <div className="flex items-center gap-1.5">
              <UserAvatar nickname={toUser.nickname} iconUrl={toUser.icon_url} userId={toUser.id} size="sm" />
              <span className="text-sm">{toUser.nickname}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{meisai.to_nickname}</span>
          )}
          <span className="ml-auto font-bold text-base">
            ¥{meisai.amount.toLocaleString()}
          </span>
        </div>

        {/* メモ */}
        <div className="mb-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            メモ（任意）
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder="例: PayPayで送金しました / 銀行振込済み…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="完了メモ"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(memo)}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            完了にする
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */

export default function SeisanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const seisanId = Number(id);
  const navigate = useNavigate();
  const homeUsers = useAuthStore((s) => s.homeUsers);

  const { data: seisan, isLoading } = useSeisan(seisanId);
  const completeMeisai = useCompleteMeisai();
  const [targetMeisai, setTargetMeisai] = useState<SeisanMeisaiResponse | null>(null);

  const handleConfirmComplete = async (memo: string) => {
    if (!targetMeisai) return;
    try {
      await completeMeisai.mutateAsync(targetMeisai.id);
      toast.success("完了にしました" + (memo ? `（${memo}）` : ""));
      setTargetMeisai(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!seisan) {
    return <p className="p-6 text-center text-muted-foreground">清算が見つかりません</p>;
  }

  const pendingMeisai = seisan.meisai.filter((m) => !m.complete_flag);
  const completedMeisai = seisan.meisai.filter((m) => m.complete_flag);

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate("/costs/seisan")}
            className="hover:text-foreground"
          >
            清算管理
          </button>
          <span>›</span>
          <span className="text-primary font-medium truncate">{seisan.title}</span>
        </div>

        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-0.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{seisan.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              清算日: {format(parseISO(seisan.settled_date), "yyyy/M/d")}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              seisan.complete_flag
                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                : pendingMeisai.length === 0
                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
            )}
          >
            {seisan.complete_flag || pendingMeisai.length === 0 ? "完了" : "清算待ち"}
          </span>
        </div>

        {/* 清算明細 */}
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          清算明細
        </p>

        {seisan.meisai.length === 0 && (
          <p className="mb-4 rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            清算明細がありません（全員の収支が均衡しています）
          </p>
        )}

        {/* 未完了明細 */}
        {pendingMeisai.map((m) => {
          const fromUser = homeUsers.find((u) => u.id === m.from_user_id);
          const toUser = homeUsers.find((u) => u.id === m.to_user_id);
          return (
            <div
              key={m.id}
              className="mb-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                  {fromUser ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar nickname={fromUser.nickname} iconUrl={fromUser.icon_url} userId={fromUser.id} size="sm" />
                      <span className="text-sm font-medium">{fromUser.nickname}</span>
                    </div>
                  ) : (
                    <span className="text-sm">{m.from_nickname}</span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {toUser ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar nickname={toUser.nickname} iconUrl={toUser.icon_url} userId={toUser.id} size="sm" />
                      <span className="text-sm font-medium">{toUser.nickname}</span>
                    </div>
                  ) : (
                    <span className="text-sm">{m.to_nickname}</span>
                  )}
                </div>
                <span className="text-base font-bold">¥{m.amount.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  未完了
                </span>
                <button
                  type="button"
                  onClick={() => setTargetMeisai(m)}
                  className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  完了にする →
                </button>
              </div>
            </div>
          );
        })}

        {/* 完了済み明細 */}
        {completedMeisai.map((m) => {
          const fromUser = homeUsers.find((u) => u.id === m.from_user_id);
          const toUser = homeUsers.find((u) => u.id === m.to_user_id);
          return (
            <div
              key={m.id}
              className="mb-3 rounded-xl border border-border bg-card/60 px-4 py-3 opacity-70"
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                  {fromUser ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar nickname={fromUser.nickname} iconUrl={fromUser.icon_url} userId={fromUser.id} size="sm" />
                      <span className="text-sm">{fromUser.nickname}</span>
                    </div>
                  ) : (
                    <span className="text-sm">{m.from_nickname}</span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  {toUser ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar nickname={toUser.nickname} iconUrl={toUser.icon_url} userId={toUser.id} size="sm" />
                      <span className="text-sm">{toUser.nickname}</span>
                    </div>
                  ) : (
                    <span className="text-sm">{m.to_nickname}</span>
                  )}
                </div>
                <span className="text-base font-bold text-muted-foreground">
                  ¥{m.amount.toLocaleString()}
                </span>
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 完了モーダル */}
      {targetMeisai && (
        <CompleteModal
          meisai={targetMeisai}
          onClose={() => setTargetMeisai(null)}
          onConfirm={handleConfirmComplete}
          isPending={completeMeisai.isPending}
        />
      )}
    </>
  );
}
