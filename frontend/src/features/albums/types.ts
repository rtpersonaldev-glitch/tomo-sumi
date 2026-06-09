export interface AlbumPictureResponse {
  id: number;
  album_id: number;
  image_url: string;
}

export interface AlbumListResponse {
  id: number;
  home_id: number;
  title: string;
  thumbnail_url: string | null;
  picture_count: number;
  created_at: string;
}

export interface AlbumDetailResponse {
  id: number;
  home_id: number;
  title: string;
  pictures: AlbumPictureResponse[];
  created_at: string;
}
