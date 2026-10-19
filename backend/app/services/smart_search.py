"""Smart Search service.

This module sends only the user's search sentence (after basic contact-data
redaction) to Gemini together with fixed extraction instructions. Gemini never
receives user accounts, report rows, Claim answers, passwords, or database
credentials. The model returns a fixed JSON object; this service validates and
standardises it before the frontend can use the existing parameterised normal
search endpoint.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from difflib import get_close_matches
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Category, Location
from app.schemas.smart_search import SmartSearchFields

EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{6,}\d)(?!\w)")

CATEGORY_ALIASES = {
    "mobile": "Phone",
    "mobile phone": "Phone",
    "cell phone": "Phone",
    "smartphone": "Phone",
    "student id": "ID Card",
    "student card": "ID Card",
    "id": "ID Card",
    "id card": "ID Card",
    "book": "Textbook",
    "text book": "Textbook",
    "charger cable": "Charger",
    "clothing": "Clothing",
    "clothes": "Clothing",
    "jacket": "Clothing",
    "shoes": "Clothing",
}

LOCATION_ALIASES = {
    "student centre": "Student Central",
    "student center": "Student Central",
    "computer laboratory": "Computer Lab",
    "computer labs": "Computer Lab",
    "parking lot": "Car Park",
    "carpark": "Car Park",
    "lecture hall": "Lecture Theatre",
    "lecture room": "Lecture Theatre",
    "rec centre": "Recreation Centre",
    "recreation center": "Recreation Centre",
    "gym": "Recreation Centre",
    "cafe": "Cafeteria",
    "canteen": "Cafeteria",
}


def sanitize_search_sentence(value: str) -> str:
    """Remove obvious contact details before the sentence leaves the backend."""
    cleaned = EMAIL_PATTERN.sub("[redacted-email]", value.strip())

    def redact_phone(match: re.Match[str]) -> str:
        text = match.group(0)
        # Keep ISO dates such as 2026-09-20. They are search information,
        # not contact data, and must remain available to Smart Search.
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            return text
        digit_count = sum(character.isdigit() for character in text)
        return "[redacted-phone]" if digit_count >= 8 else text

    cleaned = PHONE_PATTERN.sub(redact_phone, cleaned)
    return cleaned[:500]


def _normalise_text(value: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.casefold()).split())


def _match_reference(value: str | None, rows: list[Any], aliases: dict[str, str]) -> tuple[int | None, str | None, str | None]:
    if not value or not value.strip():
        return None, None, None

    original = value.strip()
    key = _normalise_text(original)
    alias_target = aliases.get(key)
    if alias_target:
        key = _normalise_text(alias_target)

    by_key = {_normalise_text(row.name): row for row in rows}
    if key in by_key:
        row = by_key[key]
        return row.id, row.name, None

    # A small fuzzy-match step handles minor wording/spelling differences but
    # never creates a new category/location or SQL fragment.
    matches = get_close_matches(key, list(by_key), n=1, cutoff=0.78)
    if matches:
        row = by_key[matches[0]]
        return row.id, row.name, f'"{original}" was standardised to "{row.name}".'

    return None, None, f'"{original}" does not match an active reference value. Please select it manually.'


def _parse_date_value(value: str | None) -> tuple[date | None, date | None, str | None]:
    if not value or not value.strip():
        return None, None, None

    raw = value.strip()
    parts = [part.strip() for part in raw.split("..", 1)]
    try:
        if len(parts) == 1:
            one = datetime.strptime(parts[0], "%Y-%m-%d").date()
            return one, one, None
        start = datetime.strptime(parts[0], "%Y-%m-%d").date()
        end = datetime.strptime(parts[1], "%Y-%m-%d").date()
        if start > end:
            start, end = end, start
            return start, end, "The extracted date range was reversed and has been corrected."
        return start, end, None
    except ValueError:
        return None, None, f'Gemini returned an invalid date value: "{raw}". Please choose the date manually.'


def _unique_keywords(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = str(item).strip()
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        result.append(text[:80])
        if len(result) >= 8:
            break
    return result


def _response_schema() -> dict[str, Any]:
    return {
        "type": "OBJECT",
        "properties": {
            "report_type": {
                "type": "STRING",
                "description": "Return LOST if the user lost the item, FOUND if the user found it, otherwise return an empty string.",
            },
            "category": {
                "type": "STRING",
                "description": "Short item category such as Wallet, Phone, Keys, Charger, Clothing, Laptop, Textbook, ID Card, or empty string.",
            },
            "colour": {"type": "STRING", "description": "Item colour or empty string."},
            "location": {"type": "STRING", "description": "Campus location phrase or empty string."},
            "date": {
                "type": "STRING",
                "description": "Empty string, one ISO date YYYY-MM-DD, or an ISO range YYYY-MM-DD..YYYY-MM-DD.",
            },
            "keywords": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "Up to 8 useful search keywords not already represented by the other fields.",
            },
        },
        "required": ["report_type", "category", "colour", "location", "date", "keywords"],
    }


def _prompt(sentence: str) -> str:
    today = date.today().isoformat()
    return (
        "Extract search conditions for a campus Lost and Found system.\n"
        f"Current date: {today}. Resolve words such as today, yesterday, last week, and date ranges into ISO dates.\n"
        "Do not create SQL. Do not decide ownership. Do not invent details that are not present.\n"
        "For a single date, return YYYY-MM-DD in the date field. For a range, return YYYY-MM-DD..YYYY-MM-DD. "
        "If a field is unknown, use an empty string or an empty keyword list.\n"
        "Keywords should contain only useful remaining item details that are not already represented by report type, category, colour, location, or date.\n\n"
        f"Search sentence:\n{sentence}"
    )


async def call_gemini(sentence: str) -> dict[str, Any]:
    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key is not configured")

    url = f"{settings.gemini_api_base.rstrip('/')}/models/{settings.gemini_model}:generateContent"
    body = {
        "contents": [{"parts": [{"text": _prompt(sentence)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": _response_schema(),
        },
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.gemini_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.gemini_timeout_seconds) as client:
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = "Gemini API returned an error"
        try:
            api_message = exc.response.json().get("error", {}).get("message")
            if api_message:
                detail = f"Gemini API error: {api_message}"
        except Exception:
            pass
        raise RuntimeError(detail) from exc
    except httpx.HTTPError as exc:
        raise RuntimeError("Gemini API could not be reached") from exc

    data = response.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(str(part.get("text", "")) for part in parts)
        parsed = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Gemini returned an invalid structured response") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError("Gemini returned an invalid structured response")
    return parsed


def standardise_fields(raw: dict[str, Any], db: Session) -> tuple[SmartSearchFields, list[str]]:
    warnings: list[str] = []

    report_type_raw = str(raw.get("report_type") or "").strip().upper()
    report_type = report_type_raw if report_type_raw in {"LOST", "FOUND"} else None
    if report_type_raw and report_type is None:
        warnings.append(f'Unknown report type "{report_type_raw}" was ignored.')

    categories = list(db.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.name)).all())
    locations = list(db.scalars(select(Location).where(Location.is_active.is_(True)).order_by(Location.name)).all())

    category_id, category_name, category_warning = _match_reference(
        str(raw.get("category") or ""), categories, CATEGORY_ALIASES
    )
    location_id, location_name, location_warning = _match_reference(
        str(raw.get("location") or ""), locations, LOCATION_ALIASES
    )
    if category_warning:
        warnings.append(category_warning)
    if location_warning:
        warnings.append(location_warning)

    date_from, date_to, date_warning = _parse_date_value(str(raw.get("date") or ""))
    if date_warning:
        warnings.append(date_warning)

    colour = str(raw.get("colour") or "").strip() or None
    keywords = _unique_keywords(raw.get("keywords"))

    return SmartSearchFields(
        report_type=report_type,
        category_id=category_id,
        category_name=category_name,
        colour=colour[:80] if colour else None,
        location_id=location_id,
        location_name=location_name,
        date_from=date_from,
        date_to=date_to,
        keywords=keywords,
        status="OPEN",
    ), warnings


async def extract_smart_search(sentence: str, db: Session) -> tuple[SmartSearchFields, list[str]]:
    cleaned = sanitize_search_sentence(sentence)
    if len(cleaned) < 3:
        raise ValueError("Please enter a longer search sentence")
    raw = await call_gemini(cleaned)
    return standardise_fields(raw, db)
