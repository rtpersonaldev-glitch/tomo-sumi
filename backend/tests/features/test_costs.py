import io
from datetime import date
from pathlib import Path
from unittest.mock import patch

from httpx import AsyncClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.utils.file_storage as fs
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
    """清算明細を完了にできる"""
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

    complete_resp = await client.post(f"/api/costs/seisan-meisai/{meisai_id}/complete")
    assert complete_resp.status_code == 200
    assert complete_resp.json()["complete_flag"] is True


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


async def test_activity_log_on_create_cost(client: AsyncClient) -> None:
    """支出作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await _create_cost(client, amount=1000)
    logs = await client.get(f"/api/activity/{home_id}")
    assert any("支出" in log["action"] for log in logs.json())


async def test_activity_log_on_create_seisan(client: AsyncClient) -> None:
    """清算作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post(
        "/api/costs/seisan",
        json={"title": "ログテスト", "settled_date": "2026-06-30"},
    )
    logs = await client.get(f"/api/activity/{home_id}")
    assert any("清算" in log["action"] for log in logs.json())
