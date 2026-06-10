from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.config import settings
from app.utils.file_storage import get_media_url


class HomeCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)


class HomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    home_image_url: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _convert_image_path(cls, data: Any) -> Any:
        if not isinstance(data, dict) and hasattr(data, "home_image_path"):
            return {
                "id": data.id,
                "name": data.name,
                "home_image_url": get_media_url(data.home_image_path, settings.MEDIA_BASE_URL),
            }
        return data


class HomeMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nickname: str
    status: str
    icon_url: str | None = None
    return_time: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def _convert_icon_path(cls, data: Any) -> Any:
        if not isinstance(data, dict) and hasattr(data, "icon_path"):
            return {
                "id": data.id,
                "nickname": data.nickname,
                "status": data.status,
                "icon_url": get_media_url(data.icon_path, settings.MEDIA_BASE_URL),
                "return_time": getattr(data, "return_time", None),
            }
        return data


class InvitationCodeResponse(BaseModel):
    code: str
    expires_at: datetime


class DashboardScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    start_day: datetime
    end_day: datetime


class DashboardResponse(BaseModel):
    members: list[HomeMemberResponse]
    today_schedules: list[DashboardScheduleResponse]
    unread_announce_count: int
