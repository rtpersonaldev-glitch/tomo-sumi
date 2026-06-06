from __future__ import annotations

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CostCategory(Base, TimestampMixin):
    __tablename__ = "cost_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(30), nullable=False)


class Cost(Base, TimestampMixin):
    __tablename__ = "costs"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, index=True)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("cost_categories.id"), nullable=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    payer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    receipt_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    memo: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    dish_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seisan_id: Mapped[int | None] = mapped_column(ForeignKey("seisans.id"), nullable=True)


class Seisan(Base, TimestampMixin):
    __tablename__ = "seisans"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    complete_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    settled_date: Mapped[date] = mapped_column(Date, nullable=False)


class SeisanMeisai(Base, TimestampMixin):
    __tablename__ = "seisan_meisai"

    id: Mapped[int] = mapped_column(primary_key=True)
    seisan_id: Mapped[int] = mapped_column(ForeignKey("seisans.id"), nullable=False)
    from_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    complete_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Seikyusaki(Base, TimestampMixin):
    __tablename__ = "seikyusaki"

    id: Mapped[int] = mapped_column(primary_key=True)
    cost_id: Mapped[int] = mapped_column(ForeignKey("costs.id"), nullable=False)
    payer_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    dish_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)


class AutoSeisan(Base, TimestampMixin):
    __tablename__ = "auto_seisans"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False, unique=True)
    execute_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    seisan_day: Mapped[int] = mapped_column(Integer, nullable=False)


class Koteihi(Base, TimestampMixin):
    __tablename__ = "koteihi"

    id: Mapped[int] = mapped_column(primary_key=True)
    home_id: Mapped[int] = mapped_column(ForeignKey("homes.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("cost_categories.id"), nullable=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    from_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    memo: Mapped[str] = mapped_column(String(100), nullable=False, default="")
