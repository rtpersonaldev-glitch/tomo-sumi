import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: number;
  email: string;
  nickname: string;
  icon_url: string | null;
  status: "at_home" | "away";
  notification_flag: boolean;
}

export interface Home {
  id: number;
  name: string;
  homeImageUrl: string | null;
}

export interface HomeUser extends User {
  return_time: string | null;
  last_active: string;
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
      clearAuth: () =>
        set({ user: null, home: null, homeUsers: [], isUserLoggedIn: false, isHomeSelected: false }),
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
