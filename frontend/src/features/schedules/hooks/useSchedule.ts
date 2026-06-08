import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { ScheduleResponse } from "../types";

interface ListParams {
  start?: string;
  end?: string;
}

interface ScheduleBody {
  title: string;
  memo: string;
  start_day: string;
  end_day: string;
}

export const useSchedules = (params?: ListParams, enabled = true) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["schedules", homeId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<ScheduleResponse[]>(
        `/api/schedules/${homeId}`,
        { params: params ?? {} },
      );
      return data;
    },
    enabled: enabled && !!homeId,
  });
};

export const useSchedule = (id: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["schedule", id],
    queryFn: async () => {
      const { data } = await apiClient.get<ScheduleResponse>(
        `/api/schedules/${id}/detail`,
      );
      return data;
    },
    enabled: enabled && !!id,
  });

export const useCreateSchedule = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (body: ScheduleBody) => {
      const { data } = await apiClient.post<ScheduleResponse>("/api/schedules", body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules", homeId] });
    },
  });
};

export const useUpdateSchedule = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: ScheduleBody }) => {
      const { data } = await apiClient.put<ScheduleResponse>(
        `/api/schedules/${id}`,
        body,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["schedule", data.id], data);
      qc.invalidateQueries({ queryKey: ["schedules", homeId] });
    },
  });
};

export const useDeleteSchedule = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/schedules/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["schedule", id] });
      qc.invalidateQueries({ queryKey: ["schedules", homeId] });
    },
  });
};
