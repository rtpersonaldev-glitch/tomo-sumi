import { useState } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAuthStore } from "@/store/authStore";
import { useCostSummary } from "../hooks/useCost";
import { CostSubNav } from "../components/CostSubNav";
import { UserAvatar } from "../components/UserAvatar";

const PIE_COLORS = ["#37ab9d", "#d97706", "#2563eb", "#e11d48", "#7c3aed", "#059669"];

export default function CostSummaryPage() {
  const homeUsers = useAuthStore((s) => s.homeUsers);
  const [currentDate, setCurrentDate] = useState(new Date());
  const period = format(currentDate, "yyyy-MM");

  const { data: summary, isLoading } = useCostSummary(period);

  const pieData = (summary?.by_category ?? []).map((c) => ({
    name: c.name,
    value: c.amount,
  }));

  const barData = (summary?.by_user ?? []).map((u) => {
    const user = homeUsers.find((m) => m.id === u.user_id);
    return {
      name: user?.nickname ?? u.nickname,
      amount: u.amount,
      userId: u.user_id,
      iconUrl: user?.icon_url ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="px-4 py-4">
        <h1 className="text-xl font-semibold">家計集計</h1>
      </div>

      <CostSubNav />

      <div className="px-4 py-4">
      {/* 期間ナビ */}
      <div className="mb-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="前月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[120px] text-center text-base font-semibold">
          {format(currentDate, "yyyy年M月", { locale: ja })}
        </span>
        <button
          type="button"
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="次月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* 合計 */}
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-center shadow-sm">
            <p className="mb-1 text-xs text-muted-foreground">今月の合計支出</p>
            <p className="text-3xl font-bold text-primary">
              ¥{(summary?.total_amount ?? 0).toLocaleString()}
            </p>
          </div>

          {/* カテゴリ別 Pie */}
          {pieData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                カテゴリ別
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${Math.round((percent ?? 0) * 100)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value: string) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                  <Tooltip
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* メンバー別 Bar */}
          {barData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                メンバー別（支払額）
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, "支払額"]}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {barData.map((_entry, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* メンバーアイコン行 */}
              <div className="mt-3 flex justify-around">
                {barData.map((entry) => (
                  <div key={entry.userId} className="flex flex-col items-center gap-1">
                    <UserAvatar
                      nickname={entry.name}
                      iconUrl={entry.iconUrl}
                      userId={entry.userId}
                      size="sm"
                    />
                    <span className="text-[10px] text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pieData.length === 0 && barData.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              この月の支出データがありません
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
