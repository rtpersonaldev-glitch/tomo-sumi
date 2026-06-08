from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Todo(Base, TimestampMixin):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    complete_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    contents: Mapped[list[TodoContent]] = relationship("TodoContent", back_populates="todo")


class TodoContent(Base, TimestampMixin):
    __tablename__ = "todo_contents"

    id: Mapped[int] = mapped_column(primary_key=True)
    todo_id: Mapped[int] = mapped_column(ForeignKey("todos.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(50), nullable=False)
    check_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    checked_by: Mapped[int | None] = mapped_column(nullable=True)

    todo: Mapped[Todo] = relationship("Todo", back_populates="contents")
