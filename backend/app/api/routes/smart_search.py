from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.schemas.smart_search import SmartSearchExtractResponse, SmartSearchRequest, SmartSearchStatusResponse
from app.services.smart_search import extract_smart_search

router = APIRouter(prefix="/smart-search", tags=["Smart Search"])


@router.get("/status", response_model=SmartSearchStatusResponse)
def smart_search_status() -> SmartSearchStatusResponse:
    return SmartSearchStatusResponse(
        enabled=bool(settings.gemini_api_key),
        model=settings.gemini_model,
        normal_search_available=True,
        privacy_note=(
            "Only the search sentence is processed by Smart Search. User accounts, passwords, Claim answers, "
            "and complete report records are not sent to Gemini. Obvious email addresses and phone numbers in "
            "the sentence are redacted before the API call."
        ),
    )


@router.post("/extract", response_model=SmartSearchExtractResponse)
async def extract(payload: SmartSearchRequest, db: Session = Depends(get_db)) -> SmartSearchExtractResponse:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="Smart Search is not configured. Add GEMINI_API_KEY to backend/.env or use Normal Search.",
        )
    try:
        fields, warnings = await extract_smart_search(payload.query, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"{exc}. Normal Search is still available.",
        ) from exc

    return SmartSearchExtractResponse(
        model=settings.gemini_model,
        fields=fields,
        warnings=warnings,
        fallback_available=True,
    )
