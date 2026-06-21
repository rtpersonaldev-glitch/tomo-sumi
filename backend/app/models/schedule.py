from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Schedule(Base, TimestampMixin):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    memo: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    start_day: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_day: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    creator: Mapped[User | None] = relationship(
        "User",
        primaryjoin="foreign(Schedule.created_by) == User.id",
        lazy="noload",
    )
