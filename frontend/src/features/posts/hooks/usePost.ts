import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type {
  PostCommentResponse,
  PostDetailResponse,
  PostLikeResponse,
  PostListResponse,
} from "../types";

export const usePosts = (enabled = true) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["posts", homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<PostListResponse[]>(`/api/posts/${homeId}`);
      return data;
    },
    enabled: enabled && !!homeId,
  });
};

export const usePost = (id: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data } = await apiClient.get<PostDetailResponse>(`/api/posts/${id}/detail`);
      return data;
    },
    enabled: enabled && !!id,
  });

export const useCreatePost = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ content, images }: { content: string; images: File[] }) => {
      const formData = new FormData();
      formData.append("content", content);
      images.forEach((img) => formData.append("images", img));
      const { data } = await apiClient.post<PostDetailResponse>("/api/posts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts", homeId] });
    },
  });
};

export const useUpdatePost = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const { data } = await apiClient.put<PostDetailResponse>(`/api/posts/${id}`, { content });
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["posts", homeId] });
      qc.invalidateQueries({ queryKey: ["post", id] });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/posts/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["post", id] });
      qc.invalidateQueries({ queryKey: ["posts", homeId] });
    },
  });
};

export const useToggleLike = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (postId: number) => {
      const { data } = await apiClient.post<PostLikeResponse>(`/api/posts/${postId}/like`);
      return data;
    },
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: ["posts", homeId] });
      await qc.cancelQueries({ queryKey: ["post", postId] });

      const previousList = qc.getQueryData<PostListResponse[]>(["posts", homeId]);
      const previousDetail = qc.getQueryData<PostDetailResponse>(["post", postId]);

      if (previousList) {
        qc.setQueryData<PostListResponse[]>(["posts", homeId], (old) =>
          old?.map((p) => {
            if (p.id !== postId) return p;
            const isLiked = !p.is_liked;
            return {
              ...p,
              is_liked: isLiked,
              like_count: isLiked ? p.like_count + 1 : p.like_count - 1,
            };
          }),
        );
      }
      if (previousDetail) {
        qc.setQueryData<PostDetailResponse>(["post", postId], (old) => {
          if (!old) return old;
          const isLiked = !old.is_liked;
          return {
            ...old,
            is_liked: isLiked,
            like_count: isLiked ? old.like_count + 1 : old.like_count - 1,
          };
        });
      }
      return { previousList, previousDetail };
    },
    onError: (_err, postId, context) => {
      if (context?.previousList) qc.setQueryData(["posts", homeId], context.previousList);
      if (context?.previousDetail) qc.setQueryData(["post", postId], context.previousDetail);
    },
    onSettled: (_data, _err, postId) => {
      qc.invalidateQueries({ queryKey: ["posts", homeId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
};

export const useAddComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, comment }: { postId: number; comment: string }) => {
      const { data } = await apiClient.post<PostCommentResponse>(
        `/api/posts/${postId}/comments`,
        { comment },
      );
      return data;
    },
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
};

export const useDeleteComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, commentId }: { postId: number; commentId: number }) => {
      await apiClient.delete(`/api/posts/${postId}/comments/${commentId}`);
      return { postId, commentId };
    },
    onSuccess: (_data, { postId }) => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });
};
