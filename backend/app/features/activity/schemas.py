from datetime import datetime

from pydantic import BaseModel


class ActivityLogResponse(BaseModel):
    id: int
    action: str
    target_type: str
    target_id: int | None = None
    target_label: str | None = None
    user_id: int | None = None
    nickname: str | None = None
    icon_url: str | None = None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int
