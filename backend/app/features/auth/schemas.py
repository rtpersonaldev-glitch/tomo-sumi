from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator

from app.core.config import settings
from app.utils.file_storage import get_media_url


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("パスワードは8文字以上で入力してください")
        return v


class FCMTokenRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    nickname: str
    icon_url: str | None = None
    status: str
    notification_flag: bool
    return_time: datetime | None = None
    selected_home_id: int | None = None

    @model_validator(mode="before")
    @classmethod
    def _convert_icon_path(cls, data: Any) -> Any:
        if not isinstance(data, dict) and hasattr(data, "icon_path"):
            return {
                "id": data.id,
                "email": data.email,
                "nickname": data.nickname,
                "icon_url": get_media_url(data.icon_path, settings.MEDIA_BASE_URL),
                "status": data.status,
                "notification_flag": data.notification_flag,
                "return_time": getattr(data, "return_time", None),
                "selected_home_id": getattr(data, "selected_home_id", None),
            }
        return data


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


class MeResponse(BaseModel):
    user: UserResponse
    homes: list[HomeResponse]
    home: HomeResponse | None = None


class SettingsResponse(BaseModel):
    notification_flag: bool
