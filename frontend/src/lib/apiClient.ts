import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export const apiClient = axios.create({
  baseURL: "",
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
      config._retry = true;
      try {
        await apiClient.post("/api/auth/refresh");
        return apiClient(config);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
