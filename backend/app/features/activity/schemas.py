from datetime import datetime

from pydantic import BaseModel


class ActivityLogResponse(BaseModel):
    id: int
    action: str
    target_model: str
    target_id: int | None = None
    user_id: int | None = None
    nickname: str | None = None
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int
