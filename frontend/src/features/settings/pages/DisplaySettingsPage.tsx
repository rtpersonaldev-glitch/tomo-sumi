import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeStore, type Theme } from "@/store/themeStore";

const THEME_OPTIONS: { value: Theme; icon: string; label: string; description: string }[] = [
  {
    value: "light",
    icon: "☀️",
    label: "ライト",
    description: "常に明るい表示",
  },
  {
    value: "dark",
    icon: "🌙",
    label: "ダーク",
    description: "常に暗い表示",
  },
  {
    value: "system",
    icon: "💻",
    label: "システム",
    description: "端末の設定に合わせる",
  },
];

export default function DisplaySettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label="戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-xl font-semibold">表示設定</h1>
      </div>

      {/* Theme selector */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            カラーテーマ
          </p>
        </div>
        {THEME_OPTIONS.map((option, i) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={theme === option.value}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3.5 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              "hover:bg-secondary/40",
              i > 0 && "border-t border-border",
            )}
          >
            <div
              className={cn(
                "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-base transition-colors",
                theme === option.value ? "bg-primary/15 dark:bg-primary/20" : "bg-muted/60",
              )}
            >
              {option.icon}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </div>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                theme === option.value
                  ? "border-primary bg-primary"
                  : "border-border bg-background",
              )}
              aria-hidden="true"
            >
              {theme === option.value && (
                <span className="h-2 w-2 rounded-full bg-primary-foreground" />
              )}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        ※ システムを選択すると端末のダークモード設定に自動で追従します
      </p>
    </div>
  );
}
