from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AnnounceBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
    content: str = Field(..., min_length=1, max_length=300)
    priority: Literal["high", "medium", "low"]
    end_date: date


class AnnounceCreateRequest(AnnounceBase):
    pass


class AnnounceUpdateRequest(AnnounceBase):
    pass


class AnnounceUserInfo(BaseModel):
    id: int
    nickname: str
    icon_url: str | None = None


class AnnounceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    home_id: int
    title: str
    content: str
    priority: str
    end_date: date
    like_count: int
    is_liked: bool
    created_at: datetime
    created_by_user: AnnounceUserInfo | None = None


class AnnounceLikeResponse(BaseModel):
    liked: bool
    like_count: int
