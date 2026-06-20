from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_home, get_current_user
from app.features.costs.schemas import (
    AutoSeisanResponse,
    AutoSeisanUpdateRequest,
    CostCategoryCreateRequest,
    CostCategoryResponse,
    CostResponse,
    CostSettingsResponse,
    CostSummaryResponse,
    KoteihiCreateRequest,
    KoteihiResponse,
    KoteihiUpdateRequest,
    SeisanCreateRequest,
    SeisanListResponse,
    SeisanMeisaiResponse,
    SeisanResponse,
)
from app.features.costs.service import CostService
from app.models.home import Home
from app.models.user import User

router = APIRouter()


# ─── 固定パス（パス競合を避けるため先に登録） ────────────────────────────────


@router.post("/seisan", response_model=SeisanResponse, status_code=201)
async def create_seisan(
    body: SeisanCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SeisanResponse:
    return await CostService(db).create_seisan(
        home_id=current_home.id,
        current_home_id=current_home.id,
        user_id=current_user.id,
        title=body.title,
        settled_date=body.settled_date,
    )


@router.get("/seisan/{seisan_id}", response_model=SeisanResponse)
async def get_seisan(
    seisan_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SeisanResponse:
    return await CostService(db).get_seisan(seisan_id, current_home.id)


@router.post("/seisan-meisai/{meisai_id}/complete", response_model=SeisanMeisaiResponse)
async def complete_meisai(
    meisai_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SeisanMeisaiResponse:
    return await CostService(db).complete_meisai(meisai_id, current_home.id, current_user.id)


@router.put("/koteihi/{koteihi_id}", response_model=KoteihiResponse)
async def update_koteihi(
    koteihi_id: int,
    body: KoteihiUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KoteihiResponse:
    return await CostService(db).update_koteihi(
        koteihi_id, current_home.id, current_user.id, body
    )


@router.delete("/koteihi/{koteihi_id}", status_code=204)
async def delete_koteihi(
    koteihi_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await CostService(db).delete_koteihi(koteihi_id, current_home.id, current_user.id)


# ─── Cost CRUD ───────────────────────────────────────────────────────────────


@router.post("", response_model=CostResponse, status_code=201)
async def create_cost(
    purchase_date: date = Form(...),
    amount: int = Form(...),
    category_id: int | None = Form(None),
    payer_user_id: int | None = Form(None),
    payment_method: str = Form(""),
    memo: str = Form(""),
    dish_count: int | None = Form(None),
    seikyusaki_json: str = Form(default="[]"),
    receipt_image: UploadFile | None = File(None),
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CostResponse:
    return await CostService(db).create_cost(
        home_id=current_home.id,
        user_id=current_user.id,
        purchase_date=purchase_date,
        amount=amount,
        category_id=category_id,
        payer_user_id=payer_user_id,
        payment_method=payment_method,
        memo=memo,
        dish_count=dish_count,
        seikyusaki_json=seikyusaki_json,
        receipt_image=receipt_image,
    )


@router.get("/{cost_id}/detail", response_model=CostResponse)
async def get_cost(
    cost_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CostResponse:
    return await CostService(db).get_cost(cost_id, current_home.id)


@router.put("/{cost_id}", response_model=CostResponse)
async def update_cost(
    cost_id: int,
    purchase_date: date = Form(...),
    amount: int = Form(...),
    category_id: int | None = Form(None),
    payer_user_id: int | None = Form(None),
    payment_method: str = Form(""),
    memo: str = Form(""),
    dish_count: int | None = Form(None),
    seikyusaki_json: str = Form(default="[]"),
    receipt_image: UploadFile | None = File(None),
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CostResponse:
    return await CostService(db).update_cost(
        cost_id=cost_id,
        home_id=current_home.id,
        user_id=current_user.id,
        purchase_date=purchase_date,
        amount=amount,
        category_id=category_id,
        payer_user_id=payer_user_id,
        payment_method=payment_method,
        memo=memo,
        dish_count=dish_count,
        seikyusaki_json=seikyusaki_json,
        receipt_image=receipt_image,
    )


@router.delete("/{cost_id}", status_code=204)
async def delete_cost(
    cost_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await CostService(db).delete_cost(cost_id, current_home.id, current_user.id)


# ─── ホームスコープ ────────────────────────────────────────────────────────────


@router.get("/{home_id}/categories", response_model=list[CostCategoryResponse])
async def list_categories(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CostCategoryResponse]:
    return await CostService(db).list_categories(home_id, current_home.id)


@router.post("/{home_id}/categories", response_model=CostCategoryResponse, status_code=201)
async def create_category(
    home_id: int,
    body: CostCategoryCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CostCategoryResponse:
    return await CostService(db).create_category(
        home_id, current_home.id, current_user.id, body.name
    )


@router.get("/{home_id}/summary", response_model=CostSummaryResponse)
async def get_summary(
    home_id: int,
    user: int | None = None,
    category: int | None = None,
    period: str | None = None,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CostSummaryResponse:
    return await CostService(db).get_summary(
        home_id=home_id,
        current_home_id=current_home.id,
        payer_user_id=user,
        category_id=category,
        period=period,
    )


@router.get("/{home_id}/settings", response_model=CostSettingsResponse)
async def get_settings(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CostSettingsResponse:
    return await CostService(db).get_settings(home_id, current_home.id)


@router.put("/{home_id}/settings/auto-seisan", response_model=AutoSeisanResponse)
async def update_auto_seisan(
    home_id: int,
    body: AutoSeisanUpdateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AutoSeisanResponse:
    return await CostService(db).update_auto_seisan(
        home_id, current_home.id, current_user.id, body
    )


@router.get("/{home_id}/koteihi", response_model=list[KoteihiResponse])
async def list_koteihi(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[KoteihiResponse]:
    return await CostService(db).list_koteihi(home_id, current_home.id)


@router.post("/{home_id}/koteihi", response_model=KoteihiResponse, status_code=201)
async def create_koteihi(
    home_id: int,
    body: KoteihiCreateRequest,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KoteihiResponse:
    return await CostService(db).create_koteihi(home_id, current_home.id, current_user.id, body)


@router.get("/{home_id}/seisan/pending", response_model=list[SeisanListResponse])
async def list_seisan_pending(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SeisanListResponse]:
    return await CostService(db).list_seisan(home_id, current_home.id, complete=False)


@router.get("/{home_id}/seisan/completed", response_model=list[SeisanListResponse])
async def list_seisan_completed(
    home_id: int,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SeisanListResponse]:
    return await CostService(db).list_seisan(home_id, current_home.id, complete=True)


@router.get("/{home_id}", response_model=list[CostResponse])
async def list_costs(
    home_id: int,
    category: int | None = None,
    user: int | None = None,
    method: str | None = None,
    current_home: Home = Depends(get_current_home),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CostResponse]:
    return await CostService(db).list_costs(
        home_id=home_id,
        current_home_id=current_home.id,
        category_id=category,
        payer_user_id=user,
        payment_method=method,
    )
