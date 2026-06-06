import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { MeResponse } from "@/features/auth/types";

export function AuthGuard() {
  const isUserLoggedIn = useAuthStore((s) => s.isUserLoggedIn);
  const setUser = useAuthStore((s) => s.setUser);
  // ストアが false のときのみ ME を叩いて復元を試みる
  const [checking, setChecking] = useState(!isUserLoggedIn);

  useEffect(() => {
    if (isUserLoggedIn) {
      setChecking(false);
      return;
    }
    apiClient
      .get<MeResponse>("/api/auth/me")
      .then(({ data }) => {
        setUser(data);
      })
      .catch(() => {
        // Cookie 無効 → ログイン画面へ（checking=false になり Navigate がレンダーされる）
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
