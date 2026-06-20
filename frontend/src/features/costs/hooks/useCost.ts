import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type {
  AutoSeisanResponse,
  CostCategoryResponse,
  CostResponse,
  CostSettingsResponse,
  CostSummaryResponse,
  KoteihiResponse,
  SeisanListResponse,
  SeisanMeisaiResponse,
  SeisanResponse,
} from "../types";

// ─── Categories ───────────────────────────────────────────────────────────────

export const useCategories = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["cost-categories", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<CostCategoryResponse[]>(
        `/api/costs/${homeId}/categories`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post<CostCategoryResponse>(
        `/api/costs/${homeId}/categories`,
        { name },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost-categories", homeId] });
    },
  });
};

// ─── Costs ────────────────────────────────────────────────────────────────────

export const useCosts = (filters: { categoryId?: number; userId?: number } = {}) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["costs", homeId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.categoryId != null) params.set("category", String(filters.categoryId));
      if (filters.userId != null) params.set("user", String(filters.userId));
      const { data } = await apiClient.get<CostResponse[]>(
        `/api/costs/${homeId}${params.size ? `?${params.toString()}` : ""}`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useCost = (id: number | undefined) =>
  useQuery({
    queryKey: ["cost", id],
    queryFn: async () => {
      const { data } = await apiClient.get<CostResponse>(`/api/costs/${id}/detail`);
      return data;
    },
    enabled: !!id,
  });

export const useCreateCost = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post<CostResponse>("/api/costs", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costs", homeId] });
    },
  });
};

export const useUpdateCost = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      const { data } = await apiClient.put<CostResponse>(`/api/costs/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["costs", homeId] });
      qc.invalidateQueries({ queryKey: ["cost", id] });
    },
  });
};

export const useDeleteCost = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/costs/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["cost", id] });
      qc.invalidateQueries({ queryKey: ["costs", homeId] });
    },
  });
};

// ─── Summary ──────────────────────────────────────────────────────────────────

export const useCostSummary = (period: string) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["cost-summary", homeId, period],
    queryFn: async () => {
      const { data } = await apiClient.get<CostSummaryResponse>(
        `/api/costs/${homeId}/summary?period=${period}`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const useCostSettings = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["cost-settings", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<CostSettingsResponse>(
        `/api/costs/${homeId}/settings`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useUpdateAutoSeisan = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (body: { execute_flag: boolean; seisan_day: number }) => {
      const { data } = await apiClient.put<AutoSeisanResponse>(
        `/api/costs/${homeId}/settings/auto-seisan`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost-settings", homeId] });
    },
  });
};

// ─── Koteihi ──────────────────────────────────────────────────────────────────

export const useKoteihi = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["koteihi", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<KoteihiResponse[]>(
        `/api/costs/${homeId}/koteihi`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useCreateKoteihi = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (body: {
      category_id: number | null;
      amount: number;
      from_user_id: number | null;
      to_user_id: number | null;
      memo: string;
    }) => {
      const { data } = await apiClient.post<KoteihiResponse>(
        `/api/costs/${homeId}/koteihi`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["koteihi", homeId] });
    },
  });
};

export const useUpdateKoteihi = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: number;
      category_id: number | null;
      amount: number;
      from_user_id: number | null;
      to_user_id: number | null;
      memo: string;
    }) => {
      const { data } = await apiClient.put<KoteihiResponse>(`/api/costs/koteihi/${id}`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["koteihi", homeId] });
    },
  });
};

export const useDeleteKoteihi = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/costs/koteihi/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["koteihi", homeId] });
    },
  });
};

// ─── Seisan ───────────────────────────────────────────────────────────────────

export const useSeisanPending = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["seisan-pending", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<SeisanListResponse[]>(
        `/api/costs/${homeId}/seisan/pending`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useSeisanCompleted = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["seisan-completed", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<SeisanListResponse[]>(
        `/api/costs/${homeId}/seisan/completed`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useSeisan = (id: number | undefined) =>
  useQuery({
    queryKey: ["seisan", id],
    queryFn: async () => {
      const { data } = await apiClient.get<SeisanResponse>(`/api/costs/seisan/${id}`);
      return data;
    },
    enabled: !!id,
  });

export const useCreateSeisan = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (title: string) => {
      const { data } = await apiClient.post<SeisanResponse>("/api/costs/seisan", {
        title,
        settled_date: format(new Date(), "yyyy-MM-dd"),
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seisan-pending", homeId] });
      qc.invalidateQueries({ queryKey: ["costs", homeId] });
    },
  });
};

export const useCompleteMeisai = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ meisaiId, memo }: { meisaiId: number; memo: string }) => {
      const { data } = await apiClient.post<SeisanMeisaiResponse>(
        `/api/costs/seisan-meisai/${meisaiId}/complete`,
        { memo },
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seisan", data.seisan_id] });
      qc.invalidateQueries({ queryKey: ["seisan-pending"] });
      qc.invalidateQueries({ queryKey: ["seisan-completed"] });
    },
  });
};

export const useConfirmMeisai = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meisaiId: number) => {
      const { data } = await apiClient.post<SeisanMeisaiResponse>(
        `/api/costs/seisan-meisai/${meisaiId}/confirm`,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seisan", data.seisan_id] });
      qc.invalidateQueries({ queryKey: ["seisan-pending"] });
      qc.invalidateQueries({ queryKey: ["seisan-completed"] });
    },
  });
};

export const useRejectMeisai = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meisaiId: number) => {
      const { data } = await apiClient.post<SeisanMeisaiResponse>(
        `/api/costs/seisan-meisai/${meisaiId}/reject`,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seisan", data.seisan_id] });
      qc.invalidateQueries({ queryKey: ["seisan-pending"] });
      qc.invalidateQueries({ queryKey: ["seisan-completed"] });
    },
  });
};
