import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";

interface UserResponse {
  id: number;
  email: string;
  nickname: string;
  icon_url: string | null;
  status: "at_home" | "away";
  notification_flag: boolean;
}

interface SettingsResponse {
  notification_flag: boolean;
}

export const useNotificationSettings = () =>
  useQuery({
    queryKey: ["notification-settings"],
    queryFn: () =>
      apiClient.get<SettingsResponse>("/api/auth/settings").then((r) => r.data),
  });

export const useUpdateProfile = () => {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: async (data: { nickname: string; icon?: File }) => {
      const form = new FormData();
      form.append("nickname", data.nickname);
      if (data.icon) form.append("icon", data.icon);
      const res = await apiClient.put<UserResponse>("/api/auth/profile", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUser({
        id: data.id,
        email: data.email,
        nickname: data.nickname,
        icon_url: data.icon_url,
        status: data.status,
        notification_flag: data.notification_flag,
      });
    },
  });
};

export const useToggleStatus = () => {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: () =>
      apiClient.post<UserResponse>("/api/auth/status/toggle").then((r) => r.data),
    onSuccess: (data) => {
      setUser({
        id: data.id,
        email: data.email,
        nickname: data.nickname,
        icon_url: data.icon_url,
        status: data.status,
        notification_flag: data.notification_flag,
      });
    },
  });
};

export const useToggleNotification = () => {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: () =>
      apiClient
        .post<SettingsResponse>("/api/auth/notification/toggle")
        .then((r) => r.data),
    onSuccess: (data) => {
      const current = useAuthStore.getState().user;
      if (current) {
        setUser({ ...current, notification_flag: data.notification_flag });
      }
    },
  });
};
