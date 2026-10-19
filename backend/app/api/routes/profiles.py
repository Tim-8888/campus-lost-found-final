from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Location, User
from app.schemas.profile import ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profiles", tags=["Profiles"])


def to_response(user: User) -> ProfileResponse:
    profile = user.profile
    return ProfileResponse(
        user_id=user.id,
        email=user.email,
        role=user.role,
        first_name=profile.first_name,
        last_name=profile.last_name,
        phone=profile.phone,
        preferred_location_id=profile.preferred_location_id,
        preferred_contact_method=profile.preferred_contact_method,
        notify_claim_updates=profile.notify_claim_updates,
        notify_status_changes=profile.notify_status_changes,
        notify_handover=profile.notify_handover,
    )


@router.get("/me", response_model=ProfileResponse)
def get_profile(user: User = Depends(get_current_user)) -> ProfileResponse:
    return to_response(user)


@router.patch("/me", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    data = payload.model_dump(exclude_unset=True)
    if "preferred_location_id" in data and data["preferred_location_id"] is not None:
        if db.scalar(select(Location).where(Location.id == data["preferred_location_id"])) is None:
            raise HTTPException(status_code=400, detail="Invalid preferred location")
    for field, value in data.items():
        setattr(user.profile, field, value)
    db.commit()
    db.refresh(user.profile)
    return to_response(user)
