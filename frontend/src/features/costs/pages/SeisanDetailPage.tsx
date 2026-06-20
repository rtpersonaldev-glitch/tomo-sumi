import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useSeisan, useCompleteMeisai, useConfirmMeisai } from "../hooks/useCost";
import { UserAvatar } from "../components/UserAvatar";
import type { CostResponse, SeisanMeisaiResponse } from "../types";

/* ── 完了モーダル ─────────────────────────────────────────────────── */

interface CompleteModalProps {
  meisai: SeisanMeisaiResponse;
  onClose: () => void;
  onConfirm: (memo: string) => void;
  isPending: boolean;
}

function CompleteModal({ meisai, onClose, onConfirm, isPending }: CompleteModalProps) {
  const [memo, setMemo] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center px-4 pb-safe"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h2 id="complete-modal-title" className="mb-1 text-base font-bold">
          支払いを完了にする
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          完了にすると受取人に通知されます
        </p>

        <div className="mb-4 flex items-center justify-center gap-4 rounded-xl bg-secondary/40 px-4 py-3">
          <div className="flex flex-col items-center gap-1">
            <UserAvatar
              nickname={meisai.from_nickname ?? ""}
              iconUrl={meisai.from_icon_url}
              userId={meisai.from_user_id ?? 0}
              size="sm"
            />
            <span className="text-xs">{meisai.from_nickname}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg">💳</span>
            <span className="text-base font-bold">¥{meisai.amount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <UserAvatar
              nickname={meisai.to_nickname ?? ""}
              iconUrl={meisai.to_icon_url}
              userId={meisai.to_user_id ?? 0}
              size="sm"
            />
            <span className="text-xs">{meisai.to_nickname}</span>
          </div>
        </div>

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

/* ── 明細カード ───────────────────────────────────────────────────── */

interface MeisaiCardProps {
  m: SeisanMeisaiResponse;
  currentUserId: number | null;
  onComplete: () => void;
  onConfirm: () => void;
  isConfirmPending: boolean;
}

function MeisaiCard({ m, currentUserId, onComplete, onConfirm, isConfirmPending }: MeisaiCardProps) {
  const isMine = m.from_user_id === currentUserId || m.to_user_id === currentUserId;
  const isFromMe = m.from_user_id === currentUserId;
  const isToMe = m.to_user_id === currentUserId;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-4 py-3 shadow-sm",
        isMine ? "border-primary bg-primary/5" : "border-border",
        m.complete_flag && "opacity-60",
      )}
    >
      {/* 送金レイアウト: 支払元 ─ 💳 ─ 受取人 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex flex-col items-center gap-1 w-16">
          <UserAvatar
            nickname={m.from_nickname ?? ""}
            iconUrl={m.from_icon_url}
            userId={m.from_user_id ?? 0}
          />
          <span className="text-[11px] font-semibold text-center leading-tight line-clamp-1">
            {m.from_nickname ?? "—"}
          </span>
          <span className="text-[9px] text-muted-foreground">支払い元</span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-0.5">
          <span className="text-xl">💳</span>
          <span className="text-[10px] text-muted-foreground">支払い</span>
          <span className={cn(
            "text-base font-bold",
            m.complete_flag ? "text-green-600 dark:text-green-400" : "text-foreground",
          )}>
            ¥{m.amount.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 w-16">
          <UserAvatar
            nickname={m.to_nickname ?? ""}
            iconUrl={m.to_icon_url}
            userId={m.to_user_id ?? 0}
          />
          <span className="text-[11px] font-semibold text-center leading-tight line-clamp-1">
            {m.to_nickname ?? "—"}
          </span>
          <span className="text-[9px] text-muted-foreground">受取人</span>
        </div>
      </div>

      {/* 支払者メモ（受取人向け・支払済み状態のみ表示） */}
      {isToMe && m.payer_confirmed && !m.complete_flag && m.payer_memo && (
        <div className="mb-2 rounded-r-lg border-l-2 border-primary bg-secondary/40 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-semibold text-primary">
            {m.from_nickname}さんのメモ
          </p>
          <p className="text-xs text-foreground">{m.payer_memo}</p>
        </div>
      )}

      {/* ステータス＋アクションボタン */}
      <div className="flex items-center gap-2">
        {m.complete_flag ? (
          <>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-300">
              完了
            </span>
            <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
          </>
        ) : m.payer_confirmed ? (
          <>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
              支払済み
            </span>
            {isToMe && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirmPending}
                className="ml-auto flex items-center gap-1 rounded-lg border border-primary bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isConfirmPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                受取確認する
              </button>
            )}
          </>
        ) : (
          <>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              未払い
            </span>
            {isFromMe && (
              <button
                type="button"
                onClick={onComplete}
                className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                完了にする
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── 含まれる支出カード（支出一覧と同形式）──────────────────────── */

function CostCard({ cost }: { cost: CostResponse }) {
  return (
    <Link
      to={`/costs/${cost.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
    >
      {cost.payer_user_id ? (
        <UserAvatar
          nickname={cost.payer_nickname ?? ""}
          iconUrl={cost.payer_icon_url}
          userId={cost.payer_user_id}
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-muted" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {cost.memo || cost.category_name || "（メモなし）"}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(cost.purchase_date), "M/d（E）", { locale: ja })}
        </p>
        {cost.category_name && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {cost.category_name}
          </span>
        )}
      </div>
      <p className="text-base font-bold">¥{cost.amount.toLocaleString()}</p>
    </Link>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */

export default function SeisanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const seisanId = Number(id);
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const { data: seisan, isLoading } = useSeisan(seisanId);
  const completeMeisai = useCompleteMeisai();
  const confirmMeisai = useConfirmMeisai();
  const [targetMeisai, setTargetMeisai] = useState<SeisanMeisaiResponse | null>(null);
  const [costsOpen, setCostsOpen] = useState(false);

  const handleComplete = async (memo: string) => {
    if (!targetMeisai) return;
    try {
      await completeMeisai.mutateAsync({ meisaiId: targetMeisai.id, memo });
      toast.success("支払い完了を登録しました");
      setTargetMeisai(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleConfirm = async (meisaiId: number) => {
    try {
      await confirmMeisai.mutateAsync(meisaiId);
      toast.success("受取確認しました");
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

  const allDone = seisan.meisai.length === 0 || seisan.meisai.every((m) => m.complete_flag);

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-0.5 text-sm text-muted-foreground hover:text-foreground"
            aria-label="戻る"
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
              allDone
                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
            )}
          >
            {allDone ? "完了" : "清算待ち"}
          </span>
        </div>

        {/* 清算明細 */}
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          清算明細
        </p>

        {seisan.meisai.length === 0 ? (
          <p className="mb-4 rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            清算明細がありません（全員の収支が均衡しています）
          </p>
        ) : (
          <div className="mb-4 space-y-3">
            {seisan.meisai.map((m) => (
              <MeisaiCard
                key={m.id}
                m={m}
                currentUserId={currentUserId}
                onComplete={() => setTargetMeisai(m)}
                onConfirm={() => handleConfirm(m.id)}
                isConfirmPending={confirmMeisai.isPending}
              />
            ))}
          </div>
        )}

        {/* 含まれる支出（アコーディオン） */}
        {seisan.costs.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setCostsOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={costsOpen}
            >
              <span>含まれる支出（{seisan.costs.length}件）</span>
              {costsOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {costsOpen && (
              <div className="border-t border-border px-3 py-3 space-y-2 bg-background/40">
                {seisan.costs.map((cost) => (
                  <CostCard key={cost.id} cost={cost} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 完了モーダル */}
      {targetMeisai && (
        <CompleteModal
          meisai={targetMeisai}
          onClose={() => setTargetMeisai(null)}
          onConfirm={handleComplete}
          isPending={completeMeisai.isPending}
        />
      )}
    </>
  );
}
