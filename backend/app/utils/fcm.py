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
        cred = credentials.Certificate(str(path))
        _firebase_app = firebase_admin.initialize_app(cred)


async def send_push_to_home(
    db: AsyncSession,
    home_id: int,
    title: str,
    body: str,
    exclude_user_id: int | None = None,
) -> None:
    if _firebase_app is None:
        return

    query = (
        select(FCMToken.token)
        .join(HomeLink, HomeLink.user_id == FCMToken.user_id)
        .where(
            HomeLink.home_id == home_id,
            HomeLink.deleted_at.is_(None),
        )
    )
    if exclude_user_id is not None:
        query = query.where(FCMToken.user_id != exclude_user_id)

    result = await db.execute(query)
    tokens = list(result.scalars().all())
    if not tokens:
        return

    messages = [
        messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=token,
        )
        for token in tokens
    ]

    batch_response = messaging.send_each(messages, app=_firebase_app)
    for i, resp in enumerate(batch_response.responses):
        if not resp.success:
            logger.warning(
                "FCM送信に失敗しました (token=%s): %s",
                tokens[i],
                resp.exception,
            )


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
        select(FCMToken.token).where(FCMToken.user_id.in_(target_ids))
    )
    tokens = list(result.scalars().all())
    if not tokens:
        return

    messages = [
        messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=token,
        )
        for token in tokens
    ]

    batch_response = messaging.send_each(messages, app=_firebase_app)
    for i, resp in enumerate(batch_response.responses):
        if not resp.success:
            logger.warning(
                "FCM送信に失敗しました (token=%s): %s",
                tokens[i],
                resp.exception,
            )
