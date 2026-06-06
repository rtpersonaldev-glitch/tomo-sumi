from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


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


class ProfileUpdateRequest(BaseModel):
    nickname: str


class FCMTokenRequest(BaseModel):
    token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    nickname: str
    icon_path: str | None = None
    status: str
    notification_flag: bool
    return_time: datetime | None = None
    selected_home_id: int | None = None


class HomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    home_image_path: str | None = None


class MeResponse(BaseModel):
    user: UserResponse
    homes: list[HomeResponse]
    home: HomeResponse | None = None


class SettingsResponse(BaseModel):
    notification_flag: bool
