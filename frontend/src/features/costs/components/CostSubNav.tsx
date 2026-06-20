import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { label: "💰 支出一覧", to: "/costs" },
  { label: "🤝 清算一覧", to: "/costs/seisan" },
  { label: "📊 集計", to: "/costs/summary" },
  { label: "🏷 カテゴリ", to: "/costs/categories" },
  { label: "🔁 固定費", to: "/costs/koteihi" },
] as const;

export function CostSubNav() {
  const { pathname } = useLocation();

  const isActive = (to: string) =>
    to === "/costs" ? pathname === "/costs" : pathname.startsWith(to);

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2.5">
      {NAV_ITEMS.map(({ label, to }) => (
        <Link
          key={to}
          to={to}
          className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isActive(to)
              ? "border-primary bg-primary/10 font-semibold text-primary"
              : "border-border bg-background text-muted-foreground hover:text-primary"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
