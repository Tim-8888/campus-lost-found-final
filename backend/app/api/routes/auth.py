from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import Profile, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserSummary

router = APIRouter(prefix="/auth", tags=["Authentication"])


def summary(user: User) -> UserSummary:
    return UserSummary(id=user.id, email=user.email, role=user.role, is_active=user.is_active)


@router.post("/register", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserSummary:
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = User(email=email, password_hash=hash_password(payload.password), role="STUDENT")
    user.profile = Profile(first_name=payload.first_name.strip(), last_name=payload.last_name.strip())
    db.add(user)
    db.commit()
    db.refresh(user)
    return summary(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=summary(user))


@router.get("/me", response_model=UserSummary)
def me(user: User = Depends(get_current_user)) -> UserSummary:
    return summary(user)
