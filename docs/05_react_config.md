# React構成

## 技術スタック

| 項目 | パッケージ | バージョン | 用途 |
|------|----------|----------|------|
| フレームワーク | `react` | ^18.3 | UIフレームワーク |
| 言語 | `typescript` | ^5.7 | 静的型付け |
| ビルドツール | `vite` | ^6.0 | 高速ビルド・HMR（CRA+Cracaから移行） |
| ルーティング | `react-router-dom` | ^6.28 | SPAルーティング |
| サーバー状態管理 | `@tanstack/react-query` | ^5.0 | APIデータキャッシュ・同期 |
| グローバル状態 | `zustand` | ^5.0 | 認証状態等のグローバル管理 |
| HTTPクライアント | `axios` | ^1.7 | API通信（インターセプター設定） |
| スタイリング | `tailwindcss` | ^3.4 | ユーティリティCSS（SCSSから移行） |
| UIコンポーネント | `shadcn/ui` | latest | アクセシブルなUIプリミティブ |
| アイコン | `lucide-react` | ^0.468 | アイコンセット |
| アニメーション | `framer-motion` | ^12.6 | アニメーション |
| カレンダー | `@fullcalendar/react` | ^6.1 | スケジュール表示 |
| グラフ | `recharts` | ^2.15 | 家計集計グラフ |
| リッチテキスト | `@tiptap/react` | ^2.9 | 投稿エディタ |
| 画像クロッパー | `react-cropper` | ^2.3 | 画像トリミング |
| Firebase | `firebase` | ^11.4 | FCMプッシュ通知 |
| 日付 | `date-fns` | ^4.1 | 日付操作 |
| 通知UI | `sonner` | ^1.7 | トースト通知 |
| フォーム | `react-hook-form` | ^7.54 | フォーム管理 |
| バリデーション | `zod` | ^3.24 | スキーマバリデーション |

---

## package.json

```json
{
  "name": "tomo-sumi-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.9",
    "react-hook-form": "^7.54.0",
    "zod": "^3.24.0",
    "@hookform/resolvers": "^3.9.0",
    "framer-motion": "^12.6.0",
    "@fullcalendar/react": "^6.1.15",
    "@fullcalendar/core": "^6.1.15",
    "@fullcalendar/daygrid": "^6.1.15",
    "recharts": "^2.15.1",
    "@tiptap/react": "^2.9.1",
    "@tiptap/starter-kit": "^2.9.1",
    "@tiptap/extension-placeholder": "^2.9.1",
    "@tiptap/extension-link": "^2.9.1",
    "react-cropper": "^2.3.3",
    "cropperjs": "^1.6.2",
    "firebase": "^11.4.0",
    "date-fns": "^4.1.0",
    "sonner": "^1.7.0",
    "lucide-react": "^0.468.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "prettier": "^3.3.3"
  }
}
```

---

## vite.config.ts

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL ?? "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: process.env.VITE_WS_BASE_URL ?? "ws://localhost:8000",
        ws: true,
      },
      "/media": {
        target: process.env.VITE_API_BASE_URL ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
```

---

## APIクライアント設定（src/lib/apiClient.ts）

> 401エラー時のトークンリフレッシュ処理を含む詳細は **[11_error_handling.md](11_error_handling.md)** を参照してください。

```typescript
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  withCredentials: true,  // HTTPonly Cookieを自動送信
  headers: {
    "Content-Type": "application/json",
  },
});

// 401時の自動トークンリフレッシュ（詳細: 11_error_handling.md）
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await apiClient.post("/api/auth/refresh");
        return apiClient(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
```

---

## グローバル状態管理（src/store/authStore.ts）

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: number;
  email: string;
  nickname: string;
  iconPath: string | null;
  status: "at_home" | "away";
  notificationFlag: boolean;
}

interface Home {
  id: number;
  name: string;
  homeImagePath: string | null;
}

interface HomeUser extends User {
  returnTime: string | null;
  lastActive: string;
}

interface AuthState {
  user: User | null;
  home: Home | null;
  homeUsers: HomeUser[];
  isUserLoggedIn: boolean;
  isHomeSelected: boolean;
  setUser: (user: User) => void;
  setHome: (home: Home, homeUsers: HomeUser[]) => void;
  clearAuth: () => void;
  clearHome: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      home: null,
      homeUsers: [],
      isUserLoggedIn: false,
      isHomeSelected: false,
      setUser: (user) => set({ user, isUserLoggedIn: true }),
      setHome: (home, homeUsers) => set({ home, homeUsers, isHomeSelected: true }),
      clearAuth: () => set({ user: null, home: null, homeUsers: [], isUserLoggedIn: false, isHomeSelected: false }),
      clearHome: () => set({ home: null, homeUsers: [], isHomeSelected: false }),
    }),
    {
      name: "tomo-auth",
      partialize: (state) => ({
        user: state.user,
        home: state.home,
        isUserLoggedIn: state.isUserLoggedIn,
        isHomeSelected: state.isHomeSelected,
      }),
    }
  )
);
```

---

## TanStack Query 設定（src/lib/queryClient.ts）

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,       // 1分間はキャッシュ有効
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});
```

---

## 機能フックのパターン（features/*/hooks/パターン）

```typescript
// src/features/announces/hooks/useAnnounces.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { useAuthStore } from "@/store/authStore";
import type { Announce, AnnounceCreateInput } from "../types";

const QUERY_KEY = "announces";

export const useAnnounces = () => {
  const homeId = useAuthStore((s) => s.home?.id);
  return useQuery({
    queryKey: [QUERY_KEY, homeId],
    queryFn: async () => {
      const { data } = await apiClient.get<Announce[]>(`/api/announces/${homeId}`);
      return data;
    },
    enabled: !!homeId,
  });
};

export const useCreateAnnounce = () => {
  const qc = useQueryClient();
  const homeId = useAuthStore((s) => s.home?.id);
  return useMutation({
    mutationFn: async (input: AnnounceCreateInput) => {
      const { data } = await apiClient.post<Announce>("/api/announces", input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, homeId] });
    },
  });
};
```

---

## ルーティング定義（src/App.tsx）

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "sonner";

import { AuthGuard } from "@/components/guards/AuthGuard";
import { HomeGuard } from "@/components/guards/HomeGuard";
import { AppLayout } from "@/components/layout/AppLayout";

// ページコンポーネント（遅延ロード）
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const SignupPage = lazy(() => import("@/features/auth/pages/SignupPage"));
const HomeSwitcherPage = lazy(() => import("@/features/home/pages/HomeSwitcherPage"));
const DashboardPage = lazy(() => import("@/features/home/pages/DashboardPage"));
// ... 他のページ

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            {/* パブリック */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sign-up" element={<SignupPage />} />

            {/* ユーザーログイン必須 */}
            <Route element={<AuthGuard />}>
              <Route path="/home-select" element={<HomeSwitcherPage />} />
              <Route path="/home-create" element={<HomeCreatePage />} />

              {/* ホーム選択必須 */}
              <Route element={<HomeGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<DashboardPage />} />
                  <Route path="/announces/*" element={<AnnounceRoutes />} />
                  <Route path="/albums/*" element={<AlbumRoutes />} />
                  <Route path="/todos/*" element={<TodoRoutes />} />
                  <Route path="/reminders/*" element={<ReminderRoutes />} />
                  <Route path="/posts/*" element={<PostRoutes />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/schedules/*" element={<ScheduleRoutes />} />
                  <Route path="/costs/*" element={<CostRoutes />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/settings/*" element={<SettingsRoutes />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
```

---

> **環境変数の全定義は [10_environment_variables.md](10_environment_variables.md) を参照してください。**  
> フロントエンドの環境変数はすべて `VITE_` プレフィックスで始まります。
