import asyncio
import logging
from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.features.costs.seisan_calculator import CostEntry, build_balances, calculate_settlements
from app.models.announce import Announce, AnnounceRecipient
from app.models.cost import AutoSeisan, Cost, Koteihi, Seikyusaki, Seisan, SeisanMeisai
from app.models.home import HomeLink
from app.models.user import User
from app.tasks.celery_app import celery_app
from app.utils.fcm import init_firebase, send_push_to_users

logger = logging.getLogger(__name__)


async def run_settlement_for_home(
    db: AsyncSession,
    home_id: int,
    today: date,
) -> bool:
    """単一ホームの清算を実行する。清算レコードが生成されたら True を返す。"""
    member_result = await db.execute(
        select(User)
        .join(HomeLink, HomeLink.user_id == User.id)
        .where(HomeLink.home_id == home_id, HomeLink.deleted_at.is_(None))
    )
    members = list(member_result.scalars().all())
    member_ids = [m.id for m in members]

    # 固定費をその月のCostレコードに変換
    koteihi_result = await db.execute(
        select(Koteihi).where(Koteihi.home_id == home_id)
    )
    for k in koteihi_result.scalars().all():
        if not k.from_user_id or not k.to_user_id:
            continue
        cost = Cost(
            home_id=home_id,
            purchase_date=today,
            amount=k.amount,
            payer_user_id=k.to_user_id,
            category_id=k.category_id,
            payment_method="",
            memo=k.memo or "固定費",
        )
        db.add(cost)
        await db.flush()
        db.add(Seikyusaki(
            cost_id=cost.id,
            payer_user_id=k.from_user_id,
            amount=k.amount,
        ))
    await db.flush()

    cost_result = await db.execute(
        select(Cost).where(Cost.home_id == home_id, Cost.seisan_id.is_(None))
    )
    unsettled_costs = list(cost_result.scalars().all())

    if not unsettled_costs:
        logger.info("ホーム %d: 未清算の支出なし、スキップ", home_id)
        return False

    entries: list[CostEntry] = []
    for cost in unsettled_costs:
        if not cost.payer_user_id:
            continue
        sei_result = await db.execute(
            select(Seikyusaki).where(Seikyusaki.cost_id == cost.id)
        )
        sei_list = list(sei_result.scalars().all())
        sei_pairs = [
            (s.payer_user_id, s.amount)
            for s in sei_list
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

    title = f"{today.year}年{today.month}月 自動清算"
    seisan = Seisan(
        home_id=home_id,
        title=title,
        complete_flag=False,
        settled_date=today,
    )
    db.add(seisan)
    await db.flush()

    for from_uid, to_uid, amount in transfers:
        db.add(
            SeisanMeisai(
                seisan_id=seisan.id,
                from_user_id=from_uid,
                to_user_id=to_uid,
                amount=amount,
                complete_flag=False,
            )
        )

    for cost in unsettled_costs:
        cost.seisan_id = seisan.id

    await db.flush()
    logger.info(
        "ホーム %d: 自動清算完了 (seisan_id=%d, 転送=%d件)",
        home_id,
        seisan.id,
        len(transfers),
    )

    if member_ids:
        ann_title = f"「{title}」の清算が届いています"[:50]
        ann = Announce(
            home_id=home_id,
            title=ann_title,
            content="清算の明細を確認してください。",
            priority="high",
            end_date=today + timedelta(days=7),
            link_url=f"/costs/seisan/{seisan.id}",
        )
        db.add(ann)
        await db.flush()
        for uid in member_ids:
            db.add(AnnounceRecipient(announce_id=ann.id, user_id=uid))
        await db.flush()
        await send_push_to_users(db, member_ids, ann_title, "清算の明細を確認してください。")

    return True


async def run_monthly_settlement_async(
    db: AsyncSession,
    today: date | None = None,
) -> int:
    """execute_flag=True の全ホームを対象に月末清算チェックを実行する。

    清算を作成したホーム数を返す。
    """
    if today is None:
        today = date.today()

    last_day = monthrange(today.year, today.month)[1]

    result = await db.execute(select(AutoSeisan).where(AutoSeisan.execute_flag.is_(True)))
    auto_seisans = list(result.scalars().all())

    executed = 0
    for auto in auto_seisans:
        should_run = today.day == auto.seisan_day or (
            auto.seisan_day > last_day and today.day == last_day
        )
        if not should_run:
            continue
        try:
            created = await run_settlement_for_home(db, auto.home_id, today)
            if created:
                executed += 1
        except Exception:
            logger.exception("ホーム %d の自動清算でエラーが発生しました", auto.home_id)

    return executed


@celery_app.task
def run_monthly_settlement() -> None:
    init_firebase()

    async def _task() -> None:
        engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
        session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        try:
            async with session_factory() as db:
                try:
                    count = await run_monthly_settlement_async(db)
                    await db.commit()
                    logger.info("月末自動清算完了: %d ホームを処理", count)
                except Exception:
                    logger.exception("月末自動清算に失敗しました")
                    await db.rollback()
        finally:
            await engine.dispose()

    asyncio.run(_task())
