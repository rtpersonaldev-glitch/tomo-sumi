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
const SchedulePage = lazy(() => import("@/features/schedules/pages/SchedulePage"));
const ScheduleDetailPage = lazy(() => import("@/features/schedules/pages/ScheduleDetailPage"));
const ScheduleEditPage = lazy(() => import("@/features/schedules/pages/ScheduleEditPage"));
const TodoListPage = lazy(() => import("@/features/todos/pages/TodoListPage"));
const TodoDetailPage = lazy(() => import("@/features/todos/pages/TodoDetailPage"));
const TodoEditPage = lazy(() => import("@/features/todos/pages/TodoEditPage"));
const ReminderListPage = lazy(() => import("@/features/reminders/pages/ReminderListPage"));
const ReminderGroupEditPage = lazy(() => import("@/features/reminders/pages/ReminderGroupEditPage"));
const ReminderContentEditPage = lazy(() => import("@/features/reminders/pages/ReminderContentEditPage"));
const PostListPage = lazy(() => import("@/features/posts/pages/PostListPage"));
const PostDetailPage = lazy(() => import("@/features/posts/pages/PostDetailPage"));
const PostEditPage = lazy(() => import("@/features/posts/pages/PostEditPage"));
const AlbumListPage = lazy(() => import("@/features/albums/pages/AlbumListPage"));
const AlbumDetailPage = lazy(() => import("@/features/albums/pages/AlbumDetailPage"));
const AlbumEditPage = lazy(() => import("@/features/albums/pages/AlbumEditPage"));

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
                  <Route path="/schedules" element={<SchedulePage />} />
                  <Route path="/schedules/new" element={<ScheduleEditPage />} />
                  <Route path="/schedules/:id" element={<ScheduleDetailPage />} />
                  <Route path="/schedules/:id/edit" element={<ScheduleEditPage />} />
                  <Route path="/todos" element={<TodoListPage />} />
                  <Route path="/todos/new" element={<TodoEditPage />} />
                  <Route path="/todos/:id" element={<TodoDetailPage />} />
                  <Route path="/todos/:id/edit" element={<TodoEditPage />} />
                  <Route path="/reminders" element={<ReminderListPage />} />
                  <Route path="/reminders/new" element={<ReminderGroupEditPage />} />
                  <Route path="/reminders/:id/edit" element={<ReminderGroupEditPage />} />
                  <Route path="/reminders/:id/contents/new" element={<ReminderContentEditPage />} />
                  <Route path="/reminders/contents/:contentId/edit" element={<ReminderContentEditPage />} />
                  <Route path="/posts" element={<PostListPage />} />
                  <Route path="/posts/new" element={<PostEditPage />} />
                  <Route path="/posts/:id" element={<PostDetailPage />} />
                  <Route path="/posts/:id/edit" element={<PostEditPage />} />
                  <Route path="/albums" element={<AlbumListPage />} />
                  <Route path="/albums/new" element={<AlbumEditPage />} />
                  <Route path="/albums/:id" element={<AlbumDetailPage />} />
                  <Route path="/albums/:id/edit" element={<AlbumEditPage />} />
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
