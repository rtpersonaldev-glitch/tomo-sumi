export interface PostCommentResponse {
  id: number;
  post_id: number;
  user_id: number;
  comment: string;
  created_at: string;
}

export interface PostListResponse {
  id: number;
  home_id: number;
  content: string;
  picture_urls: string[];
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  created_at: string;
  created_by: number | null;
}

export interface PostDetailResponse {
  id: number;
  home_id: number;
  content: string;
  picture_urls: string[];
  like_count: number;
  is_liked: boolean;
  comments: PostCommentResponse[];
  tags: string[];
  created_at: string;
  created_by: number | null;
}

export interface PostLikeResponse {
  liked: boolean;
  like_count: number;
}
