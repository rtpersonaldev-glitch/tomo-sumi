import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { AlbumDetailResponse, AlbumListResponse } from "../types";

export const useAlbums = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["albums", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<AlbumListResponse[]>(`/api/albums/${homeId}`);
      return data;
    },
    enabled: !!homeId,
  });
};

export const useAlbum = (id: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["album", id],
    queryFn: async () => {
      const { data } = await apiClient.get<AlbumDetailResponse>(`/api/albums/${id}/detail`);
      return data;
    },
    enabled: enabled && !!id,
  });

export const useCreateAlbum = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ title, pictures }: { title: string; pictures: File[] }) => {
      const formData = new FormData();
      formData.append("title", title);
      pictures.forEach((pic) => formData.append("pictures", pic));
      const { data } = await apiClient.post<AlbumDetailResponse>("/api/albums", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["albums", homeId] });
    },
  });
};

export const useUpdateAlbum = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({
      id,
      title,
      pictures,
    }: {
      id: number;
      title: string;
      pictures: File[];
    }) => {
      const formData = new FormData();
      formData.append("title", title);
      pictures.forEach((pic) => formData.append("pictures", pic));
      const { data } = await apiClient.put<AlbumDetailResponse>(`/api/albums/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["albums", homeId] });
      qc.invalidateQueries({ queryKey: ["album", id] });
    },
  });
};

export const useDeleteAlbum = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/albums/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["album", id] });
      qc.invalidateQueries({ queryKey: ["albums", homeId] });
    },
  });
};

export const useDeletePicture = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ albumId, picId }: { albumId: number; picId: number }) => {
      await apiClient.delete(`/api/albums/${albumId}/pictures/${picId}`);
      return { albumId, picId };
    },
    onSuccess: (_data, { albumId }) => {
      qc.invalidateQueries({ queryKey: ["album", albumId] });
    },
  });
};
