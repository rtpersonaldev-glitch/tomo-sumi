import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { useDashboard } from "../hooks/useHome";
import type { HomeMemberResponse, DashboardScheduleResponse } from "../types";

function MemberAvatar({ member }: { member: HomeMemberResponse }) {
  const isAtHome = member.status === "at_home";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {member.icon_url ? (
          <img
            src={member.icon_url}
            alt={member.nickname}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {member.nickname.charAt(0)}
          </div>
        )}
        <span
          className={cn(
            "absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-background",
            isAtHome ? "bg-green-500" : "bg-slate-400",
          )}
          aria-hidden
        />
      </div>
      <span className="max-w-[56px] truncate text-xs text-foreground">{member.nickname}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
          isAtHome
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isAtHome
          ? "在宅"
          : member.return_time
            ? `${format(new Date(member.return_time), "H:mm")}帰宅`
            : "外出"}
      </span>
    </div>
  );
}

function ScheduleItem({ schedule }: { schedule: DashboardScheduleResponse }) {
  const startDate = new Date(schedule.start_day);
  return (
    <div className="flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0">
      <span className="w-12 flex-shrink-0 text-xs font-bold text-primary pt-0.5">
        {format(startDate, "HH:mm")}
      </span>
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary mt-1.5" aria-hidden />
      <div>
        <p className="text-sm font-medium">{schedule.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {format(startDate, "M月d日(E)", { locale: ja })}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const home = useAuthStore((s) => s.home);
  const currentUser = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="読み込み中" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">データの取得に失敗しました</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{home?.name ?? "ホーム"}</h1>
        <button
          type="button"
          onClick={() => navigate("/settings/home")}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="ホーム設定"
        >
          設定
        </button>
      </div>

      {/* Unread announce banner */}
      {data.unread_announce_count > 0 && (
        <button
          type="button"
          onClick={() => navigate("/announces")}
          className="flex w-full items-center gap-3 rounded-xl border border-accent/60 bg-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/20"
          aria-label={`未読のお知らせが${data.unread_announce_count}件あります`}
        >
          <span className="text-lg" aria-hidden>📢</span>
          <span className="flex-1 text-sm font-medium">未読のお知らせがあります</span>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-white">
            {data.unread_announce_count}
          </span>
        </button>
      )}

      {/* Member status */}
      <section aria-labelledby="members-heading">
        <h2
          id="members-heading"
          className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          メンバーの状況
        </h2>
        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">メンバー情報がありません</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {data.members.map((member) => (
              <MemberAvatar
                key={member.id}
                member={
                  member.id === currentUser?.id
                    ? { ...member, status: currentUser.status }
                    : member
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming schedules */}
      <section aria-labelledby="schedules-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="schedules-heading"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            直近のスケジュール
          </h2>
          {data.upcoming_schedules.length > 0 && (
            <span className="text-xs font-semibold text-primary">
              {data.upcoming_schedules.length}件
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {data.upcoming_schedules.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              直近のスケジュールはありません
            </p>
          ) : (
            data.upcoming_schedules.map((schedule) => (
              <ScheduleItem key={schedule.id} schedule={schedule} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
