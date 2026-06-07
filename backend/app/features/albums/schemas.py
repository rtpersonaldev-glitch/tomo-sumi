from datetime import datetime

from pydantic import BaseModel, Field


class AlbumPictureResponse(BaseModel):
    id: int
    album_id: int
    image_url: str


class AlbumListResponse(BaseModel):
    id: int
    home_id: int
    title: str
    thumbnail_url: str | None
    picture_count: int
    created_at: datetime


class AlbumDetailResponse(BaseModel):
    id: int
    home_id: int
    title: str
    pictures: list[AlbumPictureResponse]
    created_at: datetime


class AlbumUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
