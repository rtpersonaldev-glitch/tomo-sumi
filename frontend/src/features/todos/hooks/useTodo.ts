import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { TodoBody, TodoResponse } from "../types";

interface ListParams {
  search?: string;
  ordering?: string;
}

export const useTodos = (params?: ListParams, enabled = true) => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: ["todos", homeId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<TodoResponse[]>(`/api/todos/${homeId}`, {
        params: params ?? {},
      });
      return data;
    },
    enabled: enabled && !!homeId,
  });
};

export const useTodo = (id: number | undefined, enabled = true) =>
  useQuery({
    queryKey: ["todo", id],
    queryFn: async () => {
      const { data } = await apiClient.get<TodoResponse>(`/api/todos/${id}/detail`);
      return data;
    },
    enabled: enabled && !!id,
  });

export const useCreateTodo = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (body: TodoBody) => {
      const { data } = await apiClient.post<TodoResponse>("/api/todos", body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["todos", homeId] });
    },
  });
};

export const useUpdateTodo = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: TodoBody }) => {
      const { data } = await apiClient.put<TodoResponse>(`/api/todos/${id}`, body);
      return data;
    },
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ["todo", id] });
      const previous = qc.getQueryData<TodoResponse>(["todo", id]);
      if (previous) {
        qc.setQueryData<TodoResponse>(["todo", id], {
          ...previous,
          title: body.title,
          complete_flag: body.complete_flag,
          contents: body.contents.map((c, i) => ({
            id: previous.contents[i]?.id ?? -(i + 1),
            todo_id: id,
            ...c,
          })),
        });
      }
      return { previous, id };
    },
    onSuccess: (data, { id }) => {
      qc.setQueryData(["todo", id], data);
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["todo", context.id], context.previous);
      }
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: ["todos", homeId] });
      qc.invalidateQueries({ queryKey: ["todo", id] });
    },
  });
};

export const useDeleteTodo = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/todos/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: ["todo", id] });
      qc.invalidateQueries({ queryKey: ["todos", homeId] });
    },
  });
};
