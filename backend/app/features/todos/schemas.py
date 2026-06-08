from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TodoContentRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=50)
    check_flag: bool = False
    checked_by: int | None = None


class TodoContentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    todo_id: int
    content: str
    check_flag: bool
    checked_by: int | None


class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
    complete_flag: bool = False


class TodoCreateRequest(TodoBase):
    contents: list[TodoContentRequest] = []


class TodoUpdateRequest(TodoBase):
    contents: list[TodoContentRequest] = []


class TodoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    home_id: int
    title: str
    complete_flag: bool
    contents: list[TodoContentResponse]
    created_at: datetime
    created_by: int | None
