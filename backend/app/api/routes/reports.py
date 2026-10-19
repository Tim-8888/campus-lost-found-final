from datetime import date
from pathlib import Path
import re
from uuid import uuid4
import shutil

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models import Category, Claim, Location, Report, ReportImage, User
from app.services.workflow import add_notification, add_status_history
from app.schemas.report import (
    ImageResponse,
    NamedItem,
    ReportCreate,
    ReportPrivate,
    ReportPublic,
    ReportUpdate,
    SearchResponse,
    StatusUpdate,
)

router = APIRouter(prefix="/reports", tags=["Reports"])
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def load_report(db: Session, report_id: int) -> Report | None:
    return db.scalar(
        select(Report)
        .where(Report.id == report_id)
        .options(selectinload(Report.images), selectinload(Report.category), selectinload(Report.location))
    )


def image_response(image: ReportImage) -> ImageResponse:
    normalized_path = image.file_path.replace("\\", "/")

    return ImageResponse(
        id=image.id,
        url=f"/uploads/{normalized_path}",
        original_name=image.original_name,
        mime_type=image.mime_type,
    )


def public_response(report: Report) -> ReportPublic:
    return ReportPublic(
        id=report.id,
        report_type=report.report_type,
        category=NamedItem(id=report.category.id, name=report.category.name),
        description=report.description,
        item_date=report.item_date,
        location=NamedItem(id=report.location.id, name=report.location.name),
        colour=report.colour,
        verification_question=report.verification_question,
        status=report.status,
        is_public=report.is_public,
        images=[image_response(x) for x in report.images],
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


def private_response(report: Report) -> ReportPrivate:
    return ReportPrivate(
        **public_response(report).model_dump(),
        user_id=report.user_id,
        special_features=report.special_features,
        storage_note=report.storage_note,
    )


def validate_references(db: Session, category_id: int, location_id: int) -> None:
    if db.scalar(select(Category).where(Category.id == category_id, Category.is_active.is_(True))) is None:
        raise HTTPException(status_code=400, detail="Invalid category")
    if db.scalar(select(Location).where(Location.id == location_id, Location.is_active.is_(True))) is None:
        raise HTTPException(status_code=400, detail="Invalid location")


def ensure_owner_or_admin(report: Report, user: User) -> None:
    if report.user_id != user.id and user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="You cannot manage this report")


def report_has_claim(db: Session, report_id: int) -> bool:
    return db.scalar(select(Claim.id).where(Claim.report_id == report_id).limit(1)) is not None


def ensure_evidence_mutable(db: Session, report: Report, user: User) -> None:
    if user.role == "ADMIN":
        return
    if report.status == "RETURNED":
        raise HTTPException(status_code=409, detail="A returned report can no longer be changed by its owner")
    if report_has_claim(db, report.id):
        raise HTTPException(
            status_code=409,
            detail="Report identification details and images cannot be changed after a Claim has been submitted",
        )


def validate_found_verification(report_type: str, question: str | None, special_features: str | None) -> None:
    if report_type != "FOUND":
        return
    if not question or len(question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Found reports require a verification question")
    if not special_features or len(special_features.strip()) < 3:
        raise HTTPException(status_code=400, detail="Found reports require a private expected verification detail")


@router.post("", response_model=ReportPrivate, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_references(db, payload.category_id, payload.location_id)
    validate_found_verification(payload.report_type, payload.verification_question, payload.special_features)
    report = Report(user_id=user.id, status="OPEN", **payload.model_dump())
    db.add(report)
    db.commit()
    report = load_report(db, report.id)
    return private_response(report)


@router.get("/mine", response_model=list[ReportPrivate])
def my_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reports = db.scalars(
        select(Report)
        .where(Report.user_id == user.id)
        .options(selectinload(Report.images), selectinload(Report.category), selectinload(Report.location))
        .order_by(Report.created_at.desc())
    ).all()
    return [private_response(x) for x in reports]


@router.get("/search", response_model=SearchResponse)
def search_reports(
    keyword: str | None = None,
    report_type: str | None = Query(default=None, pattern="^(LOST|FOUND)$"),
    category_id: int | None = None,
    location_id: int | None = None,
    colour: str | None = None,
    status_filter: str | None = Query(default=None, alias="status", pattern="^(OPEN|CLOSED|RETURNED)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    has_photo: bool | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    conditions = [Report.is_public.is_(True)]
    if report_type:
        conditions.append(Report.report_type == report_type)
    if category_id:
        conditions.append(Report.category_id == category_id)
    if location_id:
        conditions.append(Report.location_id == location_id)
    if colour:
        conditions.append(func.lower(Report.colour).like(f"%{colour.lower().strip()}%"))
    if status_filter:
        conditions.append(Report.status == status_filter)
    if date_from:
        conditions.append(Report.item_date >= date_from)
    if date_to:
        conditions.append(Report.item_date <= date_to)
    if has_photo is True:
        conditions.append(exists(select(ReportImage.id).where(ReportImage.report_id == Report.id)))
    elif has_photo is False:
        conditions.append(~exists(select(ReportImage.id).where(ReportImage.report_id == Report.id)))

    stmt = select(Report).join(Report.category).join(Report.location)
    count_stmt = select(func.count(Report.id)).join(Report.category).join(Report.location)
    if keyword and keyword.strip():
        # Support more than one keyword. Every keyword must match at least one
        # public searchable field, while each keyword can match a different field.
        tokens = re.findall(r"[a-z0-9]+", keyword.lower())[:8]
        keyword_conditions = []
        for token in tokens:
            term = f"%{token}%"
            keyword_conditions.append(or_(
                func.lower(Report.description).like(term),
                func.lower(Report.colour).like(term),
                func.lower(Category.name).like(term),
                func.lower(Location.name).like(term),
            ))
        if keyword_conditions:
            conditions.append(and_(*keyword_conditions))

    stmt = (
        stmt.where(*conditions)
        .options(selectinload(Report.images), selectinload(Report.category), selectinload(Report.location))
        .order_by(Report.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    total = db.scalar(count_stmt.where(*conditions)) or 0
    reports = db.scalars(stmt).all()
    return SearchResponse(total=total, items=[public_response(x) for x in reports])


@router.get("/{report_id}", response_model=ReportPublic)
def get_public_report(report_id: int, db: Session = Depends(get_db)):
    report = load_report(db, report_id)
    if report is None or not report.is_public:
        raise HTTPException(status_code=404, detail="Report not found")
    return public_response(report)


@router.get("/{report_id}/manage", response_model=ReportPrivate)
def get_manage_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ensure_owner_or_admin(report, user)
    return private_response(report)


@router.patch("/{report_id}", response_model=ReportPrivate)
def update_report(
    report_id: int,
    payload: ReportUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ensure_owner_or_admin(report, user)
    data = payload.model_dump(exclude_unset=True)
    protected_claim_fields = {
        "report_type", "category_id", "description", "item_date",
        "location_id", "colour", "special_features", "verification_question",
    }
    if protected_claim_fields & set(data):
        ensure_evidence_mutable(db, report, user)

    category_id = data.get("category_id", report.category_id)
    location_id = data.get("location_id", report.location_id)
    validate_references(db, category_id, location_id)

    next_type = data.get("report_type", report.report_type)
    next_question = data.get("verification_question", report.verification_question)
    next_special = data.get("special_features", report.special_features)
    validate_found_verification(next_type, next_question, next_special)
    for field, value in data.items():
        setattr(report, field, value)
    db.commit()
    report = load_report(db, report_id)
    return private_response(report)


@router.patch("/{report_id}/status", response_model=ReportPrivate)
def update_status(
    report_id: int,
    payload: StatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if user.role not in {"STAFF", "ADMIN"}:
        ensure_owner_or_admin(report, user)

    if payload.status == "RETURNED":
        raise HTTPException(
            status_code=403,
            detail="Returned status can only be set when staff complete an approved Claim handover",
        )
    if report.status == "RETURNED":
        raise HTTPException(
            status_code=409,
            detail="A returned report cannot be reopened through the normal status endpoint",
        )
    if payload.status == "OPEN":
        approved_claim = db.scalar(
            select(Claim.id).where(
                Claim.report_id == report.id,
                Claim.status.in_(["APPROVED", "COMPLETED"]),
            ).limit(1)
        )
        if approved_claim is not None:
            raise HTTPException(
                status_code=409,
                detail="This report is linked to an approved Claim and cannot be reopened",
            )

    old_status = report.status
    report.status = payload.status
    add_status_history(db, report.id, old_status, payload.status, user.id, "Manual status update")
    if user.id != report.user_id:
        add_notification(
            db,
            report.user_id,
            "Report status changed",
            f"Report #{report.id} was changed from {old_status} to {payload.status}.",
            f"#/reports/{report.id}",
            notification_type="REPORT_STATUS",
        )
    db.commit()
    report = load_report(db, report_id)
    return private_response(report)


@router.post("/{report_id}/mark-found", response_model=ReportPrivate)
def mark_lost_report_found(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Close a LOST report because the owner has found the item.

    LOST/FOUND remains the report type. Finding a previously lost item is a
    status change, so the report stays type LOST and moves from OPEN to CLOSED.
    RETURNED is still reserved for the Staff handover workflow on FOUND reports.
    """
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ensure_owner_or_admin(report, user)
    if report.report_type != "LOST":
        raise HTTPException(status_code=400, detail="Only Lost reports can be marked as found")
    if report.status == "RETURNED":
        raise HTTPException(status_code=409, detail="A returned report cannot be changed here")
    if report.status == "CLOSED":
        return private_response(report)

    old_status = report.status
    report.status = "CLOSED"
    add_status_history(db, report.id, old_status, "CLOSED", user.id, "Lost item marked as found")
    db.commit()
    report = load_report(db, report_id)
    return private_response(report)


@router.post("/{report_id}/images", response_model=ImageResponse, status_code=201)
async def upload_image(
    report_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ensure_owner_or_admin(report, user)
    ensure_evidence_mutable(db, report, user)
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed")

    max_bytes = settings.max_image_size_mb * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"Image must be {settings.max_image_size_mb} MB or smaller")

    extension = ALLOWED_IMAGE_TYPES[file.content_type]
    folder = settings.upload_dir / "reports" / str(report_id)
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    target = folder / filename
    target.write_bytes(content)

    relative = target.relative_to(settings.upload_dir).as_posix()
    image = ReportImage(
        report_id=report_id,
        file_path=relative,
        original_name=Path(file.filename or filename).name,
        mime_type=file.content_type,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image_response(image)


@router.delete("/{report_id}/images/{image_id}", status_code=204)
def delete_image(
    report_id: int,
    image_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ensure_owner_or_admin(report, user)
    ensure_evidence_mutable(db, report, user)
    image = db.scalar(select(ReportImage).where(ReportImage.id == image_id, ReportImage.report_id == report_id))
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    path = settings.upload_dir / image.file_path
    if path.exists():
        path.unlink()
    db.delete(image)
    db.commit()


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    ensure_owner_or_admin(report, user)
    if user.role != "ADMIN":
        if report.status == "RETURNED":
            raise HTTPException(status_code=409, detail="A returned report cannot be deleted by its owner")
        if report_has_claim(db, report.id):
            raise HTTPException(
                status_code=409,
                detail="A report that has Claim history cannot be deleted by its owner; close or hide it instead",
            )
    folder = settings.upload_dir / "reports" / str(report_id)
    db.delete(report)
    db.commit()
    if folder.exists():
        shutil.rmtree(folder, ignore_errors=True)
