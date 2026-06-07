from datetime import datetime

from pydantic import BaseModel


class ChatMessageResponse(BaseModel):
    id: int
    type: str
    message: str | None
    image_url: str | None
    user_id: int
    nickname: str
    icon_url: str | None
    timestamp: datetime


class ChatImageUploadResponse(BaseModel):
    image_path: str
