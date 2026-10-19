from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    lost_reports: int
    found_reports: int
    matched_reports: int
    recovered_items: int
    unresolved_cases: int
    total_claims: int
    pending_claims: int
    completed_claims: int
    open_flags: int


class AdminUserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    first_name: str
    last_name: str
    created_at: datetime


class AdminUserUpdate(BaseModel):
    role: str | None = Field(default=None, pattern="^(STUDENT|STAFF|ADMIN)$")
    is_active: bool | None = None


class ReferenceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ReferenceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    is_active: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class AdminReferenceResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    report_count: int


class AdminReportResponse(BaseModel):
    id: int
    owner_email: str
    report_type: str
    category: str
    location: str
    colour: str
    status: str
    is_public: bool
    open_flags: int
    created_at: datetime


class VisibilityUpdate(BaseModel):
    is_public: bool
