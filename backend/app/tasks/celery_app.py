from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_init

from app.core.config import settings


@worker_init.connect
def on_worker_init(**kwargs: object) -> None:
    from app.utils.fcm import init_firebase
    init_firebase()

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
    beat_schedule={
        "monthly-settlement": {
            "task": "app.tasks.cost_tasks.run_monthly_settlement",
            "schedule": crontab(minute=59, hour=23),
        },
        "reminder-notifications": {
            "task": "app.tasks.reminder_tasks.send_reminder_notifications",
            "schedule": crontab(minute="*/5"),
        },
    },
)
