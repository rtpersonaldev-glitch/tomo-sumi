import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { HomeUser } from "@/store/authStore";
import type { LoginRequest, MeResponse, SignupRequest } from "@/features/auth/types";
import type { HomeMemberResponse } from "@/features/home/types";

const fetchMe = () => apiClient.get<MeResponse>("/api/auth/me").then((r) => r.data);

const fetchHomeMembers = (homeId: number) =>
  apiClient.get<HomeMemberResponse[]>(`/api/homes/${homeId}/users`).then((r) => r.data);

const toHomeUser = (m: HomeMemberResponse): HomeUser => ({
  id: m.id,
  email: "",
  nickname: m.nickname,
  icon_url: m.icon_url,
  status: m.status,
  notification_flag: false,
  return_time: m.return_time,
  last_active: "",
});

export const useLogin = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (body: LoginRequest) => {
      await apiClient.post("/api/auth/login", body);
      return fetchMe();
    },
    onSuccess: (data) => {
      setUser(data.user);
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
      setUser(data.user);
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
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (homeId: number) => {
      await apiClient.post(`/api/auth/home-login/${homeId}`);
      const [me, members] = await Promise.all([fetchMe(), fetchHomeMembers(homeId)]);
      return { me, members };
    },
    onSuccess: ({ me, members }) => {
      setUser(me.user);
      if (me.home) {
        setHome(
          { id: me.home.id, name: me.home.name, homeImagePath: me.home.home_image_path },
          members.map(toHomeUser),
        );
      }
      navigate("/home");
    },
  });
};
