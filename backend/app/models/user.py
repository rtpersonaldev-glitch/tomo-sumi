from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    icon_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="away", nullable=False)
    notification_flag: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    return_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    selected_home_id: Mapped[int | None] = mapped_column(ForeignKey("homes.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    selected_home: Mapped["Home | None"] = relationship(
        "Home", foreign_keys=[selected_home_id]
    )
    home_links: Mapped[list["HomeLink"]] = relationship("HomeLink", back_populates="user")
    fcm_tokens: Mapped[list[FCMToken]] = relationship("FCMToken", back_populates="user")


class FCMToken(Base):
    __tablename__ = "fcm_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship("User", back_populates="fcm_tokens")
