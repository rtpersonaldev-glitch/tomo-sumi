from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ScheduleBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    memo: str = Field("", max_length=100)
    start_day: datetime
    end_day: datetime


class ScheduleCreateRequest(ScheduleBase):
    pass


class ScheduleUpdateRequest(ScheduleBase):
    pass


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    home_id: int
    title: str
    memo: str
    start_day: datetime
    end_day: datetime
    created_at: datetime
    created_by: int | None
