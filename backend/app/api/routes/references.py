from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Category, Location
from app.schemas.reference import ReferenceItem

router = APIRouter(prefix="/references", tags=["Reference Data"])


@router.get("/categories", response_model=list[ReferenceItem])
def categories(db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.name)).all()
    return [ReferenceItem(id=x.id, name=x.name) for x in rows]


@router.get("/locations", response_model=list[ReferenceItem])
def locations(db: Session = Depends(get_db)):
    rows = db.scalars(select(Location).where(Location.is_active.is_(True)).order_by(Location.name)).all()
    return [ReferenceItem(id=x.id, name=x.name) for x in rows]
