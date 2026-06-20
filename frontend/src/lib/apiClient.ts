import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

type QueueEntry = {
  resolve: () => void;
  reject: (err: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

function processQueue(error: unknown): void {
  failedQueue.forEach((entry) => {
    if (error) entry.reject(error);
    else entry.resolve();
  });
  failedQueue = [];
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail: string | Array<{ msg: string }> }>) => {
    const config = error.config as RetryableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retry) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(config));
      }

      config._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post("/api/auth/refresh");
        processQueue(null);
        return apiClient(config);
      } catch (refreshError) {
        processQueue(refreshError);
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
