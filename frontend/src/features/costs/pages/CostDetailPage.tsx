import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2, Lock, Pencil, Receipt, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useCost, useDeleteCost } from "../hooks/useCost";
import { UserAvatar } from "../components/UserAvatar";

const METHOD_LABEL: Record<string, string> = {
  equal: "均等割り",
  dish: "食数割り",
  direct: "直接入力",
};

function resolveMethod(dishCount: number | null, seikyusakiCount: number): string {
  if (dishCount != null) return "dish";
  if (seikyusakiCount > 0) return "direct";
  return "equal";
}

function ReceiptLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal
      aria-label="レシートを拡大表示"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={url}
        alt="レシート"
        className="max-h-[80vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function CostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const costId = Number(id);
  const navigate = useNavigate();
  const { data: cost, isLoading } = useCost(costId);
  const deleteCost = useDeleteCost();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isLocked = cost?.seisan_id != null;

  const handleDelete = async () => {
    if (!confirm("この支出を削除しますか？")) return;
    try {
      await deleteCost.mutateAsync(costId);
      toast.success("削除しました");
      navigate("/costs");
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

  if (!cost) {
    return <p className="p-6 text-center text-muted-foreground">支出が見つかりません</p>;
  }

  const method = resolveMethod(cost.dish_count, cost.seikyusaki.length);

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header（右上の編集ボタンなし） */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 戻る
          </button>
          <h1 className="flex-1 text-xl font-semibold">支出詳細</h1>
        </div>

        {/* ロックバナー */}
        {isLocked && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" />
            この支出は清算に含まれており、編集・削除できません
          </div>
        )}

        {/* レシート画像（大きく・クリックで拡大） */}
        <div className="mb-4">
          {cost.receipt_image_url ? (
            <>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="レシートを拡大表示"
                className="w-full overflow-hidden rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={cost.receipt_image_url}
                  alt="レシート"
                  className="w-full aspect-[4/3] object-cover hover:opacity-95 transition-opacity"
                />
              </button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                タップで拡大表示
              </p>
            </>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-muted-foreground mx-auto">
              <Receipt className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* 基本情報 */}
        <div className="mb-4 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">購入日</span>
            <span className="font-medium">
              {format(parseISO(cost.purchase_date), "yyyy/M/d（E）", { locale: ja })}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">カテゴリ</span>
            {cost.category_name ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {cost.category_name}
              </span>
            ) : (
              <span className="text-muted-foreground">未分類</span>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">金額</span>
            <span className="text-lg font-bold text-primary">
              ¥{cost.amount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">請求方法</span>
            <span className="font-medium">
              {METHOD_LABEL[method]}
              {method === "dish" && cost.dish_count != null && `（合計${cost.dish_count}食）`}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">支払者</span>
            {cost.payer_user_id ? (
              <div className="flex items-center gap-2">
                <UserAvatar
                  nickname={cost.payer_nickname ?? ""}
                  iconUrl={cost.payer_icon_url}
                  userId={cost.payer_user_id}
                  size="sm"
                />
                <span className="font-medium">{cost.payer_nickname}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          {cost.memo && (
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted-foreground">メモ</span>
              <span className="max-w-[60%] text-right">{cost.memo}</span>
            </div>
          )}
        </div>

        {/* 請求先 */}
        {cost.seikyusaki.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              請求先
            </p>
            <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
              {cost.seikyusaki.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {s.payer_user_id ? (
                    <>
                      <UserAvatar
                        nickname={s.nickname ?? ""}
                        iconUrl={s.icon_url}
                        userId={s.payer_user_id}
                        size="sm"
                      />
                      <span className="flex-1">{s.nickname}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-muted-foreground">—</span>
                  )}
                  {s.dish_count != null && (
                    <span className="text-xs text-muted-foreground">{s.dish_count}食</span>
                  )}
                  <span className="font-bold">¥{s.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* アクション（下部のみ） */}
        {!isLocked && (
          <div className="mt-6 flex gap-3">
            <Link
              to={`/costs/${costId}/edit`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-4 w-4" />
              編集
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteCost.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {deleteCost.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              削除
            </button>
          </div>
        )}
      </div>

      {/* レシート拡大 Lightbox */}
      {lightboxOpen && cost.receipt_image_url && (
        <ReceiptLightbox
          url={cost.receipt_image_url}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
