from datetime import date
from unittest.mock import AsyncMock, patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announce import Announce, AnnounceRecipient
from app.models.cost import AutoSeisan, Cost, Koteihi, Seisan, SeisanMeisai
from app.models.home import Home, HomeLink
from app.models.user import User
from app.tasks.cost_tasks import run_monthly_settlement_async, run_settlement_for_home

_SEQ = 0


def _next_seq() -> int:
    global _SEQ
    _SEQ += 1
    return _SEQ


async def _setup_home_with_users(db: AsyncSession, n_users: int = 2) -> tuple[Home, list[User]]:
    home = Home(name="テストホーム")
    db.add(home)
    await db.flush()

    users: list[User] = []
    for _ in range(n_users):
        seq = _next_seq()
        u = User(
            email=f"task_user{seq}@example.com",
            hashed_password="dummy",
            nickname=f"タスクユーザー{seq}",
        )
        db.add(u)
        await db.flush()
        db.add(HomeLink(user_id=u.id, home_id=home.id))
        users.append(u)
    await db.flush()
    return home, users


# ─── run_settlement_for_home ─────────────────────────────────────────────────


async def test_settlement_no_costs_returns_false(db: AsyncSession) -> None:
    """未清算支出も固定費もない場合は False を返す"""
    home, _ = await _setup_home_with_users(db)

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_settlement_for_home(db, home.id, date(2026, 6, 25))

    assert result is False


async def test_settlement_creates_seisan_from_costs(db: AsyncSession) -> None:
    """未清算支出がある場合は Seisan レコードを作成して True を返す"""
    home, users = await _setup_home_with_users(db)
    today = date(2026, 6, 25)

    db.add(Cost(
        home_id=home.id,
        purchase_date=today,
        amount=2000,
        payer_user_id=users[0].id,
        payment_method="",
        memo="",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_settlement_for_home(db, home.id, today)

    assert result is True

    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home.id))
    seisan = seisan_result.scalar_one()
    assert seisan.title == "2026年6月 自動清算"
    assert seisan.settled_date == today


async def test_settlement_links_costs_to_seisan(db: AsyncSession) -> None:
    """清算後、支出に seisan_id がセットされる"""
    home, users = await _setup_home_with_users(db)
    today = date(2026, 6, 25)

    cost = Cost(
        home_id=home.id,
        purchase_date=today,
        amount=1000,
        payer_user_id=users[0].id,
        payment_method="",
        memo="",
    )
    db.add(cost)
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        await run_settlement_for_home(db, home.id, today)

    await db.refresh(cost)
    assert cost.seisan_id is not None


async def test_settlement_creates_announce_for_members(db: AsyncSession) -> None:
    """自動清算後に全メンバー宛のお知らせが作成される"""
    home, users = await _setup_home_with_users(db, n_users=2)
    today = date(2026, 6, 25)

    db.add(Cost(
        home_id=home.id,
        purchase_date=today,
        amount=1000,
        payer_user_id=users[0].id,
        payment_method="",
        memo="",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock) as mock_push:
        await run_settlement_for_home(db, home.id, today)

    ann_result = await db.execute(select(Announce).where(Announce.home_id == home.id))
    ann = ann_result.scalar_one()
    assert "自動清算" in ann.title
    assert ann.priority == "high"
    assert ann.link_url is not None

    recipient_result = await db.execute(
        select(AnnounceRecipient).where(AnnounceRecipient.announce_id == ann.id)
    )
    recipient_ids = {r.user_id for r in recipient_result.scalars().all()}
    assert {u.id for u in users} == recipient_ids

    mock_push.assert_called_once()


async def test_settlement_includes_koteihi(db: AsyncSession) -> None:
    """固定費が Cost に変換されて清算に含まれる"""
    home, users = await _setup_home_with_users(db, n_users=2)
    payer, receiver = users[0], users[1]
    today = date(2026, 6, 25)

    db.add(Koteihi(
        home_id=home.id,
        from_user_id=payer.id,
        to_user_id=receiver.id,
        amount=50000,
        memo="家賃",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_settlement_for_home(db, home.id, today)

    assert result is True

    # 固定費由来の Cost が作成される
    cost_result = await db.execute(select(Cost).where(Cost.home_id == home.id))
    costs = cost_result.scalars().all()
    assert len(costs) == 1
    assert costs[0].amount == 50000
    assert costs[0].memo == "家賃"

    # SeisanMeisai で payer→receiver の送金が生成される
    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home.id))
    seisan = seisan_result.scalar_one()
    meisai_result = await db.execute(
        select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
    )
    meisai_list = meisai_result.scalars().all()
    assert len(meisai_list) == 1
    assert meisai_list[0].from_user_id == payer.id
    assert meisai_list[0].to_user_id == receiver.id
    assert meisai_list[0].amount == 50000


async def test_settlement_koteihi_and_costs_combined(db: AsyncSession) -> None:
    """固定費と通常支出が合算されて清算される"""
    home, users = await _setup_home_with_users(db, n_users=2)
    u1, u2 = users[0], users[1]
    today = date(2026, 6, 25)

    # 通常支出: u1 が 2000 支払い（u2 が 1000 負担）
    cost = Cost(
        home_id=home.id,
        purchase_date=today,
        amount=2000,
        payer_user_id=u1.id,
        payment_method="",
        memo="食費",
    )
    db.add(cost)
    await db.flush()

    from app.models.cost import Seikyusaki
    db.add(Seikyusaki(cost_id=cost.id, payer_user_id=u2.id, amount=1000))

    # 固定費: u2 → u1 へ 3000（家賃）
    db.add(Koteihi(
        home_id=home.id,
        from_user_id=u2.id,
        to_user_id=u1.id,
        amount=3000,
        memo="家賃",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_settlement_for_home(db, home.id, today)

    assert result is True

    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home.id))
    seisan = seisan_result.scalar_one()
    meisai_result = await db.execute(
        select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
    )
    meisai_list = meisai_result.scalars().all()
    # u2 は u1 に食費1000 + 家賃3000 = 4000 支払うが、u1 が 2000 支払っているので差し引き
    # u1の残高: +2000(支出) - 1000(seikyu) + 3000(家賃受取) = +4000 → 債権者
    # u2の残高: -1000(seikyu) - 3000(家賃支払い) = -4000 → 債務者
    total_transfer = sum(m.amount for m in meisai_list)
    assert total_transfer == 4000


# ─── run_monthly_settlement_async ────────────────────────────────────────────


async def test_monthly_settlement_skips_disabled(db: AsyncSession) -> None:
    """execute_flag=False のホームはスキップされる"""
    home, _ = await _setup_home_with_users(db)
    db.add(AutoSeisan(home_id=home.id, execute_flag=False, seisan_day=25))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_monthly_settlement_async(db, today=date(2026, 6, 25))

    assert result == 0


async def test_monthly_settlement_skips_wrong_day(db: AsyncSession) -> None:
    """seisan_day と today.day が一致しない場合はスキップ"""
    home, _ = await _setup_home_with_users(db)
    db.add(AutoSeisan(home_id=home.id, execute_flag=True, seisan_day=25))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_monthly_settlement_async(db, today=date(2026, 6, 15))

    assert result == 0


async def test_monthly_settlement_runs_on_matching_day(db: AsyncSession) -> None:
    """seisan_day と today.day が一致する場合は清算が実行される"""
    home, users = await _setup_home_with_users(db)
    today = date(2026, 6, 25)
    db.add(AutoSeisan(home_id=home.id, execute_flag=True, seisan_day=25))
    db.add(Cost(
        home_id=home.id,
        purchase_date=today,
        amount=3000,
        payer_user_id=users[0].id,
        payment_method="",
        memo="",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_monthly_settlement_async(db, today=today)

    assert result == 1
    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home.id))
    assert seisan_result.scalar_one() is not None


async def test_monthly_settlement_month_end_fallback(db: AsyncSession) -> None:
    """seisan_day が月の最終日より大きい場合は月末に実行される"""
    home, users = await _setup_home_with_users(db)
    today = date(2026, 6, 30)  # 6月の最終日
    db.add(AutoSeisan(home_id=home.id, execute_flag=True, seisan_day=31))
    db.add(Cost(
        home_id=home.id,
        purchase_date=today,
        amount=1000,
        payer_user_id=users[0].id,
        payment_method="",
        memo="",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_monthly_settlement_async(db, today=today)

    assert result == 1


async def test_monthly_settlement_runs_with_only_koteihi(db: AsyncSession) -> None:
    """支出なしで固定費のみの場合、自動清算が正常に実行される (#209)"""
    home, users = await _setup_home_with_users(db, n_users=2)
    payer, receiver = users[0], users[1]
    today = date(2026, 6, 26)
    db.add(AutoSeisan(home_id=home.id, execute_flag=True, seisan_day=26))
    db.add(Koteihi(
        home_id=home.id,
        from_user_id=payer.id,
        to_user_id=receiver.id,
        amount=50000,
        memo="家賃",
    ))
    await db.flush()

    with patch("app.tasks.cost_tasks.send_push_to_users", new_callable=AsyncMock):
        result = await run_monthly_settlement_async(db, today=today)

    assert result == 1

    seisan_result = await db.execute(select(Seisan).where(Seisan.home_id == home.id))
    seisan = seisan_result.scalar_one()
    assert seisan.title == "2026年6月 自動清算"

    meisai_result = await db.execute(
        select(SeisanMeisai).where(SeisanMeisai.seisan_id == seisan.id)
    )
    meisai_list = meisai_result.scalars().all()
    assert len(meisai_list) == 1
    assert meisai_list[0].from_user_id == payer.id
    assert meisai_list[0].to_user_id == receiver.id
    assert meisai_list[0].amount == 50000
