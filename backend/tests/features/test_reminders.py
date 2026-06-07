from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.home import Home
from app.models.reminder import Reminder

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"reminder_user{_SEQ}@example.com"


async def _register_and_login(
    client: AsyncClient,
    email: str | None = None,
    nickname: str = "テストユーザー",
) -> int:
    email = email or _unique_email()
    payload = {"email": email, "password": "TestPass123!", "nickname": nickname}
    await client.post("/api/auth/register", json=payload)
    await client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    me = await client.get("/api/auth/me")
    return me.json()["user"]["id"]


async def _create_and_select_home(client: AsyncClient, name: str = "テストホーム") -> int:
    resp = await client.post("/api/homes", json={"name": name})
    home_id = resp.json()["id"]
    await client.post(f"/api/auth/home-login/{home_id}")
    return home_id


_DEFAULT_REMINDER = {"list_name": "テストリマインダー", "complete_flag": False}

_DEFAULT_CONTENT = {
    "title": "テスト内容",
    "memo": "メモ",
    "date": "2026-07-01",
    "time": "09:00:00",
    "repeat": "daily",
}


# ─── GET /api/reminders/{home_id} ─────────────────────────────────────────────


async def test_list_reminders_empty(client: AsyncClient) -> None:
    """リマインダーがない場合は空リストを返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    resp = await client.get(f"/api/reminders/{home_id}")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_reminders(client: AsyncClient) -> None:
    """リマインダーグループ一覧を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    resp = await client.get(f"/api/reminders/{home_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["list_name"] == "テストリマインダー"


async def test_list_reminders_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのリマインダー一覧は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    resp = await client.get(f"/api/reminders/{other_home.id}")
    assert resp.status_code == 403


# ─── POST /api/reminders ──────────────────────────────────────────────────────


async def test_create_reminder(client: AsyncClient) -> None:
    """リマインダーグループを作成すると 201 と作成データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    assert resp.status_code == 201
    data = resp.json()
    assert data["list_name"] == "テストリマインダー"
    assert data["complete_flag"] is False


async def test_create_reminder_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    assert resp.status_code == 401


# ─── GET /api/reminders/{id}/detail ──────────────────────────────────────────


async def test_get_reminder_detail(client: AsyncClient) -> None:
    """リマインダーグループ詳細を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    resp = await client.get(f"/api/reminders/{reminder_id}/detail")
    assert resp.status_code == 200
    assert resp.json()["list_name"] == "テストリマインダー"


async def test_get_reminder_detail_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのリマインダー詳細は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    reminder = Reminder(home_id=other_home.id, list_name="他のリマインダー", complete_flag=False)
    db.add(reminder)
    await db.flush()
    resp = await client.get(f"/api/reminders/{reminder.id}/detail")
    assert resp.status_code == 403


# ─── PUT /api/reminders/{id} ─────────────────────────────────────────────────


async def test_update_reminder(client: AsyncClient) -> None:
    """リマインダーグループを更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    resp = await client.put(
        f"/api/reminders/{reminder_id}",
        json={"list_name": "更新後リマインダー", "complete_flag": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["list_name"] == "更新後リマインダー"
    assert data["complete_flag"] is True


async def test_update_reminder_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのリマインダー更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    reminder = Reminder(home_id=other_home.id, list_name="他のリマインダー", complete_flag=False)
    db.add(reminder)
    await db.flush()
    resp = await client.put(
        f"/api/reminders/{reminder.id}",
        json={"list_name": "変更試み", "complete_flag": False},
    )
    assert resp.status_code == 403


# ─── DELETE /api/reminders/{id} ──────────────────────────────────────────────


async def test_delete_reminder(client: AsyncClient) -> None:
    """リマインダーグループを削除すると 204 を返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/reminders/{reminder_id}")
    assert resp.status_code == 204
    list_resp = await client.get(f"/api/reminders/{home_id}")
    assert list_resp.json() == []


async def test_delete_reminder_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """他ホームのリマインダー削除は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()
    reminder = Reminder(home_id=other_home.id, list_name="他のリマインダー", complete_flag=False)
    db.add(reminder)
    await db.flush()
    resp = await client.delete(f"/api/reminders/{reminder.id}")
    assert resp.status_code == 403


# ─── GET /api/reminders/{id}/contents ────────────────────────────────────────


async def test_list_reminder_contents_empty(client: AsyncClient) -> None:
    """リマインダー内容がない場合は空リストを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    resp = await client.get(f"/api/reminders/{reminder_id}/contents")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_reminder_contents(client: AsyncClient) -> None:
    """リマインダー内容一覧を返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    await client.post(f"/api/reminders/{reminder_id}/contents", json=_DEFAULT_CONTENT)
    resp = await client.get(f"/api/reminders/{reminder_id}/contents")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "テスト内容"


# ─── POST /api/reminders/{id}/contents ───────────────────────────────────────


async def test_create_reminder_content(client: AsyncClient) -> None:
    """リマインダー内容を作成すると 201 と作成データを返す"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    resp = await client.post(
        f"/api/reminders/{reminder_id}/contents", json=_DEFAULT_CONTENT
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "テスト内容"
    assert data["memo"] == "メモ"
    assert data["repeat"] == "daily"
    assert data["is_active"] is False


async def test_create_reminder_content_minimal(client: AsyncClient) -> None:
    """date/time/repeatなしでもリマインダー内容を作成できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    resp = await client.post(
        f"/api/reminders/{reminder_id}/contents",
        json={"title": "最小限内容"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "最小限内容"
    assert data["date"] is None
    assert data["time"] is None
    assert data["repeat"] is None


# ─── GET /api/reminders/contents/{content_id} ────────────────────────────────


async def test_get_reminder_content_detail(client: AsyncClient) -> None:
    """リマインダー内容詳細を取得できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    content_resp = await client.post(
        f"/api/reminders/{reminder_id}/contents", json=_DEFAULT_CONTENT
    )
    content_id = content_resp.json()["id"]
    resp = await client.get(f"/api/reminders/contents/{content_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "テスト内容"


# ─── PUT /api/reminders/contents/{content_id} ────────────────────────────────


async def test_update_reminder_content(client: AsyncClient) -> None:
    """リマインダー内容を更新できる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    content_resp = await client.post(
        f"/api/reminders/{reminder_id}/contents", json=_DEFAULT_CONTENT
    )
    content_id = content_resp.json()["id"]
    resp = await client.put(
        f"/api/reminders/contents/{content_id}",
        json={
            "title": "更新後内容",
            "memo": "更新メモ",
            "date": "2026-08-01",
            "time": "10:00:00",
            "repeat": "weekly",
            "is_active": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "更新後内容"
    assert data["is_active"] is True
    assert data["repeat"] == "weekly"


# ─── POST /api/reminders/contents/{content_id}/toggle ────────────────────────


async def test_toggle_reminder_content(client: AsyncClient) -> None:
    """完了フラグを切り替えられる"""
    await _register_and_login(client)
    await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    content_resp = await client.post(
        f"/api/reminders/{reminder_id}/contents", json=_DEFAULT_CONTENT
    )
    content_id = content_resp.json()["id"]
    assert content_resp.json()["is_active"] is False

    resp = await client.post(f"/api/reminders/contents/{content_id}/toggle")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    resp2 = await client.post(f"/api/reminders/contents/{content_id}/toggle")
    assert resp2.status_code == 200
    assert resp2.json()["is_active"] is False


# ─── アクティビティログ検証 ────────────────────────────────────────────────────


async def test_activity_log_on_create_reminder(client: AsyncClient) -> None:
    """リマインダー作成でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("作成" in log["action"] for log in logs)


async def test_activity_log_on_update_reminder(client: AsyncClient) -> None:
    """リマインダー更新でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    await client.put(
        f"/api/reminders/{reminder_id}",
        json={"list_name": "更新", "complete_flag": False},
    )
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("更新" in log["action"] for log in logs)


async def test_activity_log_on_delete_reminder(client: AsyncClient) -> None:
    """リマインダー削除でアクティビティログが記録される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    create_resp = await client.post("/api/reminders", json=_DEFAULT_REMINDER)
    reminder_id = create_resp.json()["id"]
    await client.delete(f"/api/reminders/{reminder_id}")
    logs_resp = await client.get(f"/api/activity/{home_id}")
    logs = logs_resp.json()
    assert any("削除" in log["action"] for log in logs)
