from app.tasks.celery_app import celery_app


@celery_app.task
def run_monthly_settlement() -> None:
    pass
