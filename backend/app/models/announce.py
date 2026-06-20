from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Announce(Base, TimestampMixin):
    __tablename__ = "announces"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(String(300), nullable=False)
    priority: Mapped[str] = mapped_column(String(10), nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    likes: Mapped[list[AnnounceLike]] = relationship(
        "AnnounceLike", back_populates="announce", cascade="all, delete-orphan"
    )
    recipients: Mapped[list[AnnounceRecipient]] = relationship(
        "AnnounceRecipient", back_populates="announce", cascade="all, delete-orphan"
    )
    creator: Mapped[User | None] = relationship(
        "User",
        primaryjoin="foreign(Announce.created_by) == User.id",
        lazy="noload",
    )


class AnnounceLike(Base):
    __tablename__ = "announce_likes"

    id: Mapped[int] = mapped_column(primary_key=True)
    announce_id: Mapped[int] = mapped_column(ForeignKey("announces.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    announce: Mapped[Announce] = relationship("Announce", back_populates="likes")


class AnnounceRecipient(Base):
    __tablename__ = "announce_recipients"

    id: Mapped[int] = mapped_column(primary_key=True)
    announce_id: Mapped[int] = mapped_column(
        ForeignKey("announces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    announce: Mapped[Announce] = relationship("Announce", back_populates="recipients")
