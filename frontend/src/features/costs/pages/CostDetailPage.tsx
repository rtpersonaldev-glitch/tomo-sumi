import { useNavigate, useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2, Lock, Pencil, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useCost, useDeleteCost } from "../hooks/useCost";
import { UserAvatar } from "../components/UserAvatar";

const METHOD_LABEL: Record<string, string> = {
  equal: "均等割り",
  dish: "食数割",
  direct: "直接入力",
};

export default function CostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const costId = Number(id);
  const navigate = useNavigate();
  const homeUsers = useAuthStore((s) => s.homeUsers);
  const { data: cost, isLoading } = useCost(costId);
  const deleteCost = useDeleteCost();

  const isLocked = cost?.seisan_id != null;

  const payer = homeUsers.find((u) => u.id === cost?.payer_user_id);

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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </button>
        <h1 className="flex-1 text-xl font-semibold">支出詳細</h1>
        {!isLocked && (
          <Link
            to={`/costs/${costId}/edit`}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            編集
          </Link>
        )}
      </div>

      {/* ロックバナー */}
      {isLocked && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" />
          この支出は清算に含まれており、編集・削除できません
        </div>
      )}

      {/* レシート画像 */}
      {cost.receipt_image_url ? (
        <div className="mb-4 flex justify-center">
          <img
            src={cost.receipt_image_url}
            alt="レシート"
            className="h-40 max-w-xs rounded-xl object-cover shadow-sm"
          />
        </div>
      ) : (
        <div className="mb-4 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Receipt className="h-8 w-8" />
          </div>
        </div>
      )}

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
        {cost.dish_count != null && (
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">清算方法</span>
            <span className="font-medium">{METHOD_LABEL["dish"]}（合計{cost.dish_count}食）</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted-foreground">支払者</span>
          {payer ? (
            <div className="flex items-center gap-2">
              <UserAvatar nickname={payer.nickname} iconUrl={payer.icon_url} userId={payer.id} size="sm" />
              <span className="font-medium">{payer.nickname}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{cost.payer_nickname ?? "—"}</span>
          )}
        </div>
        {cost.memo && (
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">メモ</span>
            <span className="max-w-[60%] text-right">{cost.memo}</span>
          </div>
        )}
      </div>

      {/* 請求先 (seikyusaki) */}
      {cost.seikyusaki.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            請求先
          </p>
          <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
            {cost.seikyusaki.map((s) => {
              const u = homeUsers.find((m) => m.id === s.payer_user_id);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {u ? (
                    <>
                      <UserAvatar nickname={u.nickname} iconUrl={u.icon_url} userId={u.id} size="sm" />
                      <span className="flex-1">{u.nickname}</span>
                    </>
                  ) : (
                    <span className="flex-1 text-muted-foreground">ユーザーID: {s.payer_user_id}</span>
                  )}
                  {s.dish_count != null && (
                    <span className="text-xs text-muted-foreground">{s.dish_count}食</span>
                  )}
                  <span className="font-bold">¥{s.amount.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* アクション */}
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
  );
}
