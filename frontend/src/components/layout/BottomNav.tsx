import { useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircle, Newspaper, Calendar, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: Home, label: "ホーム", path: "/home" },
  { icon: MessageCircle, label: "チャット", path: "/chat" },
  { icon: Newspaper, label: "投稿", path: "/posts" },
  { icon: Calendar, label: "カレンダー", path: "/schedules" },
  { icon: LayoutGrid, label: "メニュー", path: "/menu" },
] as const;

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex h-16 border-t border-border bg-card pb-safe md:hidden"
      aria-label="メインナビゲーション"
    >
      {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
        const isActive = location.pathname === path ||
          (path !== "/home" && path !== "/menu" && location.pathname.startsWith(path));

        return (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-primary" />
            )}
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className={cn("text-[10px]", isActive && "font-semibold")}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
