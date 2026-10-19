from typing import Literal

from pydantic import BaseModel, Field

ContactMethod = Literal["IN_APP", "EMAIL", "PHONE"]


class ProfileResponse(BaseModel):
    user_id: int
    email: str
    role: str
    first_name: str
    last_name: str
    phone: str | None = None
    preferred_location_id: int | None = None
    preferred_contact_method: str
    notify_claim_updates: bool
    notify_status_changes: bool
    notify_handover: bool


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    preferred_location_id: int | None = None
    preferred_contact_method: ContactMethod | None = None
    notify_claim_updates: bool | None = None
    notify_status_changes: bool | None = None
    notify_handover: bool | None = None
