import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type {
  ReminderContentBody,
  ReminderContentResponse,
  ReminderGroupBody,
  ReminderResponse,
} from "../types";

export const useReminders = (enabled = true) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["reminders", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReminderResponse[]>(
        `/api/reminders/${homeId}`,
      );
      return data;
    },
    enabled: enabled && !!homeId,
  });
};

export const useReminder = (id: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["reminder", id],
    queryFn: async () => {
      const { data } = await apiClient.get<ReminderResponse>(
        `/api/reminders/${id}/detail`,
      );
      return data;
    },
    enabled: enabled && !!id,
  });

export const useCreateReminder = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (body: ReminderGroupBody) => {
      const { data } = await apiClient.post<ReminderResponse>(
        "/api/reminders",
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
    },
  });
};

export const useUpdateReminder = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: ReminderGroupBody }) => {
      const { data } = await apiClient.put<ReminderResponse>(
        `/api/reminders/${id}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
      qc.invalidateQueries({ queryKey: ["reminder", id] });
    },
  });
};

export const useDeleteReminder = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/reminders/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["reminder", id] });
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
    },
  });
};

export const useCreateReminderContent = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({
      reminderId,
      body,
    }: {
      reminderId: number;
      body: ReminderContentBody;
    }) => {
      const { data } = await apiClient.post<ReminderContentResponse>(
        `/api/reminders/${reminderId}/contents`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { reminderId }) => {
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
      qc.invalidateQueries({ queryKey: ["reminder", reminderId] });
    },
  });
};

export const useUpdateReminderContent = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({
      contentId,
      body,
    }: {
      contentId: number;
      reminderId: number;
      body: ReminderContentBody;
    }) => {
      const { data } = await apiClient.put<ReminderContentResponse>(
        `/api/reminders/contents/${contentId}`,
        body,
      );
      return data;
    },
    onSuccess: (_data, { reminderId }) => {
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
      qc.invalidateQueries({ queryKey: ["reminder", reminderId] });
      qc.invalidateQueries({ queryKey: ["reminderContent"] });
    },
  });
};

export const useReminderContent = (contentId: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["reminderContent", contentId],
    queryFn: async () => {
      const { data } = await apiClient.get<ReminderContentResponse>(
        `/api/reminders/contents/${contentId}`,
      );
      return data;
    },
    enabled: enabled && !!contentId,
  });

export const useDeleteReminderContent = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({
      contentId,
    }: {
      contentId: number;
      reminderId: number;
    }) => {
      await apiClient.delete(`/api/reminders/contents/${contentId}`);
      return contentId;
    },
    onSuccess: (_data, { reminderId }) => {
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
      qc.invalidateQueries({ queryKey: ["reminder", reminderId] });
    },
  });
};

export const useToggleReminderContent = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({
      contentId,
    }: {
      contentId: number;
      reminderId: number;
    }) => {
      const { data } = await apiClient.post<ReminderContentResponse>(
        `/api/reminders/contents/${contentId}/toggle`,
      );
      return data;
    },
    onMutate: async ({ contentId, reminderId }) => {
      await qc.cancelQueries({ queryKey: ["reminders", homeId] });
      const previous = qc.getQueryData<ReminderResponse[]>(["reminders", homeId]);
      if (previous) {
        qc.setQueryData<ReminderResponse[]>(["reminders", homeId], (old) =>
          old?.map((reminder) => {
            if (reminder.id !== reminderId) return reminder;
            const updatedContents = reminder.contents.map((c) =>
              c.id === contentId ? { ...c, is_active: !c.is_active } : c,
            );
            const allActive =
              updatedContents.length > 0 &&
              updatedContents.every((c) => c.is_active);
            return {
              ...reminder,
              complete_flag: allActive,
              contents: updatedContents,
            };
          }),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["reminders", homeId], context.previous);
      }
    },
    onSettled: (_data, _err, { reminderId }) => {
      qc.invalidateQueries({ queryKey: ["reminders", homeId] });
      qc.invalidateQueries({ queryKey: ["reminder", reminderId] });
    },
  });
};
