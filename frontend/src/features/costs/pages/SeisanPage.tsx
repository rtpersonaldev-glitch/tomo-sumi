import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useSeisanPending, useSeisanCompleted } from "../hooks/useCost";
import { CostSubNav } from "../components/CostSubNav";
import type { SeisanListResponse } from "../types";

function SeisanCard({ s }: { s: SeisanListResponse }) {
  return (
    <Link
      to={`/costs/seisan/${s.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{s.title}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(s.settled_date), "yyyy/M/d")}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

export default function SeisanPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "completed">("pending");

  const { data: pending = [], isLoading: loadingPending } = useSeisanPending();
  const { data: completed = [], isLoading: loadingCompleted } = useSeisanCompleted();

  const isLoading = tab === "pending" ? loadingPending : loadingCompleted;
  const list: SeisanListResponse[] = tab === "pending" ? pending : completed;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-semibold">清算管理</h1>
        <button
          type="button"
          onClick={() => navigate("/costs/seisan/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          新規清算
        </button>
      </div>

      <CostSubNav />

      <div className="px-4 py-4">
      {/* Tabs */}
      <div className="mb-4 flex rounded-xl border border-border bg-card p-1">
        {(["pending", "completed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pending" ? "清算待ち" : "清算済み"}
            {t === "pending" && pending.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="text-sm">
            {tab === "pending" ? "清算待ちの清算はありません" : "清算済みの清算はありません"}
          </p>
          {tab === "pending" && (
            <button
              type="button"
              onClick={() => navigate("/costs/seisan/new")}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              清算を作成する
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <SeisanCard key={s.id} s={s} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
