import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { AnnounceFormValues, AnnounceLikeResponse, AnnounceResponse } from "../types";

interface ListParams {
  search?: string;
  priority?: string;
  ordering?: string;
}

export const useAnnounces = (params: ListParams = {}) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["announces", homeId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<AnnounceResponse[]>(
        `/api/announces/${homeId}`,
        {
          params: {
            ...(params.search && { search: params.search }),
            ...(params.priority && { priority: params.priority }),
            ...(params.ordering && { ordering: params.ordering }),
          },
        },
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useAnnounce = (id: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["announce", id],
    queryFn: async () => {
      const { data } = await apiClient.get<AnnounceResponse>(
        `/api/announces/${id}/detail`,
      );
      return data;
    },
    enabled: enabled && !!id,
  });

export const useCreateAnnounce = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (body: AnnounceFormValues) => {
      const { data } = await apiClient.post<AnnounceResponse>("/api/announces", body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announces", homeId] });
    },
  });
};

export const useUpdateAnnounce = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: AnnounceFormValues }) => {
      const { data } = await apiClient.put<AnnounceResponse>(
        `/api/announces/${id}`,
        body,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["announce", data.id], data);
      qc.invalidateQueries({ queryKey: ["announces", homeId] });
    },
  });
};

export const useDeleteAnnounce = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/announces/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["announce", id] });
      qc.invalidateQueries({ queryKey: ["announces", homeId] });
    },
  });
};

export const useToggleLike = (announceId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<AnnounceLikeResponse>(
        `/api/announces/${announceId}/like`,
      );
      return data;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["announce", announceId] });
      const prev = qc.getQueryData<AnnounceResponse>(["announce", announceId]);
      if (prev) {
        qc.setQueryData<AnnounceResponse>(["announce", announceId], {
          ...prev,
          is_liked: !prev.is_liked,
          like_count: prev.is_liked ? prev.like_count - 1 : prev.like_count + 1,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(["announce", announceId], context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["announce", announceId] });
    },
  });
};

export const useSendPush = () =>
  useMutation({
    mutationFn: async (announceId: number) => {
      await apiClient.post(`/api/announces/${announceId}/push`);
    },
  });
