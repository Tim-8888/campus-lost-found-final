from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class SmartSearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=500)


class SmartSearchFields(BaseModel):
    report_type: Literal["LOST", "FOUND"] | None = None
    category_id: int | None = None
    category_name: str | None = None
    colour: str | None = None
    location_id: int | None = None
    location_name: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    keywords: list[str] = Field(default_factory=list)
    status: Literal["OPEN", "CLOSED", "RETURNED"] = "OPEN"


class SmartSearchExtractResponse(BaseModel):
    model: str
    fields: SmartSearchFields
    warnings: list[str] = Field(default_factory=list)
    fallback_available: bool = True


class SmartSearchStatusResponse(BaseModel):
    enabled: bool
    model: str
    normal_search_available: bool = True
    privacy_note: str
