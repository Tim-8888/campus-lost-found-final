from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FlagCreate(BaseModel):
    reason: Literal["SPAM", "MISLEADING", "INAPPROPRIATE", "DUPLICATE", "OTHER"]
    details: str | None = Field(default=None, max_length=1000)


class FlagResponse(BaseModel):
    id: int
    report_id: int
    reporter_id: int
    reason: str
    details: str | None
    status: str
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None


class FlagResolve(BaseModel):
    action: Literal["DISMISS", "RESOLVE", "HIDE_REPORT"]
    note: str | None = Field(default=None, max_length=1000)
