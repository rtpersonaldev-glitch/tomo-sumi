import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

export interface ActivityLog {
  id: number;
  user_id: number | null;
  nickname: string | null;
  icon_url: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  target_label: string | null;
  is_read: boolean;
  created_at: string;
}

interface UnreadCountResponse {
  count: number;
}

export const useActivityLogs = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["activity-logs", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<ActivityLog[]>(`/api/activity/${homeId}`);
      return data;
    },
    enabled: !!homeId,
  });
};

export const useUnreadActivityCount = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["activity-unread-count", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<UnreadCountResponse>("/api/activity/unread-count");
      return data;
    },
    enabled: !!homeId,
    refetchInterval: 30_000,
  });
};

export const useMarkActivityAsRead = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/api/activity/mark-as-read");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-unread-count", homeId] });
    },
  });
};
