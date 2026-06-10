from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PostCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_id: int
    user_id: int
    comment: str
    created_at: datetime


class PostListResponse(BaseModel):
    id: int
    home_id: int
    content: str
    picture_urls: list[str]
    like_count: int
    comment_count: int
    is_liked: bool
    created_at: datetime
    created_by: int | None


class PostDetailResponse(BaseModel):
    id: int
    home_id: int
    content: str
    picture_urls: list[str]
    picture_ids: list[int]
    like_count: int
    is_liked: bool
    comments: list[PostCommentResponse]
    tags: list[str]
    created_at: datetime
    created_by: int | None


class PostUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)


class PostLikeResponse(BaseModel):
    liked: bool
    like_count: int


class PostCommentCreateRequest(BaseModel):
    comment: str = Field(..., min_length=1, max_length=100)
