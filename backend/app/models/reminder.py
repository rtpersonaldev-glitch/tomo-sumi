from __future__ import annotations

from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Reminder(Base, TimestampMixin):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    list_name: Mapped[str] = mapped_column(String(50), nullable=False)
    complete_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    contents: Mapped[list[ReminderContent]] = relationship(
        "ReminderContent", back_populates="reminder"
    )


class ReminderContent(Base, TimestampMixin):
    __tablename__ = "reminder_contents"

    id: Mapped[int] = mapped_column(primary_key=True)
    reminder_id: Mapped[int] = mapped_column(ForeignKey("reminders.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    memo: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    time: Mapped[time | None] = mapped_column(Time, nullable=True)
    repeat: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    reminder: Mapped[Reminder] = relationship("Reminder", back_populates="contents")
