"""Cloud startup: wait for the database, migrate, seed references, serve.

Run a single Railway replica. This script never creates demo users or overwrites
existing users, reports, or claims. Use create_privileged_user for the first admin.
"""
import os
import time

from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import BACKEND_DIR, settings
from app.db.session import engine
from scripts.seed_reference_data import seed


def validate_cloud_settings():
    if (len(settings.jwt_secret_key) < 32
            or settings.jwt_secret_key.startswith(("CHANGE_THIS", "REPLACE_"))):
        raise SystemExit("Set JWT_SECRET_KEY to a private random value of at least 32 characters.")
    frontend_index = BACKEND_DIR.parent / "frontend" / "dist" / "index.html"
    if not frontend_index.is_file():
        raise SystemExit("The frontend build is missing. Deploy from the root Dockerfile.")


def initialize_database():
    for attempt in range(1, 31):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            break
        except SQLAlchemyError:
            if attempt == 30:
                raise SystemExit("Database connection failed. Check DB_* reference variables and MySQL status.") from None
            print(f"Waiting for the database ({attempt}/30)...", flush=True)
            time.sleep(2)

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    seed()
    print("Database migrations and reference data are ready.", flush=True)


def main():
    os.chdir(BACKEND_DIR)
    validate_cloud_settings()
    initialize_database()
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))


if __name__ == "__main__":
    main()
