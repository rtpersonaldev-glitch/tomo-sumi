export interface ChatMessage {
  id: number;
  type: "message" | "image";
  message?: string | null;
  image_url?: string | null;
  user_id: number;
  nickname: string;
  icon_url: string | null;
  timestamp: string;
}

export interface ChatImageUploadResponse {
  image_path: string;
}
