from datetime import date

from fastapi import HTTPException, UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.costs.schemas import (
    AutoSeisanResponse,
    AutoSeisanUpdateRequest,
    CostCategoryResponse,
    CostResponse,
    CostSettingsResponse,
    CostSummaryResponse,
    KoteihiCreateRequest,
    KoteihiResponse,
    KoteihiUpdateRequest,
    SeikyusakiResponse,
    SeisanListResponse,
    SeisanMeisaiResponse,
    SeisanResponse,
    SummaryCategoryAmount,
    SummaryUserAmount,
)
from app.features.costs.seisan_calculator import CostEntry, build_balances, calculate_settlements
from app.models.cost import (
    AutoSeisan,
    Cost,
    CostCategory,
    Koteihi,
    Seikyusaki,
    Seisan,
    SeisanMeisai,
)
from app.models.home import HomeLink
from app.models.user import User
from app.utils.activity_logger import log_activity
from app.utils.file_storage import delete_image, get_media_url, save_image


class CostService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ─── Helpers ─────────────────────────────────────────────────────────────

    async def _get_home_members(self, home_id: int) -> list[User]:
        result = await self.db.execute(
            select(User)
            .join(HomeLink, HomeLink.user_id == User.id)
            .where(HomeLink.home_id == home_id, HomeLink.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def _get_cost_or_403(self, cost_id: int, home_id: int) -> Cost:
        cost = await self.db.get(Cost, cost_id)
        if not cost:
            raise HTTPException(status_code=404, detail="支出が見つかりません")
        if cost.home_id != home_id:
            raise HTTPException(status_code=403, detail="この支出へのアクセス権限がありません")
        return cost

    async def _get_seikyusaki(self, cost_id: int) -> list[Seikyusaki]:
        result = await self.db.execute(
            select(Seikyusaki).where(Seikyusaki.cost_id == cost_id)
        )
        return list(result.scalars().all())

    async def _build_cost_response(self, cost: Cost) -> CostResponse:
        category_name: str | None = None
        if cost.category_id:
            cat = await self.db.get(CostCategory, cost.category_id)
            category_name = cat.name if cat else None

        payer_nickname: str | None = None
        payer_icon_url: str | None = None
        if cost.payer_user_id:
            payer = await self.db.get(User, cost.payer_user_id)
            payer_nickname = payer.nickname if payer else None
            payer_icon_url = get_media_url(payer.icon_path, settings.MEDIA_BASE_URL) if payer else None

        seikyusaki_list = await self._get_seikyusaki(cost.id)

        return CostResponse(
            id=cost.id,
            home_id=cost.home_id,
            purchase_date=cost.purchase_date,
            category_id=cost.category_id,
            category_name=category_name,
            amount=cost.amount,
            payer_user_id=cost.payer_user_id,
            payer_nickname=payer_nickname,
            payer_icon_url=payer_icon_url,
            receipt_image_url=get_media_url(cost.receipt_image_path, settings.MEDIA_BASE_URL),
            payment_method=cost.payment_method,
            memo=cost.memo,
            dish_count=cost.dish_count,
            seisan_id=cost.seisan_id,
            seikyusaki=[
                SeikyusakiResponse(
                    id=s.id,
                    payer_user_id=s.payer_user_id,
                    amount=s.amount,
                    dish_count=s.dish_count,
                )
                for s in seikyusaki_list
            ],
            created_at=cost.created_at,
        )

    async def _build_seisan_response(self, seisan: Seisan) -> SeisanResponse:
        meisai_result = await self.db.execute(
            select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
        )
        meisai_list = list(meisai_result.scalars().all())

        meisai_responses = []
        for m in meisai_list:
            from_user = await self.db.get(User, m.from_user_id) if m.from_user_id else None
            to_user = await self.db.get(User, m.to_user_id) if m.to_user_id else None
            meisai_responses.append(
                SeisanMeisaiResponse(
                    id=m.id,
                    seisan_id=m.seisan_id,
                    from_user_id=m.from_user_id,
                    from_nickname=from_user.nickname if from_user else None,
                    to_user_id=m.to_user_id,
                    to_nickname=to_user.nickname if to_user else None,
                    amount=m.amount,
                    complete_flag=m.complete_flag,
                )
            )

        return SeisanResponse(
            id=seisan.id,
            home_id=seisan.home_id,
            title=seisan.title,
            complete_flag=seisan.complete_flag,
            settled_date=seisan.settled_date,
            meisai=meisai_responses,
            created_at=seisan.created_at,
        )

    # ─── Category ────────────────────────────────────────────────────────────

    async def list_categories(
        self, home_id: int, current_home_id: int
    ) -> list[CostCategoryResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(CostCategory)
            .where(CostCategory.home_id == home_id)
            .order_by(CostCategory.name)
        )
        cats = result.scalars().all()
        return [CostCategoryResponse(id=c.id, home_id=c.home_id, name=c.name) for c in cats]

    async def create_category(
        self, home_id: int, current_home_id: int, user_id: int, name: str
    ) -> CostCategoryResponse:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ操作できます")
        cat = CostCategory(home_id=home_id, name=name, created_by=user_id)
        self.db.add(cat)
        await self.db.flush()
        return CostCategoryResponse(id=cat.id, home_id=cat.home_id, name=cat.name)

    # ─── Cost CRUD ───────────────────────────────────────────────────────────

    async def list_costs(
        self,
        home_id: int,
        current_home_id: int,
        category_id: int | None = None,
        payer_user_id: int | None = None,
        payment_method: str | None = None,
    ) -> list[CostResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")

        query = (
            select(Cost)
            .where(Cost.home_id == home_id, Cost.seisan_id.is_(None))
            .order_by(desc(Cost.purchase_date), desc(Cost.id))
        )
        if category_id is not None:
            query = query.where(Cost.category_id == category_id)
        if payer_user_id is not None:
            query = query.where(Cost.payer_user_id == payer_user_id)
        if payment_method:
            query = query.where(Cost.payment_method == payment_method)

        result = await self.db.execute(query)
        costs = list(result.scalars().all())
        return [await self._build_cost_response(c) for c in costs]

    async def create_cost(
        self,
        home_id: int,
        user_id: int,
        purchase_date: date,
        amount: int,
        category_id: int | None,
        payer_user_id: int | None,
        payment_method: str,
        memo: str,
        dish_count: int | None,
        receipt_image: UploadFile | None,
    ) -> CostResponse:
        receipt_path: str | None = None
        if receipt_image and receipt_image.filename:
            receipt_path = await save_image(receipt_image, directory="receipts", max_mb=10)

        cost = Cost(
            home_id=home_id,
            purchase_date=purchase_date,
            amount=amount,
            category_id=category_id,
            payer_user_id=payer_user_id,
            payment_method=payment_method,
            memo=memo,
            dish_count=dish_count,
            receipt_image_path=receipt_path,
            created_by=user_id,
        )
        self.db.add(cost)
        await self.db.flush()
        await log_activity(self.db, home_id, user_id, "支出を追加しました", "cost", cost.id)
        return await self._build_cost_response(cost)

    async def get_cost(self, cost_id: int, home_id: int) -> CostResponse:
        cost = await self._get_cost_or_403(cost_id, home_id)
        return await self._build_cost_response(cost)

    async def update_cost(
        self,
        cost_id: int,
        home_id: int,
        user_id: int,
        purchase_date: date,
        amount: int,
        category_id: int | None,
        payer_user_id: int | None,
        payment_method: str,
        memo: str,
        dish_count: int | None,
        receipt_image: UploadFile | None,
    ) -> CostResponse:
        cost = await self._get_cost_or_403(cost_id, home_id)

        if receipt_image and receipt_image.filename:
            if cost.receipt_image_path:
                delete_image(cost.receipt_image_path)
            cost.receipt_image_path = await save_image(
                receipt_image, directory="receipts", max_mb=10
            )

        cost.purchase_date = purchase_date
        cost.amount = amount
        cost.category_id = category_id
        cost.payer_user_id = payer_user_id
        cost.payment_method = payment_method
        cost.memo = memo
        cost.dish_count = dish_count
        cost.updated_by = user_id

        await self.db.flush()
        return await self._build_cost_response(cost)

    async def delete_cost(self, cost_id: int, home_id: int, user_id: int) -> None:
        cost = await self._get_cost_or_403(cost_id, home_id)
        if cost.receipt_image_path:
            delete_image(cost.receipt_image_path)

        seikyusaki_list = await self._get_seikyusaki(cost.id)
        for s in seikyusaki_list:
            await self.db.delete(s)

        await self.db.flush()
        await self.db.delete(cost)
        await log_activity(self.db, home_id, user_id, "支出を削除しました", "cost", cost_id)
        await self.db.flush()

    # ─── Summary ─────────────────────────────────────────────────────────────

    async def get_summary(
        self,
        home_id: int,
        current_home_id: int,
        payer_user_id: int | None = None,
        category_id: int | None = None,
        period: str | None = None,
    ) -> CostSummaryResponse:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")

        query = select(Cost).where(Cost.home_id == home_id)
        if payer_user_id is not None:
            query = query.where(Cost.payer_user_id == payer_user_id)
        if category_id is not None:
            query = query.where(Cost.category_id == category_id)
        if period:
            try:
                year, month = int(period[:4]), int(period[5:7])
                from calendar import monthrange
                last_day = monthrange(year, month)[1]
                from datetime import date as dt_date
                query = query.where(
                    Cost.purchase_date >= dt_date(year, month, 1),
                    Cost.purchase_date <= dt_date(year, month, last_day),
                )
            except (ValueError, IndexError):
                pass

        result = await self.db.execute(query)
        costs = list(result.scalars().all())

        total = sum(c.amount for c in costs)

        by_user: dict[int, int] = {}
        for c in costs:
            if c.payer_user_id:
                by_user[c.payer_user_id] = by_user.get(c.payer_user_id, 0) + c.amount

        by_cat: dict[int | None, int] = {}
        for c in costs:
            by_cat[c.category_id] = by_cat.get(c.category_id, 0) + c.amount

        user_summaries = []
        for uid, amt in by_user.items():
            user = await self.db.get(User, uid)
            user_summaries.append(
                SummaryUserAmount(user_id=uid, nickname=user.nickname if user else "", amount=amt)
            )

        cat_summaries = []
        for cid, amt in by_cat.items():
            if cid:
                cat = await self.db.get(CostCategory, cid)
                name = cat.name if cat else "不明"
            else:
                name = "未分類"
            cat_summaries.append(SummaryCategoryAmount(category_id=cid, name=name, amount=amt))

        return CostSummaryResponse(
            total_amount=total,
            by_user=user_summaries,
            by_category=cat_summaries,
        )

    # ─── Settings ────────────────────────────────────────────────────────────

    async def get_settings(self, home_id: int, current_home_id: int) -> CostSettingsResponse:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(AutoSeisan).where(AutoSeisan.home_id == home_id)
        )
        auto = result.scalar_one_or_none()
        auto_resp = (
            AutoSeisanResponse(
                id=auto.id,
                home_id=auto.home_id,
                execute_flag=auto.execute_flag,
                seisan_day=auto.seisan_day,
            )
            if auto
            else None
        )
        return CostSettingsResponse(auto_seisan=auto_resp)

    async def update_auto_seisan(
        self, home_id: int, current_home_id: int, user_id: int, data: AutoSeisanUpdateRequest
    ) -> AutoSeisanResponse:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ操作できます")
        result = await self.db.execute(
            select(AutoSeisan).where(AutoSeisan.home_id == home_id)
        )
        auto = result.scalar_one_or_none()

        if auto:
            auto.execute_flag = data.execute_flag
            auto.seisan_day = data.seisan_day
            auto.updated_by = user_id
        else:
            auto = AutoSeisan(
                home_id=home_id,
                execute_flag=data.execute_flag,
                seisan_day=data.seisan_day,
                created_by=user_id,
            )
            self.db.add(auto)

        await self.db.flush()
        await self.db.refresh(auto)
        return AutoSeisanResponse(
            id=auto.id,
            home_id=auto.home_id,
            execute_flag=auto.execute_flag,
            seisan_day=auto.seisan_day,
        )

    # ─── Koteihi ─────────────────────────────────────────────────────────────

    async def list_koteihi(self, home_id: int, current_home_id: int) -> list[KoteihiResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(Koteihi).where(Koteihi.home_id == home_id).order_by(Koteihi.id)
        )
        items = result.scalars().all()
        return [
            KoteihiResponse(
                id=k.id,
                home_id=k.home_id,
                category_id=k.category_id,
                amount=k.amount,
                from_user_id=k.from_user_id,
                to_user_id=k.to_user_id,
                memo=k.memo,
            )
            for k in items
        ]

    async def create_koteihi(
        self, home_id: int, current_home_id: int, user_id: int, data: KoteihiCreateRequest
    ) -> KoteihiResponse:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ操作できます")
        k = Koteihi(
            home_id=home_id,
            category_id=data.category_id,
            amount=data.amount,
            from_user_id=data.from_user_id,
            to_user_id=data.to_user_id,
            memo=data.memo,
            created_by=user_id,
        )
        self.db.add(k)
        await self.db.flush()
        return KoteihiResponse(
            id=k.id,
            home_id=k.home_id,
            category_id=k.category_id,
            amount=k.amount,
            from_user_id=k.from_user_id,
            to_user_id=k.to_user_id,
            memo=k.memo,
        )

    async def update_koteihi(
        self, koteihi_id: int, home_id: int, user_id: int, data: KoteihiUpdateRequest
    ) -> KoteihiResponse:
        k = await self.db.get(Koteihi, koteihi_id)
        if not k:
            raise HTTPException(status_code=404, detail="固定費が見つかりません")
        if k.home_id != home_id:
            raise HTTPException(status_code=403, detail="この固定費へのアクセス権限がありません")
        k.category_id = data.category_id
        k.amount = data.amount
        k.from_user_id = data.from_user_id
        k.to_user_id = data.to_user_id
        k.memo = data.memo
        k.updated_by = user_id
        await self.db.flush()
        return KoteihiResponse(
            id=k.id,
            home_id=k.home_id,
            category_id=k.category_id,
            amount=k.amount,
            from_user_id=k.from_user_id,
            to_user_id=k.to_user_id,
            memo=k.memo,
        )

    async def delete_koteihi(self, koteihi_id: int, home_id: int, user_id: int) -> None:
        k = await self.db.get(Koteihi, koteihi_id)
        if not k:
            raise HTTPException(status_code=404, detail="固定費が見つかりません")
        if k.home_id != home_id:
            raise HTTPException(status_code=403, detail="この固定費へのアクセス権限がありません")
        await self.db.delete(k)
        await self.db.flush()

    # ─── Seisan ──────────────────────────────────────────────────────────────

    async def create_seisan(
        self,
        home_id: int,
        current_home_id: int,
        user_id: int,
        title: str,
        settled_date: date,
    ) -> SeisanResponse:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ操作できます")

        members = await self._get_home_members(home_id)
        member_ids = [m.id for m in members]

        costs_result = await self.db.execute(
            select(Cost).where(Cost.home_id == home_id, Cost.seisan_id.is_(None))
        )
        unsettled_costs = list(costs_result.scalars().all())

        entries: list[CostEntry] = []
        for cost in unsettled_costs:
            if not cost.payer_user_id:
                continue
            seikyusaki_list = await self._get_seikyusaki(cost.id)
            sei_pairs = [
                (s.payer_user_id, s.amount)
                for s in seikyusaki_list
                if s.payer_user_id is not None
            ]
            entries.append(
                CostEntry(
                    payer_user_id=cost.payer_user_id,
                    total_amount=cost.amount,
                    seikyusaki=sei_pairs,
                )
            )

        balances = build_balances(entries, member_ids)
        transfers = calculate_settlements(balances)

        seisan = Seisan(
            home_id=home_id,
            title=title,
            complete_flag=False,
            settled_date=settled_date,
            created_by=user_id,
        )
        self.db.add(seisan)
        await self.db.flush()

        for from_uid, to_uid, amount in transfers:
            self.db.add(
                SeisanMeisai(
                    seisan_id=seisan.id,
                    from_user_id=from_uid,
                    to_user_id=to_uid,
                    amount=amount,
                    complete_flag=False,
                    created_by=user_id,
                )
            )

        for cost in unsettled_costs:
            cost.seisan_id = seisan.id

        await self.db.flush()
        await self.db.refresh(seisan)
        await log_activity(self.db, home_id, user_id, "清算を作成しました", "seisan", seisan.id)
        return await self._build_seisan_response(seisan)

    async def list_seisan(
        self, home_id: int, current_home_id: int, complete: bool
    ) -> list[SeisanListResponse]:
        if home_id != current_home_id:
            raise HTTPException(status_code=403, detail="現在選択中のホームのみ参照できます")
        result = await self.db.execute(
            select(Seisan)
            .where(Seisan.home_id == home_id, Seisan.complete_flag == complete)
            .order_by(desc(Seisan.settled_date), desc(Seisan.id))
        )
        items = result.scalars().all()
        return [
            SeisanListResponse(
                id=s.id,
                home_id=s.home_id,
                title=s.title,
                complete_flag=s.complete_flag,
                settled_date=s.settled_date,
                created_at=s.created_at,
            )
            for s in items
        ]

    async def get_seisan(self, seisan_id: int, home_id: int) -> SeisanResponse:
        seisan = await self.db.get(Seisan, seisan_id)
        if not seisan:
            raise HTTPException(status_code=404, detail="清算が見つかりません")
        if seisan.home_id != home_id:
            raise HTTPException(status_code=403, detail="この清算へのアクセス権限がありません")
        return await self._build_seisan_response(seisan)

    # ─── SeisanMeisai ─────────────────────────────────────────────────────────

    async def complete_meisai(
        self, meisai_id: int, home_id: int, user_id: int
    ) -> SeisanMeisaiResponse:
        m = await self.db.get(SeisanMeisai, meisai_id)
        if not m:
            raise HTTPException(status_code=404, detail="清算明細が見つかりません")

        seisan = await self.db.get(Seisan, m.seisan_id)
        if not seisan or seisan.home_id != home_id:
            raise HTTPException(status_code=403, detail="この清算明細へのアクセス権限がありません")

        m.complete_flag = True
        m.updated_by = user_id
        await self.db.flush()

        all_meisai = await self.db.execute(
            select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
        )
        all_items = list(all_meisai.scalars().all())
        if all(item.complete_flag for item in all_items):
            seisan.complete_flag = True
            await self.db.flush()

        from_user = await self.db.get(User, m.from_user_id) if m.from_user_id else None
        to_user = await self.db.get(User, m.to_user_id) if m.to_user_id else None

        return SeisanMeisaiResponse(
            id=m.id,
            seisan_id=m.seisan_id,
            from_user_id=m.from_user_id,
            from_nickname=from_user.nickname if from_user else None,
            to_user_id=m.to_user_id,
            to_nickname=to_user.nickname if to_user else None,
            amount=m.amount,
            complete_flag=m.complete_flag,
        )
