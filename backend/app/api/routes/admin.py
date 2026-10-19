from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_roles
from app.db.session import get_db
from app.models import Category, Claim, Location, Report, ReportFlag, User
from app.schemas.admin import (
    AdminReferenceResponse,
    AdminReportResponse,
    AdminStats,
    AdminUserResponse,
    AdminUserUpdate,
    ReferenceCreate,
    ReferenceUpdate,
    VisibilityUpdate,
)
from app.schemas.moderation import FlagResolve, FlagResponse
from app.services.workflow import add_notification

router = APIRouter(prefix="/admin", tags=["Administrator"])


def flag_response(flag: ReportFlag) -> FlagResponse:
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


@router.get("/stats", response_model=AdminStats)
def stats(user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    scalar_count = lambda stmt: db.scalar(stmt) or 0
    matched_reports = scalar_count(
        select(func.count(func.distinct(Claim.report_id))).where(
            Claim.status.in_(["APPROVED", "COMPLETED"])
        )
    )
    return AdminStats(
        total_users=scalar_count(select(func.count(User.id))),
        active_users=scalar_count(select(func.count(User.id)).where(User.is_active.is_(True))),
        lost_reports=scalar_count(select(func.count(Report.id)).where(Report.report_type == "LOST")),
        found_reports=scalar_count(select(func.count(Report.id)).where(Report.report_type == "FOUND")),
        matched_reports=matched_reports,
        recovered_items=scalar_count(select(func.count(Report.id)).where(Report.status == "RETURNED")),
        unresolved_cases=scalar_count(select(func.count(Report.id)).where(Report.status == "OPEN")),
        total_claims=scalar_count(select(func.count(Claim.id))),
        pending_claims=scalar_count(select(func.count(Claim.id)).where(Claim.status == "PENDING")),
        completed_claims=scalar_count(select(func.count(Claim.id)).where(Claim.status == "COMPLETED")),
        open_flags=scalar_count(select(func.count(ReportFlag.id)).where(ReportFlag.status == "OPEN")),
    )


@router.get("/users", response_model=list[AdminUserResponse])
def users(user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    items = db.scalars(select(User).options(selectinload(User.profile)).order_by(User.created_at.desc())).all()
    return [AdminUserResponse(
        id=x.id,
        email=x.email,
        role=x.role,
        is_active=x.is_active,
        first_name=x.profile.first_name if x.profile else "",
        last_name=x.profile.last_name if x.profile else "",
        created_at=x.created_at,
    ) for x in items]


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    admin: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    target = db.scalar(select(User).where(User.id == user_id).options(selectinload(User.profile)))
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if target.id == admin.id and (data.get("role") not in (None, "ADMIN") or data.get("is_active") is False):
        raise HTTPException(status_code=400, detail="You cannot remove your own administrator access")
    for field, value in data.items():
        setattr(target, field, value)
    db.commit(); db.refresh(target)
    return AdminUserResponse(
        id=target.id, email=target.email, role=target.role, is_active=target.is_active,
        first_name=target.profile.first_name if target.profile else "",
        last_name=target.profile.last_name if target.profile else "", created_at=target.created_at,
    )


def reference_response(item, report_count: int) -> AdminReferenceResponse:
    return AdminReferenceResponse(id=item.id, name=item.name, is_active=item.is_active, report_count=report_count)


@router.get("/categories", response_model=list[AdminReferenceResponse])
def categories(user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Category, func.count(Report.id)).outerjoin(Report, Report.category_id == Category.id).group_by(Category.id).order_by(Category.name)
    ).all()
    return [reference_response(item, count) for item, count in rows]


@router.post("/categories", response_model=AdminReferenceResponse, status_code=status.HTTP_201_CREATED)
def create_category(payload: ReferenceCreate, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    item = Category(name=payload.name.strip(), is_active=True); db.add(item)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(status_code=409, detail="Category already exists")
    db.refresh(item); return reference_response(item, 0)


@router.patch("/categories/{item_id}", response_model=AdminReferenceResponse)
def update_category(item_id: int, payload: ReferenceUpdate, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    item = db.get(Category, item_id)
    if item is None: raise HTTPException(status_code=404, detail="Category not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data: data["name"] = data["name"].strip()
    for field, value in data.items(): setattr(item, field, value)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(status_code=409, detail="Category name already exists")
    count = db.scalar(select(func.count(Report.id)).where(Report.category_id == item.id)) or 0
    return reference_response(item, count)


@router.get("/locations", response_model=list[AdminReferenceResponse])
def locations(user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Location, func.count(Report.id)).outerjoin(Report, Report.location_id == Location.id).group_by(Location.id).order_by(Location.name)
    ).all()
    return [reference_response(item, count) for item, count in rows]


@router.post("/locations", response_model=AdminReferenceResponse, status_code=status.HTTP_201_CREATED)
def create_location(payload: ReferenceCreate, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    item = Location(name=payload.name.strip(), is_active=True); db.add(item)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(status_code=409, detail="Location already exists")
    db.refresh(item); return reference_response(item, 0)


@router.patch("/locations/{item_id}", response_model=AdminReferenceResponse)
def update_location(item_id: int, payload: ReferenceUpdate, user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    item = db.get(Location, item_id)
    if item is None: raise HTTPException(status_code=404, detail="Location not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data: data["name"] = data["name"].strip()
    for field, value in data.items(): setattr(item, field, value)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(status_code=409, detail="Location name already exists")
    count = db.scalar(select(func.count(Report.id)).where(Report.location_id == item.id)) or 0
    return reference_response(item, count)


@router.get("/reports", response_model=list[AdminReportResponse])
def reports(user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    items = db.scalars(
        select(Report).options(selectinload(Report.user), selectinload(Report.category), selectinload(Report.location)).order_by(Report.created_at.desc()).limit(250)
    ).all()
    result = []
    for item in items:
        open_flags = db.scalar(select(func.count(ReportFlag.id)).where(ReportFlag.report_id == item.id, ReportFlag.status == "OPEN")) or 0
        result.append(AdminReportResponse(
            id=item.id, owner_email=item.user.email, report_type=item.report_type, category=item.category.name,
            location=item.location.name, colour=item.colour, status=item.status, is_public=item.is_public,
            open_flags=open_flags, created_at=item.created_at,
        ))
    return result


@router.patch("/reports/{report_id}/visibility", response_model=AdminReportResponse)
def update_visibility(
    report_id: int,
    payload: VisibilityUpdate,
    user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    item = db.scalar(select(Report).where(Report.id == report_id).options(selectinload(Report.user), selectinload(Report.category), selectinload(Report.location)))
    if item is None: raise HTTPException(status_code=404, detail="Report not found")
    item.is_public = payload.is_public
    add_notification(
        db,
        item.user_id,
        "Report visibility changed",
        f"An administrator changed the public visibility of report #{item.id}.",
        f"#/reports/{item.id}",
        notification_type="MODERATION",
    )
    db.commit()
    open_flags = db.scalar(select(func.count(ReportFlag.id)).where(ReportFlag.report_id == item.id, ReportFlag.status == "OPEN")) or 0
    return AdminReportResponse(
        id=item.id, owner_email=item.user.email, report_type=item.report_type, category=item.category.name,
        location=item.location.name, colour=item.colour, status=item.status, is_public=item.is_public,
        open_flags=open_flags, created_at=item.created_at,
    )


@router.get("/flags", response_model=list[FlagResponse])
def flags(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(OPEN|RESOLVED|DISMISSED)$"),
    user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db),
):
    stmt = select(ReportFlag)
    if status_filter: stmt = stmt.where(ReportFlag.status == status_filter)
    items = db.scalars(stmt.order_by(ReportFlag.created_at.desc())).all()
    return [flag_response(x) for x in items]


@router.post("/flags/{flag_id}/resolve", response_model=FlagResponse)
def resolve_flag(
    flag_id: int,
    payload: FlagResolve,
    user: User = Depends(require_roles("ADMIN")),
    db: Session = Depends(get_db),
):
    flag = db.scalar(select(ReportFlag).where(ReportFlag.id == flag_id).options(selectinload(ReportFlag.report)))
    if flag is None: raise HTTPException(status_code=404, detail="Flag not found")
    if flag.status != "OPEN": raise HTTPException(status_code=409, detail="This flag has already been handled")
    flag.resolved_by = user.id
    flag.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None)
    flag.resolution_note = payload.note.strip() if payload.note else None
    if payload.action == "DISMISS":
        flag.status = "DISMISSED"
    else:
        flag.status = "RESOLVED"
        if payload.action == "HIDE_REPORT":
            flag.report.is_public = False
            add_notification(
                db,
                flag.report.user_id,
                "Report hidden after administrator review",
                f"Report #{flag.report_id} was hidden after a content review.",
                "#/my-reports",
                notification_type="MODERATION",
            )
    db.commit(); db.refresh(flag)
    return flag_response(flag)
