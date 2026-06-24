import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import {
  useKoteihi,
  useCreateKoteihi,
  useUpdateKoteihi,
  useDeleteKoteihi,
  useCategories,
} from "../hooks/useCost";
import { UserAvatar } from "../components/UserAvatar";

/* ── MemberPicker（単一選択） ─────────────────────────────────────── */

interface MemberPickerProps {
  label: string;
  selectedId: number | null;
  onChange: (id: number | null) => void;
}

function MemberPicker({ label, selectedId, onChange }: MemberPickerProps) {
  const { data: homeUsers = [] } = useHomeMembers();
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {homeUsers.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onChange(selectedId === u.id ? null : u.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedId === u.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/40",
            )}
          >
            <UserAvatar nickname={u.nickname} iconUrl={u.icon_url} userId={u.id} size="sm" />
            {u.nickname}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */

export default function KoteihiEditPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== "new";
  const koteihiId = isEdit ? Number(id) : undefined;
  const navigate = useNavigate();

  const { data: koteihiList = [], isLoading: loadingList } = useKoteihi();
  const { data: categories = [] } = useCategories();
  const createKoteihi = useCreateKoteihi();
  const updateKoteihi = useUpdateKoteihi();
  const deleteKoteihi = useDeleteKoteihi();

  const existing = koteihiList.find((k) => k.id === koteihiId);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [fromUserId, setFromUserId] = useState<number | null>(null);
  const [toUserId, setToUserId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    if (existing) {
      setCategoryId(existing.category_id ?? null);
      setAmount(String(existing.amount));
      setFromUserId(existing.from_user_id ?? null);
      setToUserId(existing.to_user_id ?? null);
      setMemo(existing.memo);
    }
  }, [existing]);

  const isSubmitting = createKoteihi.isPending || updateKoteihi.isPending;

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      toast.error("金額を正しく入力してください");
      return;
    }

    const payload = {
      category_id: categoryId ?? null,
      amount: amt,
      from_user_id: fromUserId ?? null,
      to_user_id: toUserId ?? null,
      memo: memo.trim(),
    };

    try {
      if (isEdit && koteihiId) {
        await updateKoteihi.mutateAsync({ id: koteihiId, ...payload });
        toast.success("固定費を更新しました");
      } else {
        await createKoteihi.mutateAsync(payload);
        toast.success("固定費を登録しました");
      }
      navigate("/costs/koteihi");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!koteihiId) return;
    if (!confirm("この固定費を削除しますか？")) return;
    try {
      await deleteKoteihi.mutateAsync(koteihiId);
      toast.success("削除しました");
      navigate("/costs/koteihi");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (isEdit && loadingList) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="キャンセルして戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-semibold">
          {isEdit ? "固定費を編集" : "固定費を登録"}
        </h1>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteKoteihi.isPending}
            className="flex items-center gap-1 rounded-lg border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-3.5 w-3.5" />
            削除
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* 金額 */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            金額 <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-card pl-7 pr-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* カテゴリ */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            カテゴリ
          </label>
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">未分類</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 支払い元 */}
        <MemberPicker
          label="支払い元（From）"
          selectedId={fromUserId}
          onChange={setFromUserId}
        />

        {/* 支払い先 */}
        <MemberPicker
          label="請求先（To）"
          selectedId={toUserId}
          onChange={setToUserId}
        />

        {/* メモ */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            メモ
          </label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 家賃、電気代…"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* 送信 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "更新する" : "登録する"}
        </button>
      </div>
    </div>
  );
}
