import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { PRIORITY_CONFIG } from "@/features/announces/types";
import { useDashboard } from "../hooks/useHome";
import type { AnnounceResponse, HomeMemberResponse, DashboardScheduleResponse } from "../types";

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

function AnnounceCard({
  announce,
  onClick,
}: {
  announce: AnnounceResponse;
  onClick: () => void;
}) {
  const prio = PRIORITY_CONFIG[announce.priority];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/40 transition-colors shadow-sm dark:shadow-none"
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-bold",
            prio.badgeClass,
          )}
        >
          {prio.label}
        </span>
        <span className="flex-1 text-sm font-semibold leading-snug line-clamp-2">
          {announce.title}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {announce.content}
      </p>
      <div className="flex items-center gap-2 flex-wrap border-t border-border/50 pt-2">
        <span className="text-xs text-muted-foreground">
          期限: {format(parseISO(announce.end_date), "yyyy年M月d日", { locale: ja })}
        </span>
        {announce.created_by_user && (
          <div className="flex items-center gap-1" aria-label={`投稿者: ${announce.created_by_user.nickname}`}>
            {announce.created_by_user.icon_url ? (
              <img
                src={announce.created_by_user.icon_url}
                alt={announce.created_by_user.nickname}
                className="h-[18px] w-[18px] rounded-full object-cover"
              />
            ) : (
              <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {announce.created_by_user.nickname.charAt(0)}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {announce.created_by_user.nickname}
            </span>
          </div>
        )}
        <span
          className={cn(
            "ml-auto text-xs flex items-center gap-1",
            announce.is_liked ? "text-red-500" : "text-muted-foreground",
          )}
          aria-label={`いいね ${announce.like_count}件`}
        >
          {announce.is_liked ? "❤️" : "🤍"} {announce.like_count}
        </span>
      </div>
    </button>
  );
}

function ScheduleItem({ schedule }: { schedule: DashboardScheduleResponse }) {
  const startDate = new Date(schedule.start_day);
  const endDate = new Date(schedule.end_day);
  return (
    <div className="flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-b-0">
      <span className="w-12 flex-shrink-0 text-xs font-bold text-primary pt-0.5">
        {format(startDate, "HH:mm")}
      </span>
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary mt-1.5" aria-hidden />
      <div>
        <p className="text-sm font-medium">{schedule.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {format(startDate, "HH:mm")} 〜 {format(endDate, "HH:mm")}
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
      {/* Home image header */}
      <button
        type="button"
        onClick={() => navigate("/settings/home")}
        className="relative w-full overflow-hidden rounded-xl shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="ホーム設定を開く"
      >
        <div className="aspect-[16/6] w-full bg-muted">
          {home?.homeImageUrl ? (
            <img
              src={home.homeImageUrl}
              alt={home.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/30 to-primary/10" />
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
          <p className="text-base font-semibold text-white">{home?.name ?? "ホーム"}</p>
        </div>
      </button>

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

      {/* Today's schedules */}
      <section aria-labelledby="schedules-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="schedules-heading"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            今日のスケジュール
          </h2>
          {data.today_schedules.length > 0 && (
            <span className="text-xs font-semibold text-primary">
              {data.today_schedules.length}件
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {data.today_schedules.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              今日のスケジュールはありません
            </p>
          ) : (
            data.today_schedules.map((schedule) => (
              <ScheduleItem key={schedule.id} schedule={schedule} />
            ))
          )}
        </div>
      </section>

      {/* Announces */}
      <section aria-labelledby="announces-heading">
        <div className="flex items-center justify-between mb-3">
          <h2
            id="announces-heading"
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            お知らせ
          </h2>
          <button
            type="button"
            onClick={() => navigate("/announces")}
            className="text-xs text-primary hover:underline"
          >
            一覧を見る
          </button>
        </div>
        {data.announces.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-8 text-muted-foreground">
            <span className="text-3xl" aria-hidden>📭</span>
            <p className="text-sm">期限内のお知らせはありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.announces.map((announce) => (
              <AnnounceCard
                key={announce.id}
                announce={announce}
                onClick={() => navigate(`/announces/${announce.id}`)}
              />
            ))}
            {data.has_more_announces && (
              <button
                type="button"
                onClick={() => navigate("/announces")}
                className="w-full rounded-xl border border-dashed border-border py-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                他にもお知らせがあります → 一覧を見る
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
