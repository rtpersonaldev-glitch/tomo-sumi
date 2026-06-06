from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    APP_NAME: str = "Tomo-sumi"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://tomo:tomo@db:5432/tomo_dev"
    REDIS_URL: str = "redis://redis:6379/0"

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase_service_account.json"

    MEDIA_ROOT: str = "media"
    MEDIA_BASE_URL: str = "http://localhost:8000/media"


settings = Settings()
