import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/error";
import { useAuthStore } from "@/store/authStore";
import { useCategories, useCost, useCreateCost, useUpdateCost } from "../hooks/useCost";
import { UserAvatar } from "../components/UserAvatar";
import type { SeisanMethod, MemberBillInput } from "../types";

/* ── Method tab ───────────────────────────────────────────────────── */

const METHOD_LABELS: Record<SeisanMethod, string> = {
  equal: "均等割り",
  dish: "食数割",
  direct: "直接入力",
};

/* ── Member picker ────────────────────────────────────────────────── */

interface MemberPickerProps {
  label: string;
  members: { id: number; nickname: string; icon_url: string | null }[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  single?: boolean;
}

function MemberPicker({ label, members, selectedIds, onToggle, single }: MemberPickerProps) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-3">
        {members.map((m) => {
          const selected = selectedIds.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (single) {
                  onToggle(m.id);
                } else {
                  onToggle(m.id);
                }
              }}
              className="flex flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
              aria-pressed={selected}
            >
              <div className={cn("rounded-full p-0.5", selected ? "ring-2 ring-primary ring-offset-1" : "")}>
                <UserAvatar
                  nickname={m.nickname}
                  iconUrl={m.icon_url}
                  userId={m.id}
                  size="lg"
                />
              </div>
              <span className={cn("text-[10px]", selected ? "text-primary font-semibold" : "text-muted-foreground")}>
                {m.nickname}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────── */

export default function CostEditPage() {
  const { id } = useParams<{ id: string }>();
  const costId = id ? Number(id) : undefined;
  const isEdit = costId != null;

  const navigate = useNavigate();
  const homeUsers = useAuthStore((s) => s.homeUsers);
  const { data: existingCost, isLoading: loadingCost } = useCost(costId);
  const { data: categories = [] } = useCategories();
  const createCost = useCreateCost();
  const updateCost = useUpdateCost();

  /* ── form state ─────────────────────────────────────────── */
  const today = format(new Date(), "yyyy-MM-dd");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [payerUserId, setPayerUserId] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* 清算方法 */
  const [method, setMethod] = useState<SeisanMethod>("equal");
  const [billingTargets, setBillingTargets] = useState<number[]>([]); // 請求先ユーザーIDs
  const [memberInputs, setMemberInputs] = useState<Record<number, MemberBillInput>>({});

  /* 初期化: 編集時に既存データをセット */
  useEffect(() => {
    if (!existingCost) return;
    setPurchaseDate(existingCost.purchase_date);
    setAmount(String(existingCost.amount));
    setCategoryId(existingCost.category_id ?? "");
    setPayerUserId(existingCost.payer_user_id);
    setMemo(existingCost.memo);
    if (existingCost.receipt_image_url) setReceiptPreview(existingCost.receipt_image_url);
    if (existingCost.dish_count) {
      setMethod("dish");
    }
  }, [existingCost]);

  /* 請求先の均等割り金額 */
  const amountNum = Number(amount) || 0;
  const equalPerPerson = billingTargets.length > 0 ? Math.floor(amountNum / billingTargets.length) : 0;

  /* 食数割の合計皿数・1皿あたり金額 */
  const totalDishCount = useMemo(
    () => billingTargets.reduce((sum, uid) => sum + (memberInputs[uid]?.dishCount ?? 1), 0),
    [billingTargets, memberInputs],
  );
  const perDish = totalDishCount > 0 ? Math.floor(amountNum / totalDishCount) : 0;

  /* 直接入力の合計チェック */
  const directTotal = useMemo(
    () => billingTargets.reduce((sum, uid) => sum + (memberInputs[uid]?.amount ?? 0), 0),
    [billingTargets, memberInputs],
  );
  const directOk = amountNum > 0 && directTotal === amountNum;

  const toggleBillingTarget = (uid: number) => {
    setBillingTargets((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid],
    );
    setMemberInputs((prev) => ({
      ...prev,
      [uid]: prev[uid] ?? { userId: uid, dishCount: 1, amount: 0 },
    }));
  };

  const updateMemberInput = (uid: number, field: "dishCount" | "amount", val: number) => {
    setMemberInputs((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] ?? { userId: uid, dishCount: 1, amount: 0 }), [field]: val },
    }));
  };

  /* ファイル選択 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  /* 送信 */
  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error("金額を入力してください");
      return;
    }
    if (method === "direct" && !directOk) {
      toast.error("請求先の合計金額が支出金額と一致しません");
      return;
    }

    const fd = new FormData();
    fd.append("purchase_date", purchaseDate);
    fd.append("amount", amount);
    if (categoryId !== "") fd.append("category_id", String(categoryId));
    if (payerUserId != null) fd.append("payer_user_id", String(payerUserId));
    fd.append("payment_method", "");
    fd.append("memo", memo);
    /* 食数割のときのみ合計皿数を送る */
    if (method === "dish" && totalDishCount > 0) {
      fd.append("dish_count", String(totalDishCount));
    }
    if (receiptFile) fd.append("receipt_image", receiptFile);

    try {
      if (isEdit && costId) {
        await updateCost.mutateAsync({ id: costId, formData: fd });
        toast.success("支出を更新しました");
      } else {
        await createCost.mutateAsync(fd);
        toast.success("支出を登録しました");
      }
      navigate("/costs");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isBusy = createCost.isPending || updateCost.isPending;

  if (isEdit && loadingCost) {
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
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </button>
        <h1 className="flex-1 text-xl font-semibold">
          {isEdit ? "支出を編集" : "支出を作成"}
        </h1>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          保存
        </button>
      </div>

      <div className="space-y-5">
        {/* 購入日・金額 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              購入日 <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              金額（円） <span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="3240"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* カテゴリ */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            カテゴリ
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">未分類</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* 支払者 */}
        <MemberPicker
          label="支払者 *"
          members={homeUsers}
          selectedIds={payerUserId != null ? [payerUserId] : []}
          onToggle={(uid) => setPayerUserId((prev) => (prev === uid ? null : uid))}
          single
        />

        {/* 清算方法 */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            清算方法
          </p>
          <div className="flex gap-1 rounded-xl bg-secondary/50 p-1 mb-4">
            {(["equal", "dish", "direct"] as SeisanMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  method === m
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>

          {/* 請求先 */}
          <MemberPicker
            label={method === "equal" ? "請求先（複数可）" : method === "dish" ? "請求先と食数" : "請求先と金額"}
            members={homeUsers}
            selectedIds={billingTargets}
            onToggle={toggleBillingTarget}
          />

          {/* 食数割 入力 */}
          {method === "dish" && billingTargets.length > 0 && (
            <div className="rounded-xl border border-border bg-card divide-y divide-border mb-3">
              {billingTargets.map((uid) => {
                const u = homeUsers.find((m) => m.id === uid);
                if (!u) return null;
                const dc = memberInputs[uid]?.dishCount ?? 1;
                return (
                  <div key={uid} className="flex items-center gap-3 px-4 py-3">
                    <UserAvatar nickname={u.nickname} iconUrl={u.icon_url} userId={u.id} size="sm" />
                    <span className="flex-1 text-sm">{u.nickname}</span>
                    <input
                      type="number"
                      min={1}
                      value={dc}
                      onChange={(e) => updateMemberInput(uid, "dishCount", Number(e.target.value) || 1)}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`${u.nickname}の食数`}
                    />
                    <span className="text-xs text-muted-foreground">食</span>
                    <span className="w-14 text-right text-xs font-semibold text-primary">
                      ¥{(perDish * dc).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 直接入力 */}
          {method === "direct" && billingTargets.length > 0 && (
            <div className="rounded-xl border border-border bg-card divide-y divide-border mb-3">
              {billingTargets.map((uid) => {
                const u = homeUsers.find((m) => m.id === uid);
                if (!u) return null;
                const val = memberInputs[uid]?.amount ?? 0;
                return (
                  <div key={uid} className="flex items-center gap-3 px-4 py-3">
                    <UserAvatar nickname={u.nickname} iconUrl={u.icon_url} userId={u.id} size="sm" />
                    <span className="flex-1 text-sm">{u.nickname}</span>
                    <input
                      type="number"
                      min={0}
                      value={val || ""}
                      onChange={(e) => updateMemberInput(uid, "amount", Number(e.target.value) || 0)}
                      className={cn(
                        "w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        !directOk && directTotal > 0
                          ? "border-destructive bg-destructive/5"
                          : "border-border bg-background",
                      )}
                      aria-label={`${u.nickname}への請求額`}
                    />
                    <span className="text-xs text-muted-foreground">円</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 結果バナー */}
          {method === "equal" && billingTargets.length > 0 && amountNum > 0 && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              {billingTargets.length}名で均等割り → 1人あたり ¥{equalPerPerson.toLocaleString()}
            </p>
          )}
          {method === "dish" && billingTargets.length > 0 && amountNum > 0 && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
              合計 {totalDishCount}食 → ¥{perDish.toLocaleString()}/食
            </p>
          )}
          {method === "direct" && billingTargets.length > 0 && amountNum > 0 && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-semibold",
                directOk
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {directOk
                ? `合計 ¥${directTotal.toLocaleString()} ✓ 金額と一致`
                : `入力合計 ¥${directTotal.toLocaleString()} ≠ 支出金額 ¥${amountNum.toLocaleString()}（差額 ¥${Math.abs(amountNum - directTotal).toLocaleString()}）`}
            </p>
          )}
        </div>

        {/* メモ */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            メモ
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="スーパーで購入…"
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* レシート画像 */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            レシート画像
          </label>
          {receiptPreview ? (
            <div className="relative inline-block">
              <img
                src={receiptPreview}
                alt="レシート"
                className="h-32 w-32 rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-[10px] text-white"
                aria-label="画像を削除"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border py-6 text-muted-foreground hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">タップして画像を追加</span>
              <span className="text-[10px] text-muted-foreground/60">JPEG / PNG / WebP</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
