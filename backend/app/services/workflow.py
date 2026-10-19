from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, Profile, ReportStatusHistory

CLAIM_NOTIFICATION_TYPES = {
    "CLAIM_SUBMITTED",
    "CLAIM_APPROVED",
    "CLAIM_REJECTED",
    "CLAIM_WITHDRAWN",
}
HANDOVER_NOTIFICATION_TYPES = {"HANDOVER_READY", "HANDOVER_COMPLETED"}
STATUS_NOTIFICATION_TYPES = {"REPORT_STATUS"}


def _notification_enabled(db: Session, user_id: int, notification_type: str) -> bool:
    profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
    if profile is None:
        return True
    if notification_type in CLAIM_NOTIFICATION_TYPES:
        return profile.notify_claim_updates
    if notification_type in HANDOVER_NOTIFICATION_TYPES:
        return profile.notify_handover
    if notification_type in STATUS_NOTIFICATION_TYPES:
        return profile.notify_status_changes
    return True


def add_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    link: str | None = None,
    notification_type: str = "SYSTEM",
) -> Notification | None:
    if not _notification_enabled(db, user_id, notification_type):
        return None
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notification)
    return notification


def add_status_history(
    db: Session,
    report_id: int,
    old_status: str,
    new_status: str,
    changed_by: int | None,
    reason: str | None = None,
) -> None:
    if old_status == new_status:
        return
    db.add(ReportStatusHistory(
        report_id=report_id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        reason=reason,
    ))
