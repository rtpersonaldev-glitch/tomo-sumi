from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "tomo_sumi",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.cost_tasks", "app.tasks.reminder_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Tokyo",
    enable_utc=True,
)
