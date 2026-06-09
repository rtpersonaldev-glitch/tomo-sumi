"""テストデータファクトリ

各モデルの典型的なインスタンスを生成するヘルパー。
DBセッションを受け取り、flush 済みのオブジェクトを返す。
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.announce import Announce
from app.models.cost import AutoSeisan, Cost, Koteihi, Seisan
from app.models.home import Home, HomeLink, InvitationCode
from app.models.post import Post
from app.models.reminder import Reminder, ReminderContent
from app.models.schedule import Schedule
from app.models.todo import Todo, TodoContent
from app.models.user import User


# ─── User ─────────────────────────────────────────────────────────────────────

_user_seq = 0


def _next_email(prefix: str = "user") -> str:
    global _user_seq
    _user_seq += 1
    return f"{prefix}{_user_seq}@factory.test"


async def make_user(
    db: AsyncSession,
    *,
    email: str | None = None,
    nickname: str = "テストユーザー",
    hashed_password: str = "hashed",
) -> User:
    user = User(
        email=email or _next_email(),
        hashed_password=hashed_password,
        nickname=nickname,
    )
    db.add(user)
    await db.flush()
    return user


# ─── Home ─────────────────────────────────────────────────────────────────────


async def make_home(
    db: AsyncSession,
    *,
    name: str = "テストホーム",
    owner: User | None = None,
) -> Home:
    home = Home(name=name)
    db.add(home)
    await db.flush()
    if owner is not None:
        db.add(HomeLink(user_id=owner.id, home_id=home.id))
        await db.flush()
    return home


async def make_home_with_members(
    db: AsyncSession,
    *,
    name: str = "テストホーム",
    member_count: int = 2,
) -> tuple[Home, list[User]]:
    """ホームと指定人数のメンバーを一括作成する"""
    home = Home(name=name)
    db.add(home)
    await db.flush()
    users: list[User] = []
    for i in range(member_count):
        user = User(
            email=_next_email(f"member{i}"),
            hashed_password="hashed",
            nickname=f"メンバー{i + 1}",
        )
        db.add(user)
        await db.flush()
        db.add(HomeLink(user_id=user.id, home_id=home.id))
        users.append(user)
    await db.flush()
    return home, users


async def make_invitation_code(
    db: AsyncSession,
    home: Home,
    *,
    code: str = "TEST-INVITE-CODE",
    used: bool = False,
    expires_in_hours: int = 24,
) -> InvitationCode:
    invitation = InvitationCode(
        home_id=home.id,
        code=code,
        used=used,
        expires_at=datetime.now(tz=UTC) + timedelta(hours=expires_in_hours),
    )
    db.add(invitation)
    await db.flush()
    return invitation


# ─── Announce ─────────────────────────────────────────────────────────────────


async def make_announce(
    db: AsyncSession,
    home: Home,
    *,
    title: str = "テストお知らせ",
    content: str = "テスト内容",
    priority: str = "medium",
    end_date: date | None = None,
) -> Announce:
    announce = Announce(
        home_id=home.id,
        title=title,
        content=content,
        priority=priority,
        end_date=end_date or date(2099, 12, 31),
    )
    db.add(announce)
    await db.flush()
    return announce


# ─── Schedule ─────────────────────────────────────────────────────────────────


async def make_schedule(
    db: AsyncSession,
    home: Home,
    *,
    title: str = "テストスケジュール",
    memo: str = "",
    start_offset_hours: int = 1,
    duration_hours: int = 2,
) -> Schedule:
    now = datetime.now(tz=UTC)
    schedule = Schedule(
        home_id=home.id,
        title=title,
        memo=memo,
        start_day=now + timedelta(hours=start_offset_hours),
        end_day=now + timedelta(hours=start_offset_hours + duration_hours),
    )
    db.add(schedule)
    await db.flush()
    return schedule


# ─── Todo ─────────────────────────────────────────────────────────────────────


async def make_todo(
    db: AsyncSession,
    home: Home,
    *,
    title: str = "テストTODO",
    complete_flag: bool = False,
    contents: list[str] | None = None,
) -> Todo:
    todo = Todo(home_id=home.id, title=title, complete_flag=complete_flag)
    db.add(todo)
    await db.flush()
    for text in contents or []:
        db.add(TodoContent(todo_id=todo.id, content=text, check_flag=False))
    await db.flush()
    return todo


# ─── Reminder ─────────────────────────────────────────────────────────────────


async def make_reminder(
    db: AsyncSession,
    home: Home,
    *,
    list_name: str = "テストリマインダー",
    complete_flag: bool = False,
) -> Reminder:
    reminder = Reminder(home_id=home.id, list_name=list_name, complete_flag=complete_flag)
    db.add(reminder)
    await db.flush()
    return reminder


async def make_reminder_content(
    db: AsyncSession,
    reminder: Reminder,
    *,
    title: str = "テスト内容",
    memo: str = "",
    notify_date: date | None = None,
    repeat: str | None = None,
    is_active: bool = False,
) -> ReminderContent:
    content = ReminderContent(
        reminder_id=reminder.id,
        title=title,
        memo=memo,
        date=notify_date,
        repeat=repeat,
        is_active=is_active,
    )
    db.add(content)
    await db.flush()
    return content


# ─── Post ─────────────────────────────────────────────────────────────────────


async def make_post(
    db: AsyncSession,
    home: Home,
    user: User,
    *,
    content: str = "テスト投稿",
) -> Post:
    post = Post(home_id=home.id, user_id=user.id, content={"text": content})
    db.add(post)
    await db.flush()
    return post


# ─── Cost ─────────────────────────────────────────────────────────────────────


async def make_cost(
    db: AsyncSession,
    home: Home,
    payer: User,
    *,
    amount: int = 3000,
    purchase_date: date | None = None,
    memo: str = "",
) -> Cost:
    cost = Cost(
        home_id=home.id,
        payer_user_id=payer.id,
        purchase_date=purchase_date or date.today(),
        amount=amount,
        payment_method="",
        memo=memo,
    )
    db.add(cost)
    await db.flush()
    return cost


async def make_auto_seisan(
    db: AsyncSession,
    home: Home,
    *,
    execute_flag: bool = True,
    seisan_day: int = 25,
) -> AutoSeisan:
    auto = AutoSeisan(home_id=home.id, execute_flag=execute_flag, seisan_day=seisan_day)
    db.add(auto)
    await db.flush()
    return auto


async def make_koteihi(
    db: AsyncSession,
    home: Home,
    payer: User,
    receiver: User,
    *,
    amount: int = 50000,
    memo: str = "家賃",
) -> Koteihi:
    koteihi = Koteihi(
        home_id=home.id,
        from_user_id=payer.id,
        to_user_id=receiver.id,
        amount=amount,
        memo=memo,
    )
    db.add(koteihi)
    await db.flush()
    return koteihi


async def make_seisan(
    db: AsyncSession,
    home: Home,
    *,
    title: str = "テスト清算",
    settled_date: date | None = None,
    complete_flag: bool = False,
) -> Seisan:
    seisan = Seisan(
        home_id=home.id,
        title=title,
        settled_date=settled_date or date.today(),
        complete_flag=complete_flag,
    )
    db.add(seisan)
    await db.flush()
    return seisan
