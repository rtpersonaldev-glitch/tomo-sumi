import logging
from collections.abc import Collection
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.home import HomeLink
from app.models.user import FCMToken

logger = logging.getLogger(__name__)

_firebase_app: firebase_admin.App | None = None


def init_firebase() -> None:
    global _firebase_app
    path = Path(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    if not path.exists():
        logger.warning(
            "Firebase service account not found at %s — push notifications disabled",
            path,
        )
        return
    try:
        _firebase_app = firebase_admin.get_app()
    except ValueError:
        try:
            cred = credentials.Certificate(str(path))
            _firebase_app = firebase_admin.initialize_app(cred)
        except Exception as exc:
            logger.warning(
                "Firebase初期化に失敗しました: %s — push notifications disabled", exc
            )


async def send_push_to_home(
    db: AsyncSession,
    home_id: int,
    title: str,
    body: str,
    exclude_user_id: int | None = None,
) -> None:
    if _firebase_app is None:
        logger.warning("Firebase未初期化のためプッシュ通知をスキップしました (home_id=%d)", home_id)
        return

    query = (
        select(FCMToken)
        .join(HomeLink, HomeLink.user_id == FCMToken.user_id)
        .where(
            HomeLink.home_id == home_id,
            HomeLink.deleted_at.is_(None),
        )
    )
    if exclude_user_id is not None:
        query = query.where(FCMToken.user_id != exclude_user_id)

    result = await db.execute(query)
    token_rows = list(result.scalars().all())
    if not token_rows:
        return

    messages = [
        messaging.Message(
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="/vite.svg",
                )
            ),
            token=row.token,
        )
        for row in token_rows
    ]

    batch_response = messaging.send_each(messages, app=_firebase_app)
    stale_ids: list[int] = []
    for i, resp in enumerate(batch_response.responses):
        if not resp.success:
            err = str(resp.exception)
            logger.warning(
                "FCM送信に失敗しました (token=%s): %s",
                token_rows[i].token,
                err,
            )
            if "NOT_FOUND" in err or "UNREGISTERED" in err or "NotRegistered" in err:
                stale_ids.append(token_rows[i].id)

    if stale_ids:
        from sqlalchemy import delete as sa_delete
        await db.execute(sa_delete(FCMToken).where(FCMToken.id.in_(stale_ids)))
        logger.info("無効なFCMトークンを削除しました: %d 件", len(stale_ids))


async def send_push_to_users(
    db: AsyncSession,
    user_ids: Collection[int],
    title: str,
    body: str,
    exclude_user_id: int | None = None,
) -> None:
    if _firebase_app is None:
        return

    target_ids = set(user_ids)
    if exclude_user_id is not None:
        target_ids.discard(exclude_user_id)
    if not target_ids:
        return

    result = await db.execute(
        select(FCMToken).where(FCMToken.user_id.in_(target_ids))
    )
    token_rows = list(result.scalars().all())
    if not token_rows:
        return

    messages = [
        messaging.Message(
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="/vite.svg",
                )
            ),
            token=row.token,
        )
        for row in token_rows
    ]

    batch_response = messaging.send_each(messages, app=_firebase_app)
    stale_ids: list[int] = []
    for i, resp in enumerate(batch_response.responses):
        if not resp.success:
            err = str(resp.exception)
            logger.warning(
                "FCM送信に失敗しました (token=%s): %s",
                token_rows[i].token,
                err,
            )
            if "NOT_FOUND" in err or "UNREGISTERED" in err or "NotRegistered" in err:
                stale_ids.append(token_rows[i].id)

    if stale_ids:
        from sqlalchemy import delete as sa_delete
        await db.execute(sa_delete(FCMToken).where(FCMToken.id.in_(stale_ids)))
