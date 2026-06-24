import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2, Plus } from "lucide-react";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import { useCategories, useCosts } from "../hooks/useCost";
import { CostSubNav } from "../components/CostSubNav";
import { UserAvatar } from "../components/UserAvatar";
import type { CostResponse } from "../types";

function CostCard({ cost }: { cost: CostResponse }) {
  const isLocked = cost.seisan_id != null;

  return (
    <Link
      to={`/costs/${cost.id}`}
      className={`block rounded-xl border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${
        isLocked ? "border-border opacity-60" : "border-transparent"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
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
        </div>
        <p className={`text-base font-bold ${isLocked ? "text-muted-foreground" : ""}`}>
          ¥{cost.amount.toLocaleString()}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {cost.category_name && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {cost.category_name}
          </span>
        )}
        {isLocked && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            清算済み
          </span>
        )}
      </div>
    </Link>
  );
}

export default function CostListPage() {
  const navigate = useNavigate();
  const { data: homeUsers = [] } = useHomeMembers();
  const { data: categories = [] } = useCategories();

  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>();
  const [filterUserId, setFilterUserId] = useState<number | undefined>();

  const { data: costs = [], isLoading } = useCosts({
    categoryId: filterCategoryId,
    userId: filterUserId,
  });

  const total = costs.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-semibold">支出一覧</h1>
        <Link
          to="/costs/new"
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          追加
        </Link>
      </div>

      <CostSubNav />

      <div className="px-4 py-4">
      {/* フィルター */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filterCategoryId ?? ""}
          onChange={(e) => setFilterCategoryId(e.target.value === "" ? undefined : Number(e.target.value))}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="カテゴリで絞り込み"
        >
          <option value="">全カテゴリ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filterUserId ?? ""}
          onChange={(e) => setFilterUserId(e.target.value === "" ? undefined : Number(e.target.value))}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="ユーザーで絞り込み"
        >
          <option value="">全員</option>
          {homeUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.nickname}</option>
          ))}
        </select>
      </div>

      {/* 支出リスト */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : costs.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-sm">支出がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {costs.map((cost) => (
            <CostCard key={cost.id} cost={cost} />
          ))}

          <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
            <span className="text-xs text-muted-foreground">
              未清算 {costs.filter((c) => c.seisan_id == null).length}件
            </span>
            <span className="text-lg font-bold text-primary">
              ¥{total.toLocaleString()}
            </span>
          </div>

          {costs.some((c) => c.seisan_id == null) && (
            <button
              type="button"
              onClick={() => navigate("/costs/seisan/new")}
              className="mt-1 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              清算を作成する
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
