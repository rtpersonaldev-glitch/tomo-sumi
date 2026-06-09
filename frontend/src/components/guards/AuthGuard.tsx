import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { MeResponse } from "@/features/auth/types";

export function AuthGuard() {
  const isUserLoggedIn = useAuthStore((s) => s.isUserLoggedIn);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  // 毎回APIで確認して最新ユーザーデータを取得する
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    apiClient
      .get<MeResponse>("/api/auth/me")
      .then(({ data }) => {
        setUser(data.user);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="認証確認中" />
      </div>
    );
  }

  if (!isUserLoggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}
