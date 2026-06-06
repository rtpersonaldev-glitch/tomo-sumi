import type { User, Home, HomeUser } from "@/store/authStore";

export type { User, Home, HomeUser };

export interface MeResponse extends User {
  home: Home | null;
  homeUsers: HomeUser[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  nickname: string;
  email: string;
  password: string;
}
