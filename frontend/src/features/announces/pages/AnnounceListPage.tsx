import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAnnounces } from "../hooks/useAnnounce";
import { PRIORITY_CONFIG } from "../types";
import type { AnnounceResponse } from "../types";

const PRIORITY_FILTERS = [
  { value: "", label: "すべて" },
  { value: "high", label: "🔴 高" },
  { value: "medium", label: "🟡 中" },
  { value: "low", label: "⚪ 低" },
] as const;

const SORT_OPTIONS = [
  { value: "", label: "新しい順" },
  { value: "created_at", label: "古い順" },
  { value: "end_date", label: "期限近い順" },
] as const;

function AnnounceCard({
  announce,
  onClick,
}: {
  announce: AnnounceResponse;
  onClick: () => void;
}) {
  const prio = PRIORITY_CONFIG[announce.priority];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/40 transition-colors shadow-sm dark:shadow-none"
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold",
            prio.badgeClass,
          )}
        >
          {prio.label}
        </span>
        <span className="flex-1 text-sm font-semibold leading-snug line-clamp-2">
          {announce.title}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {announce.content}
      </p>
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-xs text-muted-foreground">
          期限: {format(parseISO(announce.end_date), "yyyy年M月d日", { locale: ja })}
        </span>
        <span
          className={cn(
            "text-xs flex items-center gap-1",
            announce.is_liked ? "text-red-500" : "text-muted-foreground",
          )}
          aria-label={`いいね ${announce.like_count}件`}
        >
          {announce.is_liked ? "❤️" : "🤍"} {announce.like_count}
        </span>
      </div>
    </button>
  );
}

export default function AnnounceListPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [ordering, setOrdering] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError } = useAnnounces({
    search: search || undefined,
    priority: priority || undefined,
    ordering: ordering || undefined,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">お知らせ</h1>
        <button
          type="button"
          onClick={() => navigate("/announces/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
        >
          ＋ 作成
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          placeholder="タイトル・内容で検索"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="お知らせを検索"
        />
      </div>

      {/* Filter + Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRIORITY_FILTERS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPriority(p.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              priority === p.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40",
            )}
          >
            {p.label}
          </button>
        ))}
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          className="ml-auto rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="並び替え"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Count */}
      {data && (
        <p className="text-xs text-muted-foreground">
          {data.length}件
        </p>
      )}

      {/* States */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2
            className="h-6 w-6 animate-spin text-primary"
            aria-label="読み込み中"
          />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          お知らせの取得に失敗しました
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <span className="text-4xl" aria-hidden>📭</span>
          <p className="text-sm">
            {search || priority ? "条件に一致するお知らせがありません" : "まだお知らせがありません"}
          </p>
        </div>
      )}

      {/* List */}
      {data?.map((announce) => (
        <AnnounceCard
          key={announce.id}
          announce={announce}
          onClick={() => navigate(`/announces/${announce.id}`)}
        />
      ))}
    </div>
  );
}
