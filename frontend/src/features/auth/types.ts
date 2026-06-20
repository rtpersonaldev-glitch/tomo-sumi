import type { User, Home, HomeUser } from "@/store/authStore";

export type { User, Home, HomeUser };

interface BackendHome {
  id: number;
  name: string;
  home_image_url: string | null;
}

export interface MeResponse {
  user: User;
  homes: BackendHome[];
  home: BackendHome | null;
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
