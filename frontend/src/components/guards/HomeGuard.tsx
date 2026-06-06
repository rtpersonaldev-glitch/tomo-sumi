import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

export function HomeGuard() {
  const isHomeSelected = useAuthStore((s) => s.isHomeSelected);
  if (!isHomeSelected) {
    return <Navigate to="/home-select" replace />;
  }
  return <Outlet />;
}
