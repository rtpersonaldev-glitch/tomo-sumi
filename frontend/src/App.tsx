import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { queryClient } from "@/lib/queryClient";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { HomeGuard } from "@/components/guards/HomeGuard";
import { AppLayout } from "@/components/layout/AppLayout";

const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const SignupPage = lazy(() => import("@/features/auth/pages/SignupPage"));
const HomeSwitcherPage = lazy(() => import("@/features/home/pages/HomeSwitcherPage"));
const HomeCreatePage = lazy(() => import("@/features/home/pages/HomeCreatePage"));
const JoinHomePage = lazy(() => import("@/features/home/pages/JoinHomePage"));
const DashboardPage = lazy(() => import("@/features/home/pages/DashboardPage"));
const HomeSettingsPage = lazy(() => import("@/features/home/pages/HomeSettingsPage"));
const AnnounceListPage = lazy(() => import("@/features/announces/pages/AnnounceListPage"));
const AnnounceDetailPage = lazy(() => import("@/features/announces/pages/AnnounceDetailPage"));
const AnnounceEditPage = lazy(() => import("@/features/announces/pages/AnnounceEditPage"));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">Loading...</div>
          }
        >
          <Routes>
            {/* パブリック */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sign-up" element={<SignupPage />} />

            {/* ユーザーログイン必須 */}
            <Route element={<AuthGuard />}>
              <Route path="/home-select" element={<HomeSwitcherPage />} />
              <Route path="/home-create" element={<HomeCreatePage />} />
              <Route path="/join-home" element={<JoinHomePage />} />

              {/* ホーム選択必須 */}
              <Route element={<HomeGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<DashboardPage />} />
                  <Route path="/settings/home" element={<HomeSettingsPage />} />
                  <Route path="/announces" element={<AnnounceListPage />} />
                  <Route path="/announces/new" element={<AnnounceEditPage />} />
                  <Route path="/announces/:id" element={<AnnounceDetailPage />} />
                  <Route path="/announces/:id/edit" element={<AnnounceEditPage />} />
                </Route>
              </Route>
            </Route>

            {/* フォールバック */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
