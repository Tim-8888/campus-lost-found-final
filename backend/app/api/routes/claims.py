from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, require_roles
from app.api.routes.reports import load_report, public_response
from app.db.session import get_db
from app.models import Claim, Report, User
from app.schemas.claim import ClaimCreate, ClaimResponse, ReceivedClaimResponse
from app.services.workflow import add_notification

router = APIRouter(prefix="/claims", tags=["Claims"])


def load_claim(db: Session, claim_id: int) -> Claim | None:
    return db.scalar(
        select(Claim)
        .where(Claim.id == claim_id)
        .options(
            selectinload(Claim.report).selectinload(Report.images),
            selectinload(Claim.report).selectinload(Report.category),
            selectinload(Claim.report).selectinload(Report.location),
            selectinload(Claim.handover),
        )
    )


def claim_response(claim: Claim) -> ClaimResponse:
    return ClaimResponse(
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
    )


@router.post("/reports/{report_id}", response_model=ClaimResponse, status_code=status.HTTP_201_CREATED)
def submit_claim(
    report_id: int,
    payload: ClaimCreate,
    user: User = Depends(require_roles("STUDENT")),
    db: Session = Depends(get_db),
):
    report = load_report(db, report_id)
    if report is None or not report.is_public:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.report_type != "FOUND":
        raise HTTPException(status_code=400, detail="Claims can only be submitted for Found reports")
    if report.status != "OPEN":
        raise HTTPException(status_code=409, detail="This report is not open for Claims")
    if report.user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot Claim your own report")
    if not report.verification_question or not report.special_features:
        raise HTTPException(
            status_code=409,
            detail="This Found report is not ready for Claims because verification information is missing",
        )

    claim = Claim(
        report_id=report.id,
        claimant_id=user.id,
        verification_answer=payload.verification_answer.strip(),
        message=payload.message.strip() if payload.message else None,
        status="PENDING",
    )
    db.add(claim)
    add_notification(
        db,
        report.user_id,
        "New Claim submitted",
        f"A Claim has been submitted for your Found report #{report.id}. Staff will review the verification information.",
        f"#/reports/{report.id}",
        notification_type="CLAIM_SUBMITTED",
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already submitted a Claim for this report")
    claim = load_claim(db, claim.id)
    return claim_response(claim)


@router.get("/mine", response_model=list[ClaimResponse])
def my_claims(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    claims = db.scalars(
        select(Claim)
        .where(Claim.claimant_id == user.id)
        .options(
            selectinload(Claim.report).selectinload(Report.images),
            selectinload(Claim.report).selectinload(Report.category),
            selectinload(Claim.report).selectinload(Report.location),
            selectinload(Claim.handover),
        )
        .order_by(Claim.created_at.desc())
    ).all()
    return [claim_response(x) for x in claims]


@router.get("/received", response_model=list[ReceivedClaimResponse])
def claims_received_for_my_reports(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    claims = db.scalars(
        select(Claim)
        .join(Claim.report)
        .where(Report.user_id == user.id)
        .options(selectinload(Claim.report).selectinload(Report.category), selectinload(Claim.handover))
        .order_by(Claim.created_at.desc())
    ).all()
    return [
        ReceivedClaimResponse(
            id=x.id,
            report_id=x.report_id,
            report_category=x.report.category.name,
            status=x.status,
            created_at=x.created_at,
            reviewed_at=x.reviewed_at,
            handed_over_at=x.handover.handed_over_at if x.handover else None,
        )
        for x in claims
    ]


@router.post("/{claim_id}/withdraw", response_model=ClaimResponse)
def withdraw_claim(
    claim_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    claim = load_claim(db, claim_id)
    if claim is None or claim.claimant_id != user.id:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only a pending Claim can be withdrawn")
    claim.status = "WITHDRAWN"
    add_notification(
        db,
        claim.report.user_id,
        "Claim withdrawn",
        f"Claim #{claim.id} for report #{claim.report_id} was withdrawn by the claimant.",
        f"#/reports/{claim.report_id}",
        notification_type="CLAIM_WITHDRAWN",
    )
    db.commit()
    claim = load_claim(db, claim_id)
    return claim_response(claim)
