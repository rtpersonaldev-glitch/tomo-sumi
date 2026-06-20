export interface AnnounceUserInfo {
  id: number;
  nickname: string;
  icon_url: string | null;
}

export interface AnnounceResponse {
  id: number;
  home_id: number;
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  end_date: string;
  like_count: number;
  is_liked: boolean;
  recipient_ids: number[];
  link_url: string | null;
  created_at: string;
  created_by_user: AnnounceUserInfo | null;
}

export interface AnnounceLikeResponse {
  liked: boolean;
  like_count: number;
}

export interface AnnounceFormValues {
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  end_date: string;
  recipient_ids: number[];
}

export const PRIORITY_CONFIG = {
  high: {
    label: "🔴 高",
    badgeClass:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  medium: {
    label: "🟡 中",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  low: {
    label: "⚪ 低",
    badgeClass: "bg-muted text-muted-foreground",
  },
} as const;
