import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { ChatImageUploadResponse, ChatMessage } from "../types";

export const useChatHistory = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useInfiniteQuery({
    queryKey: ["chat-history", homeId],
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      const params = new URLSearchParams({ limit: "50" });
      if (pageParam != null) params.set("before_id", String(pageParam));
      const { data } = await apiClient.get<ChatMessage[]>(
        `/api/chat/${homeId}/messages?${params.toString()}`,
      );
      return data;
    },
    getNextPageParam: (lastPage: ChatMessage[]) =>
      lastPage.length === 50 ? lastPage[0]?.id : undefined,
    initialPageParam: undefined as number | undefined,
    staleTime: 0,
    enabled: !!homeId,
  });
};

export const useUploadChatImage = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await apiClient.post<ChatImageUploadResponse>(
        `/api/chat/${homeId}/images`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
  });
};
