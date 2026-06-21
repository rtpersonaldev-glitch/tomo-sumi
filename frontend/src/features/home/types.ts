import type { AnnounceResponse } from "@/features/announces/types";

export type { AnnounceResponse };

export interface HomeResponse {
  id: number;
  name: string;
  home_image_url: string | null;
}

export interface HomeMemberResponse {
  id: number;
  nickname: string;
  status: "at_home" | "away";
  icon_url: string | null;
  return_time: string | null;
}

export interface InvitationCodeResponse {
  code: string;
  expires_at: string;
}

export interface ScheduleCreatorResponse {
  id: number;
  nickname: string;
  icon_url: string | null;
}

export interface DashboardScheduleResponse {
  id: number;
  title: string;
  start_day: string;
  end_day: string;
  created_by_user: ScheduleCreatorResponse | null;
}

export interface DashboardResponse {
  members: HomeMemberResponse[];
  today_schedules: DashboardScheduleResponse[];
  unread_announce_count: number;
  announces: AnnounceResponse[];
  has_more_announces: boolean;
}
