import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { LoginRequest, MeResponse, SignupRequest } from "@/features/auth/types";

const fetchMe = () => apiClient.get<MeResponse>("/api/auth/me").then((r) => r.data);

export const useLogin = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (body: LoginRequest) => {
      await apiClient.post("/api/auth/login", body);
      return fetchMe();
    },
    onSuccess: (data) => {
      setUser(data);
      navigate("/home-select");
    },
  });
};

export const useSignup = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (body: SignupRequest) => {
      await apiClient.post("/api/auth/register", body);
      await apiClient.post("/api/auth/login", { email: body.email, password: body.password });
      return fetchMe();
    },
    onSuccess: (data) => {
      setUser(data);
      navigate("/home-select");
    },
  });
};

export const useLogout = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => apiClient.post("/api/auth/logout"),
    onSuccess: () => {
      clearAuth();
      navigate("/login");
    },
  });
};

export const useSelectHome = () => {
  const setHome = useAuthStore((s) => s.setHome);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (homeId: number) => {
      await apiClient.post(`/api/auth/home-login/${homeId}`);
      return fetchMe();
    },
    onSuccess: (data) => {
      if (data.home) {
        setHome(data.home, data.homeUsers);
      }
      navigate("/home");
    },
  });
};
