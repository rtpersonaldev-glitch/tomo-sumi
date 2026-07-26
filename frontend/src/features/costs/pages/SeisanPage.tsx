import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Check, ChevronRight, Loader2, Merge, Plus, X } from "lucide-react";
import { useSeisanPending, useSeisanCompleted, useMergeSeisan } from "../hooks/useCost";
import { CostSubNav } from "../components/CostSubNav";
import type { SeisanListResponse } from "../types";

function SeisanCard({
  s,
  selectMode,
  selected,
  onToggle,
}: {
  s: SeisanListResponse;
  selectMode: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggle(s.id)}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 shadow-sm transition-all ${
          selected
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:shadow-md"
        }`}
      >
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected ? "border-primary bg-primary" : "border-muted-foreground"
          }`}
        >
          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold truncate">{s.title}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(s.settled_date), "yyyy/M/d")}
          </p>
        </div>
      </button>
    );
  }

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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergeDate, setMergeDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: pending = [], isLoading: loadingPending } = useSeisanPending();
  const { data: completed = [], isLoading: loadingCompleted } = useSeisanCompleted();
  const mergeSeisan = useMergeSeisan();

  const isLoading = tab === "pending" ? loadingPending : loadingCompleted;
  const list: SeisanListResponse[] = tab === "pending" ? pending : completed;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowMergeForm(false);
    setMergeTitle("");
    setMergeDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2 || !mergeTitle.trim()) return;
    try {
      const result = await mergeSeisan.mutateAsync({
        seisan_ids: Array.from(selectedIds),
        title: mergeTitle.trim(),
        settled_date: mergeDate,
      });
      exitSelectMode();
      navigate(`/costs/seisan/${result.id}`);
    } catch {
      // エラーはUIで表示
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-semibold">清算管理</h1>
        <div className="flex items-center gap-2">
          {tab === "pending" && pending.length >= 2 && !selectMode && (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Merge className="h-4 w-4" />
              結合
            </button>
          )}
          {selectMode ? (
            <button
              type="button"
              onClick={exitSelectMode}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
              キャンセル
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/costs/seisan/new")}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-4 w-4" />
              新規清算
            </button>
          )}
        </div>
      </div>

      <CostSubNav />

      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="mb-4 flex rounded-xl border border-border bg-card p-1">
          {(["pending", "completed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                if (selectMode) exitSelectMode();
              }}
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
              <SeisanCard
                key={s.id}
                s={s}
                selectMode={selectMode}
                selected={selectedIds.has(s.id)}
                onToggle={toggleSelect}
              />
            ))}
          </div>
        )}

        {/* 選択時の結合フォーム */}
        {selectMode && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-md">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">
              {selectedIds.size}件選択中（2件以上で結合できます）
            </p>

            {selectedIds.size >= 2 && !showMergeForm && (
              <button
                type="button"
                onClick={() => setShowMergeForm(true)}
                className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                選択した清算を結合する
              </button>
            )}

            {showMergeForm && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    結合後のタイトル
                  </label>
                  <input
                    type="text"
                    value={mergeTitle}
                    onChange={(e) => setMergeTitle(e.target.value)}
                    placeholder="例: 2024年6月・7月 合算清算"
                    maxLength={50}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                    清算日
                  </label>
                  <input
                    type="date"
                    value={mergeDate}
                    onChange={(e) => setMergeDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                {mergeSeisan.isError && (
                  <p className="text-xs text-destructive">結合に失敗しました。もう一度お試しください。</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMergeForm(false)}
                    className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    戻る
                  </button>
                  <button
                    type="button"
                    onClick={handleMerge}
                    disabled={!mergeTitle.trim() || mergeSeisan.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {mergeSeisan.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "結合する"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
