from datetime import date, datetime

from pydantic import BaseModel, Field

# ─── Category ────────────────────────────────────────────────────────────────


class CostCategoryResponse(BaseModel):
    id: int
    home_id: int
    name: str


class CostCategoryCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=30)


# ─── Seikyusaki ───────────────────────────────────────────────────────────────


class SeikyusakiResponse(BaseModel):
    id: int
    payer_user_id: int | None
    amount: int
    dish_count: int | None


# ─── Cost ────────────────────────────────────────────────────────────────────


class CostResponse(BaseModel):
    id: int
    home_id: int
    purchase_date: date
    category_id: int | None
    category_name: str | None
    amount: int
    payer_user_id: int | None
    payer_nickname: str | None
    payer_icon_url: str | None
    receipt_image_url: str | None
    payment_method: str
    memo: str
    dish_count: int | None
    seisan_id: int | None
    seikyusaki: list[SeikyusakiResponse]
    created_at: datetime


# ─── Summary ──────────────────────────────────────────────────────────────────


class SummaryUserAmount(BaseModel):
    user_id: int
    nickname: str
    amount: int


class SummaryCategoryAmount(BaseModel):
    category_id: int | None
    name: str
    amount: int


class CostSummaryResponse(BaseModel):
    total_amount: int
    by_user: list[SummaryUserAmount]
    by_category: list[SummaryCategoryAmount]


# ─── AutoSeisan Settings ──────────────────────────────────────────────────────


class AutoSeisanResponse(BaseModel):
    id: int
    home_id: int
    execute_flag: bool
    seisan_day: int


class AutoSeisanUpdateRequest(BaseModel):
    execute_flag: bool
    seisan_day: int = Field(..., ge=1, le=31)


class CostSettingsResponse(BaseModel):
    auto_seisan: AutoSeisanResponse | None


# ─── Koteihi ─────────────────────────────────────────────────────────────────


class KoteihiResponse(BaseModel):
    id: int
    home_id: int
    category_id: int | None
    amount: int
    from_user_id: int | None
    to_user_id: int | None
    memo: str


class KoteihiCreateRequest(BaseModel):
    category_id: int | None = None
    amount: int = Field(..., gt=0)
    from_user_id: int | None = None
    to_user_id: int | None = None
    memo: str = ""


class KoteihiUpdateRequest(BaseModel):
    category_id: int | None = None
    amount: int = Field(..., gt=0)
    from_user_id: int | None = None
    to_user_id: int | None = None
    memo: str = ""


# ─── SeisanMeisai ─────────────────────────────────────────────────────────────


class SeisanMeisaiResponse(BaseModel):
    id: int
    seisan_id: int
    from_user_id: int | None
    from_nickname: str | None
    to_user_id: int | None
    to_nickname: str | None
    amount: int
    complete_flag: bool


# ─── Seisan ───────────────────────────────────────────────────────────────────


class SeisanListResponse(BaseModel):
    id: int
    home_id: int
    title: str
    complete_flag: bool
    settled_date: date
    created_at: datetime


class SeisanResponse(BaseModel):
    id: int
    home_id: int
    title: str
    complete_flag: bool
    settled_date: date
    meisai: list[SeisanMeisaiResponse]
    created_at: datetime


class SeisanCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=50)
    settled_date: date
