from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_roles
from app.api.routes.reports import public_response
from app.db.session import get_db
from app.models import Claim, HandoverRecord, Report, User
from app.schemas.claim import ClaimReview, HandoverCreate, StaffClaimResponse
from app.services.workflow import add_notification, add_status_history

router = APIRouter(prefix="/staff", tags=["Staff"])


def load_staff_claim(db: Session, claim_id: int) -> Claim | None:
    return db.scalar(
        select(Claim)
        .where(Claim.id == claim_id)
        .options(
            selectinload(Claim.report).selectinload(Report.images),
            selectinload(Claim.report).selectinload(Report.category),
            selectinload(Claim.report).selectinload(Report.location),
            selectinload(Claim.report).selectinload(Report.user),
            selectinload(Claim.claimant).selectinload(User.profile),
            selectinload(Claim.handover),
        )
    )


def staff_response(claim: Claim) -> StaffClaimResponse:
    profile = claim.claimant.profile
    claimant_name = f"{profile.first_name} {profile.last_name}".strip() if profile else claim.claimant.email
    return StaffClaimResponse(
        id=claim.id,
        report=public_response(claim.report),
        claimant_id=claim.claimant_id,
        status=claim.status,
        verification_answer=claim.verification_answer,
        message=claim.message,
        staff_note=claim.staff_note,
        reviewed_at=claim.reviewed_at,
        handed_over_at=claim.handover.handed_over_at if claim.handover else None,
        created_at=claim.created_at,
        updated_at=claim.updated_at,
        claimant_email=claim.claimant.email,
        claimant_name=claimant_name,
        report_owner_email=claim.report.user.email,
        report_special_features=claim.report.special_features,
        report_verification_question=claim.report.verification_question,
        report_storage_note=claim.report.storage_note,
    )


@router.get("/claims", response_model=list[StaffClaimResponse])
def list_claims(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(PENDING|APPROVED|REJECTED|WITHDRAWN|COMPLETED)$"),
    user: User = Depends(require_roles("STAFF", "ADMIN")),
    db: Session = Depends(get_db),
):
    stmt = select(Claim)
    if status_filter:
        stmt = stmt.where(Claim.status == status_filter)
    claims = db.scalars(
        stmt.options(
            selectinload(Claim.report).selectinload(Report.images),
            selectinload(Claim.report).selectinload(Report.category),
            selectinload(Claim.report).selectinload(Report.location),
            selectinload(Claim.report).selectinload(Report.user),
            selectinload(Claim.claimant).selectinload(User.profile),
            selectinload(Claim.handover),
        ).order_by(Claim.created_at.desc())
    ).all()
    return [staff_response(x) for x in claims]


@router.get("/claims/{claim_id}", response_model=StaffClaimResponse)
def get_claim(claim_id: int, user: User = Depends(require_roles("STAFF", "ADMIN")), db: Session = Depends(get_db)):
    claim = load_staff_claim(db, claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    return staff_response(claim)


@router.post("/claims/{claim_id}/review", response_model=StaffClaimResponse)
def review_claim(
    claim_id: int,
    payload: ClaimReview,
    user: User = Depends(require_roles("STAFF", "ADMIN")),
    db: Session = Depends(get_db),
):
    claim = load_staff_claim(db, claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only pending Claims can be reviewed")

    claim.status = payload.decision
    claim.reviewed_by = user.id
    claim.staff_note = payload.staff_note.strip() if payload.staff_note else None
    claim.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if payload.storage_note is not None:
        claim.report.storage_note = payload.storage_note.strip() or None

    if payload.decision == "APPROVED":
        old_status = claim.report.status
        claim.report.status = "CLOSED"
        add_status_history(db, claim.report.id, old_status, "CLOSED", user.id, f"Claim #{claim.id} approved")
        other_claims = db.scalars(
            select(Claim).where(
                Claim.report_id == claim.report_id,
                Claim.id != claim.id,
                Claim.status == "PENDING",
            )
        ).all()
        for other in other_claims:
            other.status = "REJECTED"
            other.reviewed_by = user.id
            other.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            other.staff_note = "Another Claim for this item was approved."
            add_notification(
                db,
                other.claimant_id,
                "Claim not approved",
                f"Your Claim #{other.id} was closed because another Claim for report #{claim.report_id} was approved.",
                "#/my-claims",
                notification_type="CLAIM_REJECTED",
            )
        add_notification(
            db,
            claim.claimant_id,
            "Claim approved",
            f"Your Claim #{claim.id} has been approved. Please follow the staff handover instructions.",
            "#/my-claims",
            notification_type="CLAIM_APPROVED",
        )
        add_notification(
            db,
            claim.report.user_id,
            "Claim approved by staff",
            f"Claim #{claim.id} for report #{claim.report_id} was approved and the report has been closed pending handover.",
            f"#/reports/{claim.report_id}",
            notification_type="CLAIM_APPROVED",
        )
    else:
        add_notification(
            db,
            claim.claimant_id,
            "Claim not approved",
            f"Your Claim #{claim.id} was not approved. Check My Claims for the staff note.",
            "#/my-claims",
            notification_type="CLAIM_REJECTED",
        )

    db.commit()
    claim = load_staff_claim(db, claim_id)
    return staff_response(claim)


@router.post("/claims/{claim_id}/handover", response_model=StaffClaimResponse)
def record_handover(
    claim_id: int,
    payload: HandoverCreate,
    user: User = Depends(require_roles("STAFF", "ADMIN")),
    db: Session = Depends(get_db),
):
    claim = load_staff_claim(db, claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "APPROVED":
        raise HTTPException(status_code=409, detail="Only an approved Claim can be handed over")
    if claim.handover is not None:
        raise HTTPException(status_code=409, detail="Handover has already been recorded")

    claim.handover = HandoverRecord(staff_id=user.id, note=payload.note.strip() if payload.note else None)
    claim.status = "COMPLETED"
    old_status = claim.report.status
    claim.report.status = "RETURNED"
    add_status_history(db, claim.report.id, old_status, "RETURNED", user.id, f"Item handed over for Claim #{claim.id}")
    add_notification(
        db,
        claim.claimant_id,
        "Item handover completed",
        f"The handover for Claim #{claim.id} has been recorded. The report is now Returned.",
        "#/my-claims",
        notification_type="HANDOVER_COMPLETED",
    )
    add_notification(
        db,
        claim.report.user_id,
        "Item returned",
        f"Report #{claim.report_id} has completed the handover process and is now marked Returned.",
        f"#/reports/{claim.report_id}",
        notification_type="HANDOVER_COMPLETED",
    )
    db.commit()
    claim = load_staff_claim(db, claim_id)
    return staff_response(claim)
