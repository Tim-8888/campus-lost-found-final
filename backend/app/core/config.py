from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "Campus Lost and Found API"
    app_env: str = "development"

    db_host: str = "localhost"
    db_port: int = 3306
    db_name: str = "campus_lost_found_dev"
    db_user: str = "lostfound_app"
    db_password: str = ""
    database_url: str | None = None

    jwt_secret_key: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
    access_token_expire_minutes: int = 120
    frontend_origin: str = "http://localhost:5173"
    max_image_size_mb: int = 5

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout_seconds: float = 20.0

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        return (
            f"mysql+pymysql://{user}:{password}@{self.db_host}:{self.db_port}/"
            f"{self.db_name}?charset=utf8mb4"
        )

    @property
    def upload_dir(self) -> Path:
        return BACKEND_DIR / "uploads"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
