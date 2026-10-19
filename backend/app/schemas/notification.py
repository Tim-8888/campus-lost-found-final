from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    notification_type: str
    title: str
    message: str
    link: str | None
    is_read: bool
    created_at: datetime


class NotificationCount(BaseModel):
    unread: int
