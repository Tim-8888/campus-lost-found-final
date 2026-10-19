from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.report import ReportPublic

ClaimStatus = Literal["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "COMPLETED"]


class ClaimCreate(BaseModel):
    verification_answer: str = Field(min_length=3, max_length=1500)
    message: str | None = Field(default=None, max_length=1000)


class ClaimReview(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    staff_note: str | None = Field(default=None, max_length=1500)
    storage_note: str | None = Field(default=None, max_length=1500)


class HandoverCreate(BaseModel):
    note: str | None = Field(default=None, max_length=1500)


class ClaimResponse(BaseModel):
    id: int
    report: ReportPublic
    claimant_id: int
    status: str
    verification_answer: str
    message: str | None
    staff_note: str | None
    reviewed_at: datetime | None
    handed_over_at: datetime | None
    created_at: datetime
    updated_at: datetime


class StaffClaimResponse(ClaimResponse):
    claimant_email: str
    claimant_name: str
    report_owner_email: str
    report_special_features: str | None
    report_verification_question: str | None
    report_storage_note: str | None


class ReceivedClaimResponse(BaseModel):
    id: int
    report_id: int
    report_category: str
    status: str
    created_at: datetime
    reviewed_at: datetime | None
    handed_over_at: datetime | None
