from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ReportType = Literal["LOST", "FOUND"]
ReportStatus = Literal["OPEN", "CLOSED", "RETURNED"]


def _strip_required_text(value):
    if isinstance(value, str):
        return value.strip()
    return value


def _normalise_optional_text(value):
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class ReportCreate(BaseModel):
    report_type: ReportType
    category_id: int = Field(gt=0)
    description: str = Field(min_length=10, max_length=2000)
    item_date: date
    location_id: int = Field(gt=0)
    colour: str = Field(min_length=1, max_length=80)
    special_features: str | None = Field(default=None, max_length=1000)
    verification_question: str | None = Field(default=None, max_length=500)
    is_public: bool = True

    _strip_required = field_validator("description", "colour", mode="before")(_strip_required_text)
    _normalise_optional = field_validator("special_features", "verification_question", mode="before")(_normalise_optional_text)


class ReportUpdate(BaseModel):
    report_type: ReportType | None = None
    category_id: int | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, min_length=10, max_length=2000)
    item_date: date | None = None
    location_id: int | None = Field(default=None, gt=0)
    colour: str | None = Field(default=None, min_length=1, max_length=80)
    special_features: str | None = Field(default=None, max_length=1000)
    verification_question: str | None = Field(default=None, max_length=500)
    is_public: bool | None = None

    _strip_required = field_validator("description", "colour", mode="before")(_strip_required_text)
    _normalise_optional = field_validator("special_features", "verification_question", mode="before")(_normalise_optional_text)


class StatusUpdate(BaseModel):
    status: ReportStatus


class NamedItem(BaseModel):
    id: int
    name: str


class ImageResponse(BaseModel):
    id: int
    url: str
    original_name: str
    mime_type: str


class ReportPublic(BaseModel):
    id: int
    report_type: str
    category: NamedItem
    description: str
    item_date: date
    location: NamedItem
    colour: str
    verification_question: str | None = None
    status: str
    is_public: bool
    images: list[ImageResponse]
    created_at: datetime
    updated_at: datetime


class ReportPrivate(ReportPublic):
    user_id: int
    special_features: str | None = None
    storage_note: str | None = None


class SearchResponse(BaseModel):
    total: int
    items: list[ReportPublic]
