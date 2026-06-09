import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useCategories, useCreateCategory } from "../hooks/useCost";

export default function CategoryManagePage() {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const [newName, setNewName] = useState("");

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory.mutateAsync(name);
      setNewName("");
      toast.success(`「${name}」を追加しました`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </button>
        <h1 className="text-xl font-semibold">カテゴリ管理</h1>
      </div>

      <p className="mb-4 rounded-xl bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        💡 カテゴリは支出作成・編集時に選択できます
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {categories.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              カテゴリがありません
            </p>
          )}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <Tag className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* 新規追加フォーム */}
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-card px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          新しいカテゴリ
        </p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="例: 交通費"
            maxLength={30}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="新しいカテゴリ名"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newName.trim() || createCategory.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {createCategory.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
