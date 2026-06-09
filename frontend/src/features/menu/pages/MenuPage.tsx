import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckSquare,
  AlarmClock,
  Wallet,
  Image,
  Activity,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  sub: string;
  path: string;
  colorClass: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    icon: Bell,
    label: "お知らせ",
    sub: "ホームのお知らせ",
    path: "/announces",
    colorClass: "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
  },
  {
    icon: CheckSquare,
    label: "TODO",
    sub: "やることリスト",
    path: "/todos",
    colorClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  },
  {
    icon: AlarmClock,
    label: "リマインダー",
    sub: "定期的なリマインド",
    path: "/reminders",
    colorClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  },
  {
    icon: Wallet,
    label: "家計",
    sub: "支出・清算管理",
    path: "/costs",
    colorClass: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
  },
  {
    icon: Image,
    label: "アルバム",
    sub: "写真・思い出",
    path: "/albums",
    colorClass: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  },
  {
    icon: Activity,
    label: "アクティビティ",
    sub: "操作履歴ログ",
    path: "/activity",
    colorClass: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  },
];

const SETTINGS_ITEMS: MenuItem[] = [
  {
    icon: Settings,
    label: "ホーム設定",
    sub: "名前・画像・メンバー管理",
    path: "/settings/home",
    colorClass: "bg-secondary text-foreground",
  },
];

function MenuGridItem({ item }: { item: MenuItem }) {
  const navigate = useNavigate();
  const { icon: Icon } = item;

  return (
    <button
      type="button"
      onClick={() => navigate(item.path)}
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl bg-card p-4",
        "border border-border shadow-sm transition-colors",
        "hover:border-primary/30 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-[14px]", item.colorClass)}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.sub}</p>
      </div>
    </button>
  );
}

function MenuRowItem({ item }: { item: MenuItem }) {
  const navigate = useNavigate();
  const { icon: Icon } = item;

  return (
    <button
      type="button"
      onClick={() => navigate(item.path)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3",
        "border border-border shadow-sm transition-colors",
        "hover:border-primary/30 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]", item.colorClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.sub}</p>
      </div>
      <span className="text-lg leading-none text-muted-foreground/50" aria-hidden="true">›</span>
    </button>
  );
}

export default function MenuPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pb-6 pt-4">
        <section aria-labelledby="features-heading">
          <h2
            id="features-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            機能一覧
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {MENU_ITEMS.map((item) => (
              <MenuGridItem key={item.path} item={item} />
            ))}
          </div>
        </section>

        <section aria-labelledby="settings-heading" className="mt-6">
          <h2
            id="settings-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            設定
          </h2>
          <div className="flex flex-col gap-2">
            {SETTINGS_ITEMS.map((item) => (
              <MenuRowItem key={item.path} item={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
