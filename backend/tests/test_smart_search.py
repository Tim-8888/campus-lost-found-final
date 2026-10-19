import json
from pathlib import Path

from app.api.routes import smart_search as smart_search_route
from app.core.config import settings
from app.db.session import SessionLocal
from app.schemas.smart_search import SmartSearchFields
from app.services.smart_search import _response_schema, sanitize_search_sentence, standardise_fields


def test_smart_search_status_reports_configuration(client, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    response = client.get("/api/v1/smart-search/status")
    assert response.status_code == 200
    assert response.json()["enabled"] is False
    assert response.json()["normal_search_available"] is True


def test_smart_search_extract_requires_key(client, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    response = client.post("/api/v1/smart-search/extract", json={"query": "lost black phone in library"})
    assert response.status_code == 503
    assert "Normal Search" in response.json()["detail"]


def test_smart_search_extract_returns_confirmable_fields(client, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")

    async def fake_extract(query, db):
        assert query == "I lost a black phone near the library"
        return SmartSearchFields(
            report_type="LOST",
            category_id=2,
            category_name="Phone",
            colour="Black",
            location_id=1,
            location_name="Library",
            date_from=None,
            date_to=None,
            keywords=[],
            status="OPEN",
        ), []

    monkeypatch.setattr(smart_search_route, "extract_smart_search", fake_extract)
    response = client.post(
        "/api/v1/smart-search/extract",
        json={"query": "I lost a black phone near the library"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["model"] == settings.gemini_model
    assert body["fields"]["report_type"] == "LOST"
    assert body["fields"]["category_name"] == "Phone"
    assert body["fields"]["location_name"] == "Library"
    assert body["fallback_available"] is True


def test_smart_search_standardises_reference_aliases_and_dates():
    with SessionLocal() as db:
        fields, warnings = standardise_fields({
            "report_type": "lost",
            "category": "mobile phone",
            "colour": "Black",
            "location": "student centre",
            "date": "2026-09-20..2026-09-22",
            "keywords": ["case", "case", "zip"],
        }, db)

    assert fields.report_type == "LOST"
    assert fields.category_name == "Phone"
    assert fields.location_name == "Student Central"
    assert fields.date_from.isoformat() == "2026-09-20"
    assert fields.date_to.isoformat() == "2026-09-22"
    assert fields.keywords == ["case", "zip"]
    assert warnings == []


def test_smart_search_redacts_obvious_contact_details():
    cleaned = sanitize_search_sentence(
        "Lost wallet. Email me at student@example.com or call +64 21 123 4567 near library"
    )
    assert "student@example.com" not in cleaned
    assert "21 123 4567" not in cleaned
    assert "[redacted-email]" in cleaned
    assert "[redacted-phone]" in cleaned


def test_smart_search_has_50_preset_queries():
    path = Path(__file__).parent / "data" / "smart_search_queries.json"
    cases = json.loads(path.read_text(encoding="utf-8"))
    assert len(cases) == 50
    assert all(item.get("query") and item.get("expected") for item in cases)


def test_smart_search_does_not_redact_iso_dates():
    cleaned = sanitize_search_sentence("Lost a black wallet on 2026-09-20 near the library")
    assert "2026-09-20" in cleaned


def test_smart_search_response_schema_uses_scalar_type_and_no_empty_enum():
    report_type_schema = _response_schema()["properties"]["report_type"]
    assert isinstance(report_type_schema["type"], str)
    assert "" not in report_type_schema.get("enum", [])
