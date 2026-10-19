from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Notification, User
from app.schemas.notification import NotificationCount, NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def response(item: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=item.id,
        notification_type=item.notification_type,
        title=item.title,
        message=item.message,
        link=item.link,
        is_read=item.is_read,
        created_at=item.created_at,
    )


@router.get("", response_model=list[NotificationResponse])
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(100)
    ).all()
    return [response(x) for x in items]


@router.get("/unread-count", response_model=NotificationCount)
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id, Notification.is_read.is_(False))) or 0
    return NotificationCount(unread=count)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if item is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True
    db.commit(); db.refresh(item)
    return response(item)


@router.post("/read-all", status_code=204)
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
