import io
from datetime import date
from pathlib import Path
from unittest.mock import patch

from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.utils.file_storage as fs
from app.models.activity import ActivityLog
from app.models.home import Home, HomeLink
from app.models.user import User

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"cost_user{_SEQ}@example.com"


async def _register_and_login(
    client: AsyncClient,
    email: str | None = None,
    nickname: str = "テストユーザー",
) -> int:
    email = email or _unique_email()
    await client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPass123!", "nickname": nickname},
    )
    await client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    me = await client.get("/api/auth/me")
    return me.json()["user"]["id"]


async def _create_and_select_home(client: AsyncClient, name: str = "テストホーム") -> int:
    resp = await client.post("/api/homes", json={"name": name})
    home_id = resp.json()["id"]
    await client.post(f"/api/auth/home-login/{home_id}")
    return home_id


async def _create_cost(
    client: AsyncClient,
    home_id: int | None = None,
    amount: int = 1000,
    purchase_date: str = "2026-06-01",
) -> dict:
    resp = await client.post(
        "/api/costs",
        data={"purchase_date": purchase_date, "amount": str(amount)},
    )
    assert resp.status_code == 201
    return resp.json()


# ─── GET /api/costs/{home_id} ────────────────────────────────────────────────


async def test_list_costs_empty(client: AsyncClient) -> None:
    """未清算支出がない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_costs(client: AsyncClient) -> None:
    """支出一覧を返す（清算済みは除外）"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await _create_cost(client, amount=1000)
    await _create_cost(client, amount=2000)
    resp = await client.get(f"/api/costs/{home_id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_list_costs_wrong_home(client: AsyncClient) -> None:
    """他ホームの支出一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.get("/api/costs/99999")
    assert resp.status_code == 403


async def test_list_costs_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401"""
    resp = await client.get("/api/costs/1")
    assert resp.status_code == 401


# ─── POST /api/costs ──────────────────────────────────────────────────────────


async def test_create_cost(client: AsyncClient) -> None:
    """支出を作成すると 201 と詳細を返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "3000", "memo": "テスト支出"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 3000
    assert data["memo"] == "テスト支出"
    assert data["seisan_id"] is None


async def test_create_cost_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401"""
    resp = await client.post("/api/costs", data={"purchase_date": "2026-06-01", "amount": "1000"})
    assert resp.status_code == 401


async def test_create_cost_with_receipt(client: AsyncClient, tmp_path: Path) -> None:
    """レシート画像付きで支出を作成すると receipt_image_url に格納される"""
    await _register_and_login(client)
    await _create_and_select_home(client)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(200, 200, 0)).save(buf, format="JPEG")
    jpg_bytes = buf.getvalue()

    with patch.object(fs, "MEDIA_ROOT", tmp_path):
        resp = await client.post(
            "/api/costs",
            data={"purchase_date": "2026-06-01", "amount": "3000", "memo": "レシートテスト"},
            files={"receipt_image": ("receipt.jpg", jpg_bytes, "image/jpeg")},
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 3000
    assert data["receipt_image_url"] is not None


# ─── GET /api/costs/{id}/detail ──────────────────────────────────────────────


async def test_get_cost_detail(client: AsyncClient) -> None:
    """支出詳細を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    cost = await _create_cost(client, amount=5000)
    resp = await client.get(f"/api/costs/{cost['id']}/detail")
    assert resp.status_code == 200
    assert resp.json()["amount"] == 5000


async def test_get_cost_detail_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームの支出詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    from app.models.cost import Cost
    cost = Cost(
        home_id=other_home.id,
        purchase_date=date(2026, 6, 1),
        amount=1000,
        payment_method="",
        memo="",
    )
    db.add(cost)
    await db.flush()
    resp = await client.get(f"/api/costs/{cost.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/costs/{id} ─────────────────────────────────────────────────────


async def test_update_cost(client: AsyncClient) -> None:
    """支出を更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    cost = await _create_cost(client, amount=1000)
    resp = await client.put(
        f"/api/costs/{cost['id']}",
        data={"purchase_date": "2026-06-15", "amount": "2000", "memo": "更新後"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 2000
    assert resp.json()["memo"] == "更新後"


async def test_create_cost_with_seikyusaki(client: AsyncClient) -> None:
    """seikyusaki_json を送ると請求先が保存されてレスポンスに含まれる"""
    import json

    uid = await _register_and_login(client)
    await _create_and_select_home(client)

    sei = json.dumps([{"user_id": uid, "amount": 1000, "dish_count": None}])
    resp = await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "1000", "seikyusaki_json": sei},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["seikyusaki"]) == 1
    assert data["seikyusaki"][0]["payer_user_id"] == uid
    assert data["seikyusaki"][0]["amount"] == 1000
    assert data["seikyusaki"][0]["dish_count"] is None


async def test_update_cost_replaces_seikyusaki(client: AsyncClient) -> None:
    """支出更新時に seikyusaki_json を送ると既存の請求先が置き換わる"""
    import json

    uid = await _register_and_login(client)
    await _create_and_select_home(client)

    # 初回作成: 請求先あり
    sei1 = json.dumps([{"user_id": uid, "amount": 1000, "dish_count": None}])
    cost = (
        await client.post(
            "/api/costs",
            data={"purchase_date": "2026-06-01", "amount": "1000", "seikyusaki_json": sei1},
        )
    ).json()
    assert len(cost["seikyusaki"]) == 1

    # 更新: 請求先を空に
    resp = await client.put(
        f"/api/costs/{cost['id']}",
        data={
            "purchase_date": "2026-06-01",
            "amount": "2000",
            "seikyusaki_json": json.dumps([]),
        },
    )
    assert resp.status_code == 200
    assert len(resp.json()["seikyusaki"]) == 0
    assert resp.json()["amount"] == 2000


# ─── DELETE /api/costs/{id} ──────────────────────────────────────────────────


async def test_delete_cost(client: AsyncClient) -> None:
    """支出を削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    cost = await _create_cost(client, amount=1000)
    resp = await client.delete(f"/api/costs/{cost['id']}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/costs/{home_id}")
    assert list_resp.json() == []


# ─── GET /api/costs/{home_id}/categories ─────────────────────────────────────


async def test_list_categories_empty(client: AsyncClient) -> None:
    """カテゴリがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}/categories")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_and_list_categories(client: AsyncClient) -> None:
    """カテゴリを作成して一覧取得できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.post(f"/api/costs/{home_id}/categories", json={"name": "食費"})
    assert resp.status_code == 201
    assert resp.json()["name"] == "食費"

    list_resp = await client.get(f"/api/costs/{home_id}/categories")
    assert len(list_resp.json()) == 1


# ─── GET /api/costs/{home_id}/summary ────────────────────────────────────────


async def test_get_summary_empty(client: AsyncClient) -> None:
    """支出がない場合のサマリーはゼロ"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_amount"] == 0
    assert data["by_user"] == []
    assert data["by_category"] == []


async def test_get_summary_with_costs(client: AsyncClient) -> None:
    """支出があるサマリーを返す"""
    user_id = await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "1000", "payer_user_id": str(user_id)},
    )
    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-02", "amount": "2000", "payer_user_id": str(user_id)},
    )
    resp = await client.get(f"/api/costs/{home_id}/summary")
    assert resp.status_code == 200
    assert resp.json()["total_amount"] == 3000


async def test_get_summary_period_filter(client: AsyncClient) -> None:
    """period フィルターが機能する"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/costs", data={"purchase_date": "2026-06-01", "amount": "1000"})
    await client.post("/api/costs", data={"purchase_date": "2026-07-01", "amount": "2000"})
    resp = await client.get(f"/api/costs/{home_id}/summary?period=2026-06")
    assert resp.status_code == 200
    assert resp.json()["total_amount"] == 1000


# ─── Settings ────────────────────────────────────────────────────────────────


async def test_get_settings_initial(client: AsyncClient) -> None:
    """初期状態は auto_seisan が None"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}/settings")
    assert resp.status_code == 200
    assert resp.json()["auto_seisan"] is None


async def test_update_auto_seisan(client: AsyncClient) -> None:
    """自動清算設定を作成・更新できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.put(
        f"/api/costs/{home_id}/settings/auto-seisan",
        json={"execute_flag": True, "seisan_day": 25},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["execute_flag"] is True
    assert data["seisan_day"] == 25

    resp2 = await client.put(
        f"/api/costs/{home_id}/settings/auto-seisan",
        json={"execute_flag": False, "seisan_day": 1},
    )
    assert resp2.status_code == 200
    assert resp2.json()["execute_flag"] is False


# ─── Koteihi ─────────────────────────────────────────────────────────────────


async def test_list_koteihi_empty(client: AsyncClient) -> None:
    """固定費がない場合は空リスト"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}/koteihi")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_koteihi(client: AsyncClient) -> None:
    """固定費を作成できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.post(
        f"/api/costs/{home_id}/koteihi",
        json={"amount": 50000, "memo": "家賃"},
    )
    assert resp.status_code == 201
    assert resp.json()["amount"] == 50000
    assert resp.json()["memo"] == "家賃"


async def test_update_koteihi(client: AsyncClient) -> None:
    """固定費を更新できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post(
        f"/api/costs/{home_id}/koteihi",
        json={"amount": 50000, "memo": "家賃"},
    )
    koteihi_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/costs/koteihi/{koteihi_id}",
        json={"amount": 55000, "memo": "家賃（更新）"},
    )
    assert resp.status_code == 200
    assert resp.json()["amount"] == 55000


async def test_delete_koteihi(client: AsyncClient) -> None:
    """固定費を削除できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post(
        f"/api/costs/{home_id}/koteihi",
        json={"amount": 1000, "memo": "削除テスト"},
    )
    koteihi_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/costs/koteihi/{koteihi_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/costs/{home_id}/koteihi")
    assert list_resp.json() == []


# ─── Seisan ──────────────────────────────────────────────────────────────────


async def test_list_seisan_pending_empty(client: AsyncClient) -> None:
    """清算待ちが空の場合は空リスト"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}/seisan/pending")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_seisan_completed_empty(client: AsyncClient) -> None:
    """清算済みが空の場合は空リスト"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/costs/{home_id}/seisan/completed")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_seisan_no_costs(client: AsyncClient) -> None:
    """支出がない状態でも清算レコードを作成できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post(
        "/api/costs/seisan",
        json={"title": "6月清算", "settled_date": "2026-06-30"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "6月清算"
    assert data["complete_flag"] is False
    assert data["meisai"] == []


async def test_create_seisan_with_costs(client: AsyncClient, db: AsyncSession) -> None:
    """支出ありの清算: 明細が生成され支出が清算済みになる"""
    user1_id = await _register_and_login(
        client, email="seisan_u1@example.com", nickname="ユーザー1"
    )
    home_id = await _create_and_select_home(client)

    # 2人目をホームに参加させる（直接DBで）
    await client.post(
        "/api/auth/register",
        json={"email": "seisan_u2@example.com", "password": "TestPass123!", "nickname": "U2"},
    )
    user2_result = await db.execute(select(User).where(User.email == "seisan_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    # 支出作成: user1が3000支払い
    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "3000", "payer_user_id": str(user1_id)},
    )

    list_before = await client.get(f"/api/costs/{home_id}")
    assert len(list_before.json()) == 1

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "6月清算", "settled_date": "2026-06-30"},
    )
    assert seisan_resp.status_code == 201
    seisan_data = seisan_resp.json()
    assert len(seisan_data["meisai"]) >= 1

    # 清算後は未清算リストから消える
    list_after = await client.get(f"/api/costs/{home_id}")
    assert list_after.json() == []


async def test_get_seisan_detail(client: AsyncClient) -> None:
    """清算詳細を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "詳細テスト清算", "settled_date": "2026-06-30"},
    )
    seisan_id = create_resp.json()["id"]
    resp = await client.get(f"/api/costs/seisan/{seisan_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "詳細テスト清算"


async def test_complete_meisai(client: AsyncClient, db: AsyncSession) -> None:
    """清算明細の2段階完了フロー: 支払元が完了→受取人が確認"""
    user1_id = await _register_and_login(
        client, email="meisai_u1@example.com", nickname="メイサイ1"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "meisai_u2@example.com", "password": "TestPass123!", "nickname": "M2"},
    )
    user2_result = await db.execute(select(User).where(User.email == "meisai_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "2000", "payer_user_id": str(user1_id)},
    )

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "明細完了テスト", "settled_date": "2026-06-30"},
    )
    meisai = seisan_resp.json()["meisai"]
    assert len(meisai) >= 1
    meisai_id = meisai[0]["id"]

    # Step1: user2 (from_user=支払元) がメモ付きで完了
    await client.post("/api/auth/login", json={"email": "meisai_u2@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    complete_resp = await client.post(
        f"/api/costs/seisan-meisai/{meisai_id}/complete",
        json={"memo": "PayPayで送金しました"},
    )
    assert complete_resp.status_code == 200
    data = complete_resp.json()
    assert data["payer_confirmed"] is True
    assert data["payer_memo"] == "PayPayで送金しました"
    assert data["complete_flag"] is False  # 受取確認待ち

    # Step2: user1 (to_user=受取人) が確認
    await client.post("/api/auth/login", json={"email": "meisai_u1@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    confirm_resp = await client.post(f"/api/costs/seisan-meisai/{meisai_id}/confirm")
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["complete_flag"] is True


async def test_confirm_meisai_before_payer_complete(client: AsyncClient, db: AsyncSession) -> None:
    """支払元が完了する前に受取人が確認しようとすると400"""
    user1_id = await _register_and_login(
        client, email="confirm_u1@example.com", nickname="確認1"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "confirm_u2@example.com", "password": "TestPass123!", "nickname": "確認2"},
    )
    user2_result = await db.execute(select(User).where(User.email == "confirm_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "2000", "payer_user_id": str(user1_id)},
    )
    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "確認テスト", "settled_date": "2026-06-30"},
    )
    meisai_id = seisan_resp.json()["meisai"][0]["id"]

    # user1 (to_user) が支払元完了前に確認しようとする → 400
    resp = await client.post(f"/api/costs/seisan-meisai/{meisai_id}/confirm")
    assert resp.status_code == 400


async def test_seisan_response_includes_costs(client: AsyncClient, db: AsyncSession) -> None:
    """清算レスポンスに含まれる支出一覧が返される"""
    user1_id = await _register_and_login(
        client, email="seisan_cost_u1@example.com", nickname="支出確認1"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "seisan_cost_u2@example.com", "password": "TestPass123!", "nickname": "支出確認2"},
    )
    user2_result = await db.execute(select(User).where(User.email == "seisan_cost_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "3000", "payer_user_id": str(user1_id)},
    )

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "支出一覧テスト", "settled_date": "2026-06-30"},
    )
    assert seisan_resp.status_code == 201
    body = seisan_resp.json()
    assert "costs" in body
    assert len(body["costs"]) == 1
    assert body["costs"][0]["amount"] == 3000


async def test_seisan_pending_and_completed_lists(client: AsyncClient) -> None:
    """清算一覧: pending/completed が正しく分類される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post(
        "/api/costs/seisan",
        json={"title": "未完了清算", "settled_date": "2026-06-30"},
    )
    pending = await client.get(f"/api/costs/{home_id}/seisan/pending")
    completed = await client.get(f"/api/costs/{home_id}/seisan/completed")
    assert len(pending.json()) == 1
    assert len(completed.json()) == 0


async def test_activity_log_on_create_cost(client: AsyncClient, db: AsyncSession) -> None:
    """支出作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await _create_cost(client, amount=1000)
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("支出" in log.action for log in logs)


async def test_activity_log_on_create_seisan(client: AsyncClient, db: AsyncSession) -> None:
    """清算作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post(
        "/api/costs/seisan",
        json={"title": "ログテスト", "settled_date": "2026-06-30"},
    )
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("清算" in log.action for log in logs)


# ─── お知らせ自動生成 ────────────────────────────────────────────────────────


async def test_create_seisan_generates_announce(client: AsyncClient, db: AsyncSession) -> None:
    """清算作成時: 受取人(to_user)にリンク付きお知らせが自動生成される"""
    user1_id = await _register_and_login(
        client, email="ann_seisan_u1@example.com", nickname="清算送信者"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "ann_seisan_u2@example.com", "password": "TestPass123!", "nickname": "清算受取者"},
    )
    user2_result = await db.execute(select(User).where(User.email == "ann_seisan_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "3000", "payer_user_id": str(user1_id)},
    )

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "6月清算", "settled_date": "2026-06-30"},
    )
    assert seisan_resp.status_code == 201
    seisan_id = seisan_resp.json()["id"]

    # 受取人(user2)でログインしてお知らせを確認
    await client.post("/api/auth/login", json={"email": "ann_seisan_u2@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    ann_resp = await client.get(f"/api/announces/{home_id}")
    assert ann_resp.status_code == 200
    announces = ann_resp.json()
    assert len(announces) == 1
    ann = announces[0]
    assert "清算" in ann["title"]
    assert ann["link_url"] == f"/costs/seisan/{seisan_id}"
    assert ann["priority"] == "high"
    assert user1_id in ann["recipient_ids"]
    assert user2_id in ann["recipient_ids"]


async def test_complete_meisai_generates_announce(client: AsyncClient, db: AsyncSession) -> None:
    """清算明細「完了にする」時: 受取人(to_user)にリンク付きお知らせが自動生成される"""
    user1_id = await _register_and_login(
        client, email="ann_meisai_u1@example.com", nickname="明細受取者"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "ann_meisai_u2@example.com", "password": "TestPass123!", "nickname": "明細支払者"},
    )
    user2_result = await db.execute(select(User).where(User.email == "ann_meisai_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "2000", "payer_user_id": str(user1_id)},
    )

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "明細完了テスト", "settled_date": "2026-06-30"},
    )
    seisan_id = seisan_resp.json()["id"]
    meisai = seisan_resp.json()["meisai"]
    meisai_id = meisai[0]["id"]

    # 清算作成時のお知らせをリセットするため、user2として明細完了を実行
    await client.post("/api/auth/login", json={"email": "ann_meisai_u2@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    complete_resp = await client.post(
        f"/api/costs/seisan-meisai/{meisai_id}/complete",
        json={"memo": "振込しました"},
    )
    assert complete_resp.status_code == 200

    # 受取人(user1)でログインしてお知らせを確認
    await client.post("/api/auth/login", json={"email": "ann_meisai_u1@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    ann_resp = await client.get(f"/api/announces/{home_id}")
    assert ann_resp.status_code == 200
    announces = ann_resp.json()
    confirm_ann = next((a for a in announces if "受取確認" in a["title"]), None)
    assert confirm_ann is not None
    assert confirm_ann["link_url"] == f"/costs/seisan/{seisan_id}"
    assert confirm_ann["priority"] == "high"
    assert user1_id in confirm_ann["recipient_ids"]
    assert user2_id in confirm_ann["recipient_ids"]


# ─── 差し戻し ────────────────────────────────────────────────────────


async def test_reject_meisai(client: AsyncClient, db: AsyncSession) -> None:
    """受取人が差し戻しすると payer_confirmed が False に戻る"""
    user1_id = await _register_and_login(
        client, email="reject_u1@example.com", nickname="受取人"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "reject_u2@example.com", "password": "TestPass123!", "nickname": "支払者"},
    )
    user2_result = await db.execute(select(User).where(User.email == "reject_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "1000", "payer_user_id": str(user1_id)},
    )
    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "差し戻しテスト", "settled_date": "2026-06-30"},
    )
    seisan_id = seisan_resp.json()["id"]
    meisai_id = seisan_resp.json()["meisai"][0]["id"]

    # user2（支払者）でログインして完了にする
    await client.post("/api/auth/login", json={"email": "reject_u2@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    complete_resp = await client.post(
        f"/api/costs/seisan-meisai/{meisai_id}/complete",
        json={"memo": "振込しました"},
    )
    assert complete_resp.status_code == 200
    assert complete_resp.json()["payer_confirmed"] is True

    # user1（受取人）でログインして差し戻し
    await client.post("/api/auth/login", json={"email": "reject_u1@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    reject_resp = await client.post(f"/api/costs/seisan-meisai/{meisai_id}/reject")
    assert reject_resp.status_code == 200
    data = reject_resp.json()
    assert data["payer_confirmed"] is False
    assert data["payer_memo"] is None
    assert data["complete_flag"] is False

    # 差し戻し時にお知らせが作成される
    from app.models.announce import Announce, AnnounceRecipient

    from sqlalchemy import desc as _desc

    ann_result = await db.execute(
        select(Announce)
        .where(
            Announce.home_id == home_id,
            Announce.link_url == f"/costs/seisan/{seisan_id}",
            Announce.title.contains("差し戻し"),
        )
        .order_by(_desc(Announce.id))
        .limit(1)
    )
    ann = ann_result.scalar_one()
    assert ann is not None
    recipient_result = await db.execute(
        select(AnnounceRecipient).where(AnnounceRecipient.announce_id == ann.id)
    )
    recipient_ids = [r.user_id for r in recipient_result.scalars().all()]
    assert user1_id in recipient_ids
    assert user2_id in recipient_ids


async def test_reject_meisai_by_wrong_user(client: AsyncClient, db: AsyncSession) -> None:
    """支払者は差し戻しできない"""
    user1_id = await _register_and_login(
        client, email="reject_w1@example.com", nickname="受取人B"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "reject_w2@example.com", "password": "TestPass123!", "nickname": "支払者B"},
    )
    user2_result = await db.execute(select(User).where(User.email == "reject_w2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "1000", "payer_user_id": str(user1_id)},
    )
    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "差し戻し権限テスト", "settled_date": "2026-06-30"},
    )
    meisai_id = seisan_resp.json()["meisai"][0]["id"]

    # user2（支払者）で完了
    await client.post("/api/auth/login", json={"email": "reject_w2@example.com", "password": "TestPass123!"})
    await client.post(f"/api/auth/home-login/{home_id}")
    await client.post(f"/api/costs/seisan-meisai/{meisai_id}/complete", json={"memo": ""})

    # user2（支払者）のまま差し戻し → 403
    reject_resp = await client.post(f"/api/costs/seisan-meisai/{meisai_id}/reject")
    assert reject_resp.status_code == 403


async def test_reject_meisai_not_confirmed(client: AsyncClient, db: AsyncSession) -> None:
    """payer_confirmed が False の場合は差し戻し不可"""
    user1_id = await _register_and_login(
        client, email="reject_nc1@example.com", nickname="受取人C"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "reject_nc2@example.com", "password": "TestPass123!", "nickname": "支払者C"},
    )
    user2_result = await db.execute(select(User).where(User.email == "reject_nc2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "1000", "payer_user_id": str(user1_id)},
    )
    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "未払い差し戻しテスト", "settled_date": "2026-06-30"},
    )
    meisai_id = seisan_resp.json()["meisai"][0]["id"]

    # 完了前に差し戻し → 400
    reject_resp = await client.post(f"/api/costs/seisan-meisai/{meisai_id}/reject")
    assert reject_resp.status_code == 400


# ─── 固定費（Koteihi）は手動清算に含まれない ────────────────────────────────


async def test_create_seisan_excludes_koteihi(client: AsyncClient, db: AsyncSession) -> None:
    """手動清算では固定費は計算に含まれない（通常支出のみが対象）"""
    user1_id = await _register_and_login(
        client, email="koteihi_u1@example.com", nickname="固定費受取者"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "koteihi_u2@example.com", "password": "TestPass123!", "nickname": "固定費支払者"},
    )
    user2_result = await db.execute(select(User).where(User.email == "koteihi_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    # 固定費のみ登録（通常支出なし）
    await client.post(
        f"/api/costs/{home_id}/koteihi",
        json={"amount": 10000, "from_user_id": user2_id, "to_user_id": user1_id, "memo": "家賃"},
    )

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "固定費テスト清算", "settled_date": "2026-06-30"},
    )
    assert seisan_resp.status_code == 201
    # 通常支出がないので明細は空
    assert seisan_resp.json()["meisai"] == []


async def test_create_seisan_with_costs_excludes_koteihi(client: AsyncClient, db: AsyncSession) -> None:
    """手動清算は通常支出のみを対象とし、固定費は計算に加算されない"""
    user1_id = await _register_and_login(
        client, email="koteihi2_u1@example.com", nickname="ユーザーX"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "koteihi2_u2@example.com", "password": "TestPass123!", "nickname": "ユーザーY"},
    )
    user2_result = await db.execute(select(User).where(User.email == "koteihi2_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    # 通常支出: user1 が 2000 払った（2人均等 → user2 が 1000 返す）
    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "2000", "payer_user_id": str(user1_id)},
    )
    # 固定費も登録されているが清算には含まれない
    await client.post(
        f"/api/costs/{home_id}/koteihi",
        json={"amount": 500, "from_user_id": user2_id, "to_user_id": user1_id, "memo": "固定費"},
    )

    seisan_resp = await client.post(
        "/api/costs/seisan",
        json={"title": "合算テスト清算", "settled_date": "2026-06-30"},
    )
    assert seisan_resp.status_code == 201
    meisai = seisan_resp.json()["meisai"]
    # 通常支出 2000 の均等割りのみ → user2 が 1000 を user1 に返す（固定費 500 は含まない）
    assert len(meisai) == 1
    assert meisai[0]["from_user_id"] == user2_id
    assert meisai[0]["to_user_id"] == user1_id
    assert meisai[0]["amount"] == 1000


# ─── Seisan Merge ─────────────────────────────────────────────────────────────


async def test_merge_seisan_basic(client: AsyncClient, db: AsyncSession) -> None:
    """2件の清算を結合すると新しい清算が作成され旧清算は削除される"""
    user1_id = await _register_and_login(
        client, email="merge_u1@example.com", nickname="ユーザー1"
    )
    home_id = await _create_and_select_home(client)

    await client.post(
        "/api/auth/register",
        json={"email": "merge_u2@example.com", "password": "TestPass123!", "nickname": "U2"},
    )
    user2_result = await db.execute(select(User).where(User.email == "merge_u2@example.com"))
    user2_id = user2_result.scalar_one().id
    db.add(HomeLink(user_id=user2_id, home_id=home_id))
    await db.flush()

    # 清算1: user1 が 2000 支払い
    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-05-01", "amount": "2000", "payer_user_id": str(user1_id)},
    )
    s1 = await client.post(
        "/api/costs/seisan",
        json={"title": "5月清算", "settled_date": "2026-05-31"},
    )
    assert s1.status_code == 201
    seisan1_id = s1.json()["id"]

    # 清算2: user1 が 4000 支払い
    await client.post(
        "/api/costs",
        data={"purchase_date": "2026-06-01", "amount": "4000", "payer_user_id": str(user1_id)},
    )
    s2 = await client.post(
        "/api/costs/seisan",
        json={"title": "6月清算", "settled_date": "2026-06-30"},
    )
    assert s2.status_code == 201
    seisan2_id = s2.json()["id"]

    # 結合
    merge_resp = await client.post(
        "/api/costs/seisan/merge",
        json={
            "seisan_ids": [seisan1_id, seisan2_id],
            "title": "5〜6月合算清算",
            "settled_date": "2026-06-30",
        },
    )
    assert merge_resp.status_code == 201
    merged = merge_resp.json()

    # 結合後の清算タイトルが正しい
    assert merged["title"] == "5〜6月合算清算"
    # 明細: 2000+4000=6000 → 均等割り → user2 が 3000 を user1 に返す
    assert len(merged["meisai"]) == 1
    assert merged["meisai"][0]["from_user_id"] == user2_id
    assert merged["meisai"][0]["to_user_id"] == user1_id
    assert merged["meisai"][0]["amount"] == 3000
    # 旧清算が削除されている
    assert (await client.get(f"/api/costs/seisan/{seisan1_id}")).status_code == 404
    assert (await client.get(f"/api/costs/seisan/{seisan2_id}")).status_code == 404
    # 支出が新清算に紐づいている
    cost_ids = [c["id"] for c in merged["costs"]]
    assert len(cost_ids) == 2


async def test_merge_seisan_requires_two_or_more(client: AsyncClient) -> None:
    """1件のみ指定した場合は 400 を返す"""
    await _register_and_login(client, email="merge_val1@example.com")
    await _create_and_select_home(client)
    s1 = await client.post(
        "/api/costs/seisan",
        json={"title": "テスト清算", "settled_date": "2026-06-30"},
    )
    seisan1_id = s1.json()["id"]
    resp = await client.post(
        "/api/costs/seisan/merge",
        json={"seisan_ids": [seisan1_id], "title": "結合", "settled_date": "2026-06-30"},
    )
    assert resp.status_code == 422  # pydantic min_length=2 validation


async def test_merge_seisan_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームの清算を指定した場合は 403 を返す"""
    user1_id = await _register_and_login(client, email="merge_wh1@example.com")
    home1_id = await _create_and_select_home(client, name="ホーム1")
    s1 = await client.post(
        "/api/costs/seisan",
        json={"title": "ホーム1清算", "settled_date": "2026-06-30"},
    )
    seisan1_id = s1.json()["id"]

    # ホーム2を作成してログイン
    home2_id = await _create_and_select_home(client, name="ホーム2")
    s2 = await client.post(
        "/api/costs/seisan",
        json={"title": "ホーム2清算", "settled_date": "2026-06-30"},
    )
    seisan2_id = s2.json()["id"]

    # ホーム2にログイン中に、ホーム1の清算を含めて結合を試みる
    resp = await client.post(
        "/api/costs/seisan/merge",
        json={
            "seisan_ids": [seisan1_id, seisan2_id],
            "title": "不正結合",
            "settled_date": "2026-06-30",
        },
    )
    assert resp.status_code == 403
