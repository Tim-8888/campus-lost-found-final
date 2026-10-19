from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}


@router.get("/database")
def database_health(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        version = db.execute(text("SELECT VERSION()" if db.bind.dialect.name == "mysql" else "SELECT sqlite_version()" )).scalar_one()
        return {"status": "ok", "database": "connected", "version": str(version)}
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database connection failed") from exc
