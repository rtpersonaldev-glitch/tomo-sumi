import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type {
  DashboardResponse,
  HomeMemberResponse,
  HomeResponse,
  InvitationCodeResponse,
} from "../types";

export const useMyHomes = () =>
  useQuery({
    queryKey: ["homes"],
    queryFn: async () => {
      const { data } = await apiClient.get<HomeResponse[]>("/api/homes");
      return data;
    },
  });

export const useCreateHome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post<HomeResponse>("/api/homes", { name });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homes"] });
    },
  });
};

export const useJoinHome = () =>
  useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.post<HomeResponse>(`/api/homes/join/${code}`);
      return data;
    },
  });

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardResponse>("/api/homes/dashboard");
      return data;
    },
  });

interface UpdateHomeInput {
  homeId: number;
  name: string;
  image?: File | null;
}

export const useUpdateHome = () => {
  const qc = useQueryClient();
  const setHome = useAuthStore((s) => s.setHome);

  return useMutation({
    mutationFn: async ({ homeId, name, image }: UpdateHomeInput) => {
      const formData = new FormData();
      formData.append("name", name);
      if (image) formData.append("home_image", image);
      const { data } = await apiClient.put<HomeResponse>(`/api/homes/${homeId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (data) => {
      const currentHomeUsers = useAuthStore.getState().homeUsers;
      setHome(
        { id: data.id, name: data.name, homeImagePath: data.home_image_url },
        currentHomeUsers,
      );
      qc.invalidateQueries({ queryKey: ["homes"] });
    },
  });
};

export const useInvitationCode = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["invitation-code", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<InvitationCodeResponse>(
        `/api/homes/${homeId}/invitation-code`,
      );
      return data;
    },
    enabled: !!homeId,
  });
};

export const useRefreshInvitationCode = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return () => {
    qc.invalidateQueries({ queryKey: ["invitation-code", homeId] });
  };
};

export const useHomeMembers = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["home-members", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<HomeMemberResponse[]>(
        `/api/homes/${homeId}/users`,
      );
      return data;
    },
    enabled: !!homeId,
    staleTime: 5 * 60 * 1000,
  });
};
