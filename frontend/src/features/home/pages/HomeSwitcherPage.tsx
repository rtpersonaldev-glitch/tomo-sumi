import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelectHome } from "@/features/auth/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useMyHomes } from "../hooks/useHome";
import type { HomeResponse } from "../types";

const AVATAR_COLORS = [
  "bg-primary",
  "bg-orange-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-amber-500",
];

const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

function HomeCard({
  home,
  isSelected,
  onSelect,
  isPending,
}: {
  home: HomeResponse;
  isSelected: boolean;
  onSelect: () => void;
  isPending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
        isSelected
          ? "border-primary bg-secondary/50"
          : "border-border bg-card hover:border-primary/60",
        isPending && "cursor-not-allowed opacity-60",
      )}
    >
      {home.home_image_url ? (
        <img
          src={home.home_image_url}
          alt=""
          className="h-11 w-11 rounded-lg object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold text-white",
            avatarColor(home.id),
          )}
        >
          {home.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-semibold text-foreground">{home.name}</p>
        {isSelected && (
          <p className="text-xs text-muted-foreground mt-0.5">選択中</p>
        )}
      </div>
      {isSelected && (
        <span className="text-primary text-lg" aria-hidden>
          ✓
        </span>
      )}
    </button>
  );
}

export default function HomeSwitcherPage() {
  const navigate = useNavigate();
  const { data: homes, isLoading } = useMyHomes();
  const selectHome = useSelectHome();

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            T
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tomo-sumi</h1>
          <p className="text-sm text-muted-foreground">参加しているホームを選択してください</p>
        </div>

        {/* Home list */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            所属ホーム
          </p>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !homes || homes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                まだホームに参加していません
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {homes.map((home) => (
                <HomeCard
                  key={home.id}
                  home={home}
                  isSelected={false}
                  onSelect={() => selectHome.mutate(home.id)}
                  isPending={selectHome.isPending}
                />
              ))}
            </div>
          )}
        </div>

        {selectHome.error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            ホームの選択に失敗しました
          </div>
        )}

        <div className="h-px bg-border mb-6" />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/home-create")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
          >
            ＋ 新しいホームを作成
          </button>
          <button
            type="button"
            onClick={() => navigate("/join-home")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:border-primary/60"
          >
            🔗 招待コードで参加
          </button>
        </div>
      </div>
    </div>
  );
}
