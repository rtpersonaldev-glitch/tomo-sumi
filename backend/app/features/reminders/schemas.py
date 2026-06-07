import datetime as dt
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReminderBase(BaseModel):
    list_name: str = Field(..., min_length=1, max_length=50)
    complete_flag: bool = False


class ReminderCreateRequest(ReminderBase):
    pass


class ReminderUpdateRequest(ReminderBase):
    pass


class ReminderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    home_id: int
    list_name: str
    complete_flag: bool
    created_at: datetime


class ReminderContentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
    memo: str = Field("", max_length=100)
    date: dt.date | None = None
    time: dt.time | None = None
    repeat: str | None = Field(None, max_length=10)


class ReminderContentCreateRequest(ReminderContentBase):
    pass


class ReminderContentUpdateRequest(ReminderContentBase):
    is_active: bool = False


class ReminderContentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reminder_id: int
    title: str
    memo: str
    date: dt.date | None
    time: dt.time | None
    repeat: str | None
    is_active: bool
