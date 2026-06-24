import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error";
import { useKoteihi, useCostSettings, useUpdateAutoSeisan } from "../hooks/useCost";
import { CostSubNav } from "../components/CostSubNav";
import { UserAvatar } from "../components/UserAvatar";

export default function KoteihiPage() {
  const navigate = useNavigate();

  const { data: koteihiList = [], isLoading } = useKoteihi();
  const { data: settings } = useCostSettings();
  const updateAutoSeisan = useUpdateAutoSeisan();

  const autoSeisan = settings?.auto_seisan;

  const handleAutoSeisanToggle = async () => {
    try {
      await updateAutoSeisan.mutateAsync({
        execute_flag: !autoSeisan?.execute_flag,
        seisan_day: autoSeisan?.seisan_day ?? 1,
      });
      toast.success("自動清算設定を更新しました");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSeisanDayChange = async (day: number) => {
    try {
      await updateAutoSeisan.mutateAsync({
        execute_flag: autoSeisan?.execute_flag ?? false,
        seisan_day: day,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-semibold">固定費</h1>
        <button
          type="button"
          onClick={() => navigate("/costs/koteihi/new")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          追加
        </button>
      </div>

      <CostSubNav />

      <div className="px-4 py-4">

      {/* 自動清算設定 */}
      <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          自動清算設定
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm">自動清算を有効にする</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoSeisan?.execute_flag ?? false}
            onClick={handleAutoSeisanToggle}
            disabled={updateAutoSeisan.isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
              autoSeisan?.execute_flag
                ? "bg-primary"
                : "bg-secondary"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                autoSeisan?.execute_flag ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {autoSeisan?.execute_flag && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">毎月</span>
            <select
              value={autoSeisan.seisan_day ?? 1}
              onChange={(e) => handleSeisanDayChange(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="清算日"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}日</option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">に自動清算</span>
          </div>
        )}
      </div>

      {/* 固定費一覧 */}
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        固定費一覧
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : koteihiList.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-1 text-2xl">📋</p>
          <p className="text-sm">固定費が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {koteihiList.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => navigate(`/costs/koteihi/${k.id}/edit`)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:border-primary/40 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${k.memo ?? "固定費"} を編集`}
              >
                {/* From → To */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {k.from_user_id ? (
                    <UserAvatar nickname={k.from_nickname ?? ""} iconUrl={k.from_icon_url} userId={k.from_user_id} size="sm" />
                  ) : null}
                  <span className="text-xs text-muted-foreground">→</span>
                  {k.to_user_id ? (
                    <UserAvatar nickname={k.to_nickname ?? ""} iconUrl={k.to_icon_url} userId={k.to_user_id} size="sm" />
                  ) : null}
                  <div className="ml-1 min-w-0">
                    {k.memo && (
                      <p className="text-sm font-medium truncate">{k.memo}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {k.from_nickname ?? "—"} → {k.to_nickname ?? "—"}
                    </p>
                  </div>
                </div>

                <span className="text-base font-bold text-primary shrink-0">
                  ¥{k.amount.toLocaleString()}
                </span>
              </button>
            ))}
        </div>
      )}
      </div>
    </div>
  );
}
