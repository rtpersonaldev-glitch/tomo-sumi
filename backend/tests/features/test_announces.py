from datetime import date
from unittest.mock import MagicMock, patch

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import app.utils.fcm as fcm_module
from app.models.activity import ActivityLog
from app.models.announce import Announce, AnnounceRecipient
from app.models.home import Home

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"announce_user{_SEQ}@example.com"


async def _register_and_login(
    client: AsyncClient,
    email: str | None = None,
    nickname: str = "テストユーザー",
) -> int:
    email = email or _unique_email()
    payload = {"email": email, "password": "TestPass123!", "nickname": nickname}
    await client.post("/api/auth/register", json=payload)
    await client.post(
        "/api/auth/login", json={"email": email, "password": "TestPass123!"}
    )
    me = await client.get("/api/auth/me")
    return me.json()["user"]["id"]


async def _create_and_select_home(client: AsyncClient, name: str = "テストホーム") -> int:
    resp = await client.post("/api/homes", json={"name": name})
    home_id = resp.json()["id"]
    await client.post(f"/api/auth/home-login/{home_id}")
    return home_id


_DEFAULT_ANNOUNCE = {
    "title": "テストお知らせ",
    "content": "テスト内容です",
    "priority": "medium",
    "end_date": "2099-12-31",
}


# ─── GET /api/announces/{home_id} ─────────────────────────────────────────────


async def test_list_announces_empty(client: AsyncClient) -> None:
    """お知らせがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/announces/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_announces(client: AsyncClient) -> None:
    """お知らせ一覧を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    resp = await client.get(f"/api/announces/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テストお知らせ"
    assert "like_count" in data[0]
    assert "is_liked" in data[0]


async def test_list_announces_search(client: AsyncClient) -> None:
    """search パラメータでタイトル検索できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/announces", json={**_DEFAULT_ANNOUNCE, "title": "重要なお知らせ"})
    await client.post("/api/announces", json={**_DEFAULT_ANNOUNCE, "title": "通常連絡"})
    resp = await client.get(f"/api/announces/{home_id}", params={"search": "重要"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "重要なお知らせ"


async def test_list_announces_priority_filter(client: AsyncClient) -> None:
    """priority パラメータでフィルタできる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/announces", json={**_DEFAULT_ANNOUNCE, "priority": "high"})
    await client.post("/api/announces", json={**_DEFAULT_ANNOUNCE, "priority": "low"})
    resp = await client.get(f"/api/announces/{home_id}", params={"priority": "high"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["priority"] == "high"


async def test_list_announces_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのお知らせ一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    resp = await client.get(f"/api/announces/{other_home.id}")
    assert resp.status_code == 403


# ─── POST /api/announces ──────────────────────────────────────────────────────


async def test_create_announce(client: AsyncClient) -> None:
    """お知らせを作成すると 201 と作成データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "テストお知らせ"
    assert data["priority"] == "medium"
    assert data["like_count"] == 0
    assert data["is_liked"] is False


async def test_created_by_user_in_response(client: AsyncClient) -> None:
    """お知らせレスポンスに created_by_user（作成者情報）が含まれる"""
    await _register_and_login(client, nickname="作成者テスト")
    home_id = await _create_and_select_home(client)
    await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    resp = await client.get(f"/api/announces/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    creator = data[0]["created_by_user"]
    assert creator is not None
    assert creator["nickname"] == "作成者テスト"
    assert "id" in creator
    assert "icon_url" in creator


async def test_created_by_user_in_detail(client: AsyncClient) -> None:
    """お知らせ詳細レスポンスにも created_by_user が含まれる"""
    await _register_and_login(client, nickname="詳細テストユーザー")
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    resp = await client.get(f"/api/announces/{announce_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    creator = data["created_by_user"]
    assert creator is not None
    assert creator["nickname"] == "詳細テストユーザー"


async def test_create_announce_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    assert resp.status_code == 401


# ─── GET /api/announces/{id}/detail ──────────────────────────────────────────


async def test_get_announce_detail(client: AsyncClient) -> None:
    """お知らせ詳細を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    resp = await client.get(f"/api/announces/{announce_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "テストお知らせ"
    assert "like_count" in data
    assert "is_liked" in data


async def test_get_announce_detail_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのお知らせ詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    announce = Announce(
        home_id=other_home.id,
        title="他のお知らせ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
    )
    db.add(announce)
    await db.flush()
    resp = await client.get(f"/api/announces/{announce.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/announces/{id} ──────────────────────────────────────────────────


async def test_update_announce(client: AsyncClient) -> None:
    """お知らせを更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/announces/{announce_id}",
        json={**_DEFAULT_ANNOUNCE, "title": "更新後タイトル"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "更新後タイトル"


async def test_update_announce_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのお知らせ更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    announce = Announce(
        home_id=other_home.id,
        title="他のお知らせ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
    )
    db.add(announce)
    await db.flush()
    resp = await client.put(
        f"/api/announces/{announce.id}",
        json={**_DEFAULT_ANNOUNCE, "title": "変更試み"},
    )
    assert resp.status_code == 403


# ─── DELETE /api/announces/{id} ───────────────────────────────────────────────


async def test_delete_announce(client: AsyncClient) -> None:
    """お知らせを削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/announces/{announce_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/announces/{home_id}")
    assert list_resp.json() == []


async def test_delete_announce_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのお知らせ削除は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    announce = Announce(
        home_id=other_home.id,
        title="他のお知らせ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
    )
    db.add(announce)
    await db.flush()
    resp = await client.delete(f"/api/announces/{announce.id}")
    assert resp.status_code == 403


# ─── POST /api/announces/{id}/like ────────────────────────────────────────────


async def test_toggle_like_on(client: AsyncClient) -> None:
    """いいねをONにできる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    resp = await client.post(f"/api/announces/{announce_id}/like")
    assert resp.status_code == 200
    data = resp.json()
    assert data["liked"] is True
    assert data["like_count"] == 1


async def test_toggle_like_off(client: AsyncClient) -> None:
    """いいねをON→OFFに切り替えられる（冪等に動作する）"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    await client.post(f"/api/announces/{announce_id}/like")
    resp = await client.post(f"/api/announces/{announce_id}/like")
    assert resp.status_code == 200
    data = resp.json()
    assert data["liked"] is False
    assert data["like_count"] == 0


async def test_toggle_like_detail_reflects_like(client: AsyncClient) -> None:
    """いいね後に詳細取得すると is_liked=True になる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    await client.post(f"/api/announces/{announce_id}/like")
    detail_resp = await client.get(f"/api/announces/{announce_id}/detail")
    data = detail_resp.json()
    assert data["is_liked"] is True
    assert data["like_count"] == 1


async def test_toggle_like_wrong_home(
    client: AsyncClient, db: AsyncSession
) -> None:
    """他ホームのお知らせへのいいねは 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    announce = Announce(
        home_id=other_home.id,
        title="他のお知らせ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
    )
    db.add(announce)
    await db.flush()
    resp = await client.post(f"/api/announces/{announce.id}/like")
    assert resp.status_code == 403


# ─── POST /api/announces/{id}/push ────────────────────────────────────────────


async def test_send_push(client: AsyncClient) -> None:
    """プッシュ通知エンドポイントは 204 を返す（Firebase未設定でも）"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    resp = await client.post(f"/api/announces/{announce_id}/push")
    assert resp.status_code == 204


async def test_send_push_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのお知らせへのプッシュは 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    announce = Announce(
        home_id=other_home.id,
        title="他のお知らせ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
    )
    db.add(announce)
    await db.flush()
    resp = await client.post(f"/api/announces/{announce.id}/push")
    assert resp.status_code == 403


# ─── アクティビティログ検証 ────────────────────────────────────────────────────


async def test_activity_log_on_create(client: AsyncClient, db: AsyncSession) -> None:
    """お知らせ作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("作成" in log.action for log in logs)


async def test_activity_log_on_update(client: AsyncClient, db: AsyncSession) -> None:
    """お知らせ更新でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    await client.put(
        f"/api/announces/{announce_id}", json={**_DEFAULT_ANNOUNCE, "title": "更新"}
    )
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("更新" in log.action for log in logs)


async def test_activity_log_on_delete(client: AsyncClient, db: AsyncSession) -> None:
    """お知らせ削除でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/announces", json=_DEFAULT_ANNOUNCE)
    announce_id = create_resp.json()["id"]
    await client.delete(f"/api/announces/{announce_id}")
    result = await db.execute(select(ActivityLog).where(ActivityLog.home_id == home_id))
    logs = result.scalars().all()
    assert any("削除" in log.action for log in logs)


# ─── 宛先（recipient_ids）機能 ────────────────────────────────────────────────


async def test_create_announce_with_recipients(client: AsyncClient) -> None:
    """recipient_ids を指定して作成すると、レスポンスにも含まれる"""
    user_id = await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post(
        "/api/announces",
        json={**_DEFAULT_ANNOUNCE, "recipient_ids": [user_id]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["recipient_ids"] == [user_id]


async def test_list_announces_no_recipients_visible_to_all(client: AsyncClient) -> None:
    """recipient_ids が空のお知らせは全員に表示される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/announces", json={**_DEFAULT_ANNOUNCE, "recipient_ids": []})
    resp = await client.get(f"/api/announces/{home_id}")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_list_announces_recipient_filter(
    client: AsyncClient, db: AsyncSession
) -> None:
    """宛先指定のお知らせは宛先ユーザーにのみ表示される"""
    user1_id = await _register_and_login(client, email="recip1@example.com", nickname="user1")
    home_id = await _create_and_select_home(client)

    # user2 を同ホームに招待コードで追加
    invite_resp = await client.get(f"/api/homes/{home_id}/invitation-code")
    code = invite_resp.json()["code"]

    # user2 でログインしてホームに参加
    user2_id = await _register_and_login(client, email="recip2@example.com", nickname="user2")
    await client.post(f"/api/homes/join/{code}")
    await client.post(f"/api/auth/home-login/{home_id}")

    # user2 として user1 宛のお知らせを直接DBに作成
    announce = Announce(
        home_id=home_id,
        title="user1宛お知らせ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
        created_by=user1_id,
    )
    db.add(announce)
    await db.flush()
    db.add(AnnounceRecipient(announce_id=announce.id, user_id=user1_id))
    await db.flush()

    # user2 は一覧に表示されない
    resp_user2 = await client.get(f"/api/announces/{home_id}")
    assert resp_user2.status_code == 200
    assert all(a["id"] != announce.id for a in resp_user2.json())

    # user1 に切り替えて確認
    await _register_and_login(client, email="recip1@example.com")
    await client.post(f"/api/auth/home-login/{home_id}")
    resp_user1 = await client.get(f"/api/announces/{home_id}")
    assert resp_user1.status_code == 200
    assert any(a["id"] == announce.id for a in resp_user1.json())


async def test_get_announce_detail_not_in_recipients(
    client: AsyncClient, db: AsyncSession
) -> None:
    """宛先に含まれないユーザーが詳細を取得しようとすると 403"""
    user1_id = await _register_and_login(client, email="detail1@example.com", nickname="u1")
    home_id = await _create_and_select_home(client)

    invite_resp = await client.get(f"/api/homes/{home_id}/invitation-code")
    code = invite_resp.json()["code"]

    await _register_and_login(client, email="detail2@example.com", nickname="u2")
    await client.post(f"/api/homes/join/{code}")
    await client.post(f"/api/auth/home-login/{home_id}")

    announce = Announce(
        home_id=home_id,
        title="user1宛のみ",
        content="内容",
        priority="medium",
        end_date=date(2099, 12, 31),
        created_by=user1_id,
    )
    db.add(announce)
    await db.flush()
    db.add(AnnounceRecipient(announce_id=announce.id, user_id=user1_id))
    await db.flush()

    # user2（非宛先）が詳細取得 → 403
    resp = await client.get(f"/api/announces/{announce.id}/detail")
    assert resp.status_code == 403


async def test_update_announce_recipients(client: AsyncClient) -> None:
    """更新で recipient_ids を変更できる"""
    user_id = await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post(
        "/api/announces",
        json={**_DEFAULT_ANNOUNCE, "recipient_ids": [user_id]},
    )
    announce_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/announces/{announce_id}",
        json={**_DEFAULT_ANNOUNCE, "recipient_ids": []},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["recipient_ids"] == []


async def test_delete_announce_with_recipients(
    client: AsyncClient, db: AsyncSession
) -> None:
    """宛先付きお知らせを削除すると recipients もカスケード削除される"""
    user_id = await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post(
        "/api/announces",
        json={**_DEFAULT_ANNOUNCE, "recipient_ids": [user_id]},
    )
    announce_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/announces/{announce_id}")
    assert del_resp.status_code == 204

    remaining = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(AnnounceRecipient)
        .where(AnnounceRecipient.announce_id == announce_id)
    )
    assert remaining.scalars().all() == []


# ─── プッシュ通知 ──────────────────────────────────────────────────────────────


async def test_create_announce_sends_push_to_recipients(client: AsyncClient) -> None:
    """宛先ありお知らせ作成時に send_push_to_users が呼ばれる"""
    user_id = await _register_and_login(client)
    await _create_and_select_home(client)

    mock_batch = MagicMock(responses=[])
    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("firebase_admin.messaging.send_each", return_value=mock_batch),
        patch("app.features.announces.service.send_push_to_users") as mock_push,
    ):
        resp = await client.post(
            "/api/announces",
            json={**_DEFAULT_ANNOUNCE, "recipient_ids": [user_id]},
        )
        assert resp.status_code == 201
        mock_push.assert_called_once()
        _, call_user_ids, title, _ = mock_push.call_args.args
        assert user_id in call_user_ids
        assert title == _DEFAULT_ANNOUNCE["title"]


async def test_create_announce_sends_push_to_home_when_no_recipients(
    client: AsyncClient,
) -> None:
    """宛先なしお知らせ作成時に send_push_to_home が呼ばれる"""
    await _register_and_login(client)
    await _create_and_select_home(client)

    with (
        patch.object(fcm_module, "_firebase_app", MagicMock()),
        patch("app.features.announces.service.send_push_to_home") as mock_push,
    ):
        resp = await client.post(
            "/api/announces",
            json={**_DEFAULT_ANNOUNCE, "recipient_ids": []},
        )
        assert resp.status_code == 201
        mock_push.assert_called_once()
