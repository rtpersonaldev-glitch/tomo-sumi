from app.tasks.celery_app import celery_app


@celery_app.task
def send_reminder_notifications() -> None:
    pass
