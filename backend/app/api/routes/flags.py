from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Report, ReportFlag, User
from app.schemas.moderation import FlagCreate, FlagResponse
from app.services.workflow import add_notification

router = APIRouter(prefix="/flags", tags=["Content Flags"])


def response(flag: ReportFlag) -> FlagResponse:
    return FlagResponse(
        id=flag.id,
        report_id=flag.report_id,
        reporter_id=flag.reporter_id,
        reason=flag.reason,
        details=flag.details,
        status=flag.status,
        resolution_note=flag.resolution_note,
        created_at=flag.created_at,
        resolved_at=flag.resolved_at,
    )


@router.post("/reports/{report_id}", response_model=FlagResponse, status_code=status.HTTP_201_CREATED)
def flag_report(
    report_id: int,
    payload: FlagCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.scalar(select(Report).where(Report.id == report_id, Report.is_public.is_(True)))
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot flag your own report")
    flag = ReportFlag(
        report_id=report_id,
        reporter_id=user.id,
        reason=payload.reason,
        details=payload.details.strip() if payload.details else None,
    )
    db.add(flag)
    add_notification(
        db,
        report.user_id,
        "Report received a content flag",
        f"Report #{report.id} has been flagged for administrator review. No action has been taken yet.",
        f"#/reports/{report.id}",
        notification_type="MODERATION",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already flagged this report")
    db.refresh(flag)
    return response(flag)


@router.get("/mine", response_model=list[FlagResponse])
def my_flags(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    flags = db.scalars(select(ReportFlag).where(ReportFlag.reporter_id == user.id).order_by(ReportFlag.created_at.desc())).all()
    return [response(x) for x in flags]
