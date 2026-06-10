import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchedules } from "../hooks/useSchedule";
import { useHomeMembers } from "@/features/home/hooks/useHome";
import type { ScheduleResponse } from "../types";
import type { HomeMemberResponse } from "@/features/home/types";

type Tab = "calendar" | "list";

function groupByDate(schedules: ScheduleResponse[]): [string, ScheduleResponse[]][] {
  const map = new Map<string, ScheduleResponse[]>();
  const sorted = [...schedules].sort(
    (a, b) => parseISO(a.start_day).getTime() - parseISO(b.start_day).getTime(),
  );
  for (const s of sorted) {
    const key = format(parseISO(s.start_day), "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()];
}

function findMember(
  members: HomeMemberResponse[],
  id: number | null,
): HomeMemberResponse | null {
  if (!id) return null;
  return members.find((m) => m.id === id) ?? null;
}

function MemberChip({ member }: { member: HomeMemberResponse | null }) {
  if (!member) return null;
  return (
    <span className="flex items-center gap-1">
      {member.icon_url ? (
        <img
          src={member.icon_url}
          alt={member.nickname}
          className="h-4 w-4 rounded-full object-cover"
        />
      ) : (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          {member.nickname.charAt(0)}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{member.nickname}</span>
    </span>
  );
}

function ScheduleCard({
  schedule,
  members,
  onClick,
}: {
  schedule: ScheduleResponse;
  members: HomeMemberResponse[];
  onClick: () => void;
}) {
  const creator = findMember(members, schedule.created_by);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors shadow-sm dark:shadow-none"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm leading-snug">{schedule.title}</span>
        <span className="text-muted-foreground text-xs shrink-0" aria-hidden>
          ›
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {format(parseISO(schedule.start_day), "HH:mm")} 〜{" "}
        {format(parseISO(schedule.end_day), "HH:mm")}
      </p>
      {schedule.memo && (
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{schedule.memo}</p>
      )}
      {creator && (
        <div className="mt-1.5">
          <MemberChip member={creator} />
        </div>
      )}
    </button>
  );
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: schedules, isLoading, isError } = useSchedules();
  const { data: members = [] } = useHomeMembers();

  const scheduleDates = useMemo(() => {
    const s = new Set<string>();
    for (const schedule of schedules ?? []) {
      s.add(format(parseISO(schedule.start_day), "yyyy-MM-dd"));
    }
    return s;
  }, [schedules]);

  const selectedDateSchedules = useMemo(() => {
    if (!selectedDate) return [];
    return (schedules ?? []).filter(
      (s) => format(parseISO(s.start_day), "yyyy-MM-dd") === selectedDate,
    );
  }, [schedules, selectedDate]);

  const grouped = groupByDate(schedules ?? []);

  const dayCellContent = useCallback(
    (arg: { date: Date }) => {
      const day = arg.date.getDay();
      const dateStr = format(arg.date, "yyyy-MM-dd");
      const isSelected = dateStr === selectedDate;
      const hasEvent = scheduleDates.has(dateStr);
      return (
        <div className="flex flex-col items-center gap-0.5 py-0.5">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs leading-none",
              isSelected
                ? "bg-primary font-bold text-primary-foreground"
                : day === 0
                  ? "text-red-500"
                  : day === 6
                    ? "text-blue-500"
                    : "",
            )}
          >
            {arg.date.getDate()}
          </span>
          {hasEvent && (
            <span
              className={cn(
                "h-1 w-1 rounded-full",
                isSelected ? "bg-primary-foreground" : "bg-primary",
              )}
              aria-hidden
            />
          )}
        </div>
      );
    },
    [selectedDate, scheduleDates],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">スケジュール</h1>
        <button
          type="button"
          onClick={() =>
            navigate(
              selectedDate ? `/schedules/new?date=${selectedDate}` : "/schedules/new",
            )
          }
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all"
        >
          ＋ 作成
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
        {(["calendar", "list"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={cn(
              "rounded-md px-4 py-1.5 text-xs font-semibold transition-all",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "calendar" ? "📅 カレンダー" : "📋 一覧"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="読み込み中" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
          スケジュールの取得に失敗しました
        </div>
      )}

      {/* Calendar tab */}
      {tab === "calendar" && !isLoading && !isError && (
        <>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-none [&_.fc-button]:rounded-lg [&_.fc-button]:border-border [&_.fc-button-primary]:bg-primary [&_.fc-button-primary]:border-primary [&_.fc-today-button]:opacity-80 [&_.fc-daygrid-day-top]:justify-center [&_.fc-daygrid-day-number]:p-0">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              locale="ja"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "",
              }}
              buttonText={{ today: "今日" }}
              events={[]}
              dateClick={(info) => setSelectedDate(info.dateStr)}
              height="auto"
              dayCellContent={dayCellContent}
            />
          </div>

          {selectedDate ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {format(parseISO(selectedDate), "M月d日（E）", { locale: ja })}の予定
              </p>
              {selectedDateSchedules.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <span className="text-3xl" aria-hidden>
                    📭
                  </span>
                  <p className="text-sm">この日の予定はありません</p>
                </div>
              ) : (
                selectedDateSchedules.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    members={members}
                    onClick={() => navigate(`/schedules/${s.id}`)}
                  />
                ))
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              日付をタップして予定を確認
            </p>
          )}
        </>
      )}

      {/* List tab */}
      {tab === "list" && !isLoading && !isError && (
        <div className="space-y-1">
          {grouped.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <span className="text-4xl" aria-hidden>
                📭
              </span>
              <p className="text-sm">まだスケジュールがありません</p>
            </div>
          )}
          {grouped.map(([dateKey, items]) => (
            <div key={dateKey}>
              <p className="text-xs font-semibold text-muted-foreground pt-4 pb-1.5 first:pt-0">
                {format(parseISO(dateKey), "M月d日（E）", { locale: ja })}
              </p>
              <div className="space-y-2">
                {items.map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    members={members}
                    onClick={() => navigate(`/schedules/${s.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
