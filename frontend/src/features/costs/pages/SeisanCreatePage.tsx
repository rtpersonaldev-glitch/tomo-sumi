import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowLeft, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useCosts, useCreateSeisan } from "../hooks/useCost";
import { UserAvatar } from "../components/UserAvatar";

export default function SeisanCreatePage() {
  const navigate = useNavigate();
  const homeUsers = useAuthStore((s) => s.homeUsers);
  const { data: costs = [], isLoading } = useCosts();
  const createSeisan = useCreateSeisan();

  const pendingCosts = costs.filter((c) => c.seisan_id == null);

  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(pendingCosts.map((c) => c.id)),
  );

  /* pendingCostsが変化したらselectedIdsを同期 */
  const toggleAll = () => {
    if (selectedIds.size === pendingCosts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingCosts.map((c) => c.id)));
    }
  };

  const toggleCost = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedTotal = pendingCosts
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + c.amount, 0);

  const handleSubmit = async () => {
    const t = title.trim();
    if (!t) {
      toast.error("清算タイトルを入力してください");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("清算する支出を選択してください");
      return;
    }
    try {
      const seisan = await createSeisan.mutateAsync(t);
      toast.success("清算を作成しました");
      navigate(`/costs/seisan/${seisan.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="一覧に戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-semibold">清算を作成</h1>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={createSeisan.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {createSeisan.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          今すぐ清算
        </button>
      </div>

      {/* 本日清算のインフォ */}
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
        <CalendarDays className="h-4 w-4 shrink-0" />
        清算日は本日（{format(new Date(), "yyyy/M/d")}）が自動設定されます
      </div>

      {/* タイトル */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
          清算タイトル <span className="text-destructive">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: 6月第1週の清算"
          maxLength={50}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 支出選択 */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          清算する支出を選択
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none"
        >
          {selectedIds.size === pendingCosts.length ? "全解除" : "全選択"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : pendingCosts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          未清算の支出がありません
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {pendingCosts.map((cost) => {
            const checked = selectedIds.has(cost.id);
            const payer = homeUsers.find((u) => u.id === cost.payer_user_id);
            return (
              <button
                key={cost.id}
                type="button"
                onClick={() => toggleCost(cost.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  checked
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                )}
                aria-pressed={checked}
              >
                {/* チェックボックス */}
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border",
                  )}
                  aria-hidden
                >
                  {checked && "✓"}
                </span>

                {payer && (
                  <UserAvatar
                    nickname={payer.nickname}
                    iconUrl={payer.icon_url}
                    userId={payer.id}
                    size="sm"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {cost.memo || cost.category_name || "（メモなし）"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(cost.purchase_date), "M/d")}
                    {cost.category_name && ` ・ ${cost.category_name}`}
                  </p>
                </div>
                <span className="text-sm font-bold">
                  ¥{cost.amount.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 選択合計 */}
      {selectedIds.size > 0 && (
        <div className="rounded-xl bg-primary/10 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-primary">
            選択中 {selectedIds.size}件の合計
          </span>
          <span className="text-xl font-bold text-primary">
            ¥{selectedTotal.toLocaleString()}
          </span>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground text-center">
        ※ 清算は現在の全未清算支出を対象に計算されます
      </p>
    </div>
  );
}
