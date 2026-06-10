from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announce import Announce
from app.models.home import Home, HomeLink, InvitationCode
from app.models.schedule import Schedule

_SEQ = 0


def _unique_email() -> str:
    global _SEQ
    _SEQ += 1
    return f"user{_SEQ}@example.com"


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


# ─── GET /api/homes ───────────────────────────────────────────────────────────


async def test_list_homes_empty(client: AsyncClient) -> None:
    """所属ホームがない場合は空リストを返す"""
    await _register_and_login(client)
    resp = await client.get("/api/homes")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_homes(client: AsyncClient) -> None:
    """ホーム作成後にリストに表示される"""
    await _register_and_login(client)
    await client.post("/api/homes", json={"name": "マイホーム"})
    resp = await client.get("/api/homes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "マイホーム"


# ─── POST /api/homes ──────────────────────────────────────────────────────────


async def test_create_home(client: AsyncClient) -> None:
    """ホームを作成すると 201 と作成されたホームを返す"""
    await _register_and_login(client)
    resp = await client.post("/api/homes", json={"name": "新しいホーム"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "新しいホーム"
    assert "id" in data


async def test_create_home_unauthenticated(client: AsyncClient) -> None:
    """未認証時は 401 を返す"""
    resp = await client.post("/api/homes", json={"name": "ホーム"})
    assert resp.status_code == 401


# ─── GET /api/homes/{home_id} ─────────────────────────────────────────────────


async def test_get_home_detail(client: AsyncClient) -> None:
    """ホーム詳細を取得できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client, "詳細テストホーム")

    resp = await client.get(f"/api/homes/{home_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "詳細テストホーム"


async def test_get_home_not_member(client: AsyncClient, db: AsyncSession) -> None:
    """メンバーでないホームへのアクセスは 403"""
    await _register_and_login(client)
    other_home = Home(name="他人のホーム")
    db.add(other_home)
    await db.flush()

    resp = await client.get(f"/api/homes/{other_home.id}")
    assert resp.status_code == 403


# ─── PUT /api/homes/{home_id} ─────────────────────────────────────────────────


async def test_update_home_name(client: AsyncClient) -> None:
    """ホーム名を更新できる"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client, "更新前ホーム")

    resp = await client.put(f"/api/homes/{home_id}", data={"name": "更新後ホーム"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "更新後ホーム"


async def test_update_home_wrong_home(client: AsyncClient, db: AsyncSession) -> None:
    """選択中でないホームの更新は 403"""
    await _register_and_login(client)
    await _create_and_select_home(client)

    other_home = Home(name="他のホーム")
    db.add(other_home)
    await db.flush()

    resp = await client.put(f"/api/homes/{other_home.id}", data={"name": "変更"})
    assert resp.status_code == 403


# ─── GET /api/homes/{home_id}/users ───────────────────────────────────────────


async def test_get_home_members(client: AsyncClient) -> None:
    """ホームメンバー一覧を取得できる"""
    await _register_and_login(client, nickname="オーナー")
    home_id = await _create_and_select_home(client)

    resp = await client.get(f"/api/homes/{home_id}/users")
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) == 1
    assert members[0]["nickname"] == "オーナー"
    assert "status" in members[0]


# ─── GET /api/homes/{home_id}/invitation-code ─────────────────────────────────


async def test_get_invitation_code(client: AsyncClient) -> None:
    """招待コードを生成して返す"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)

    resp = await client.get(f"/api/homes/{home_id}/invitation-code")
    assert resp.status_code == 200
    data = resp.json()
    assert "code" in data
    assert "expires_at" in data
    assert len(data["code"]) > 0


# ─── POST /api/homes/join/{code} ──────────────────────────────────────────────


async def test_join_home(client: AsyncClient, db: AsyncSession) -> None:
    """招待コードでホームに参加できる"""
    user1_email = _unique_email()
    user2_email = _unique_email()

    # user1: ホームを作成して招待コードを取得
    await _register_and_login(client, email=user1_email, nickname="オーナー")
    home_id = await _create_and_select_home(client, "招待テストホーム")
    code_resp = await client.get(f"/api/homes/{home_id}/invitation-code")
    code = code_resp.json()["code"]

    # user2: 招待コードで参加
    await _register_and_login(client, email=user2_email, nickname="参加者")
    resp = await client.post(f"/api/homes/join/{code}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "招待テストホーム"

    # ホームにuser2が追加されているか確認
    link_result = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(HomeLink).where(
            HomeLink.home_id == home_id
        )
    )
    links = link_result.scalars().all()
    assert len(links) == 2


async def test_join_home_code_not_found(client: AsyncClient) -> None:
    """存在しない招待コードは 404"""
    await _register_and_login(client)
    resp = await client.post("/api/homes/join/no-such-code")
    assert resp.status_code == 404


async def test_join_home_used_code(client: AsyncClient, db: AsyncSession) -> None:
    """使用済み招待コードは 400"""
    await _register_and_login(client)
    home = Home(name="テストホーム")
    db.add(home)
    await db.flush()
    invitation = InvitationCode(
        home_id=home.id,
        code="used-code-xyz",
        used=True,
        expires_at=datetime.now(tz=UTC) + timedelta(hours=1),
    )
    db.add(invitation)
    await db.flush()

    resp = await client.post("/api/homes/join/used-code-xyz")
    assert resp.status_code == 400


async def test_join_home_expired_code(client: AsyncClient, db: AsyncSession) -> None:
    """期限切れ招待コードは 400"""
    await _register_and_login(client)
    home = Home(name="テストホーム")
    db.add(home)
    await db.flush()
    invitation = InvitationCode(
        home_id=home.id,
        code="expired-code-xyz",
        used=False,
        expires_at=datetime.now(tz=UTC) - timedelta(hours=1),
    )
    db.add(invitation)
    await db.flush()

    resp = await client.post("/api/homes/join/expired-code-xyz")
    assert resp.status_code == 400


async def test_join_home_already_member(client: AsyncClient) -> None:
    """既にメンバーのホームへの参加は 409"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)
    code_resp = await client.get(f"/api/homes/{home_id}/invitation-code")
    code = code_resp.json()["code"]

    resp = await client.post(f"/api/homes/join/{code}")
    assert resp.status_code == 409


# ─── GET /api/homes/dashboard ─────────────────────────────────────────────────


async def test_get_dashboard(client: AsyncClient, db: AsyncSession) -> None:
    """ダッシュボード情報（メンバー・スケジュール・お知らせ数）を返す"""
    await _register_and_login(client, nickname="ダッシュボードユーザー")
    home_id = await _create_and_select_home(client)

    now = datetime.now(tz=UTC)
    db.add(
        Schedule(
            home_id=home_id,
            title="今日の予定",
            memo="",
            start_day=now + timedelta(hours=2),
            end_day=now + timedelta(hours=3),
        )
    )
    db.add(
        Announce(
            home_id=home_id,
            title="お知らせ",
            content="テスト内容",
            priority="medium",
            end_date=(now + timedelta(days=5)).date(),
        )
    )
    await db.flush()

    resp = await client.get("/api/homes/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["members"]) == 1
    assert data["members"][0]["nickname"] == "ダッシュボードユーザー"
    assert len(data["today_schedules"]) == 1
    assert data["today_schedules"][0]["title"] == "今日の予定"
    assert data["unread_announce_count"] == 1


async def test_dashboard_today_schedules_excludes_yesterday(
    client: AsyncClient, db: AsyncSession
) -> None:
    """昨日のスケジュールは今日のスケジュールに表示されない"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)

    now = datetime.now(tz=UTC)
    yesterday = now - timedelta(days=1)
    db.add(
        Schedule(
            home_id=home_id,
            title="昨日の予定",
            memo="",
            start_day=yesterday,
            end_day=yesterday + timedelta(hours=1),
        )
    )
    await db.flush()

    resp = await client.get("/api/homes/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["today_schedules"]) == 0


async def test_dashboard_today_schedules_excludes_tomorrow(
    client: AsyncClient, db: AsyncSession
) -> None:
    """明日のスケジュールは今日のスケジュールに表示されない"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)

    now = datetime.now(tz=UTC)
    tomorrow = now + timedelta(days=1)
    db.add(
        Schedule(
            home_id=home_id,
            title="明日の予定",
            memo="",
            start_day=tomorrow,
            end_day=tomorrow + timedelta(hours=1),
        )
    )
    await db.flush()

    resp = await client.get("/api/homes/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["today_schedules"]) == 0


async def test_dashboard_today_schedules_includes_past_start_today(
    client: AsyncClient, db: AsyncSession
) -> None:
    """今日の開始済み（現在時刻より前）のスケジュールも表示される"""
    await _register_and_login(client)
    home_id = await _create_and_select_home(client)

    now = datetime.now(tz=UTC)
    today_start = datetime(now.year, now.month, now.day, tzinfo=UTC)
    db.add(
        Schedule(
            home_id=home_id,
            title="今日早朝の予定",
            memo="",
            start_day=today_start,
            end_day=today_start + timedelta(hours=1),
        )
    )
    await db.flush()

    resp = await client.get("/api/homes/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["today_schedules"]) == 1
    assert data["today_schedules"][0]["title"] == "今日早朝の予定"


async def test_get_dashboard_no_home(client: AsyncClient) -> None:
    """ホーム未選択時は 403"""
    await _register_and_login(client)
    resp = await client.get("/api/homes/dashboard")
    assert resp.status_code == 403


# ─── 招待フロー全体 ────────────────────────────────────────────────────────────


async def test_full_home_invite_flow(client: AsyncClient) -> None:
    """ホーム作成 → 招待コード発行 → 参加 → メンバー確認の一連フロー"""
    user1_email = _unique_email()
    user2_email = _unique_email()

    # user1 がホームを作成
    await _register_and_login(client, email=user1_email, nickname="ホストユーザー")
    home_id = await _create_and_select_home(client, "フローテストホーム")

    # 招待コードを発行
    code_resp = await client.get(f"/api/homes/{home_id}/invitation-code")
    assert code_resp.status_code == 200
    code = code_resp.json()["code"]

    # user2 が参加
    await _register_and_login(client, email=user2_email, nickname="ゲストユーザー")
    join_resp = await client.post(f"/api/homes/join/{code}")
    assert join_resp.status_code == 200

    # user2 がホームを選択してメンバー確認
    await client.post(f"/api/auth/home-login/{home_id}")
    members_resp = await client.get(f"/api/homes/{home_id}/users")
    assert members_resp.status_code == 200
    nicknames = {m["nickname"] for m in members_resp.json()}
    assert "ホストユーザー" in nicknames
    assert "ゲストユーザー" in nicknames
