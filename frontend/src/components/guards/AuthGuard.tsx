import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export function AuthGuard() {
  const isUserLoggedIn = useAuthStore((s) => s.isUserLoggedIn);
  if (!isUserLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
