"""Run the 50 preset Smart Search queries against the configured Gemini model.

This is an evaluation helper, not an automated unit test. It requires a real
GEMINI_API_KEY and therefore may use API quota. The output is written to
``docs/test_evidence/smart_search_results.json`` by default.
"""

import argparse
import asyncio
import json
from pathlib import Path

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.smart_search import extract_smart_search

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
DATASET = BACKEND_DIR / "tests" / "data" / "smart_search_queries.json"
DEFAULT_OUTPUT = PROJECT_DIR / "docs" / "test_evidence" / "smart_search_results.json"


def compare(expected: dict, actual: dict) -> tuple[int, int, dict]:
    passed = 0
    details = {}
    for key, expected_value in expected.items():
        actual_value = actual.get(key)
        ok = str(actual_value or "").casefold() == str(expected_value or "").casefold()
        passed += int(ok)
        details[key] = {"expected": expected_value, "actual": actual_value, "pass": ok}
    return passed, len(expected), details


async def run(limit: int | None, output: Path) -> None:
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY is missing from backend/.env")

    cases = json.loads(DATASET.read_text(encoding="utf-8"))
    if limit:
        cases = cases[:limit]

    results = []
    field_passes = 0
    field_total = 0
    successful_calls = 0

    with SessionLocal() as db:
        for index, case in enumerate(cases, start=1):
            try:
                fields, warnings = await extract_smart_search(case["query"], db)
                actual = fields.model_dump(mode="json")
                passed, total, details = compare(case["expected"], actual)
                field_passes += passed
                field_total += total
                successful_calls += 1
                results.append({
                    "id": case["id"],
                    "query": case["query"],
                    "status": "ok",
                    "warnings": warnings,
                    "field_checks": details,
                    "actual": actual,
                })
                print(f"[{index:02d}/{len(cases):02d}] {passed}/{total} fields: {case['query']}")
            except Exception as exc:
                results.append({
                    "id": case["id"],
                    "query": case["query"],
                    "status": "error",
                    "error": str(exc),
                })
                print(f"[{index:02d}/{len(cases):02d}] ERROR: {case['query']} -> {exc}")

    summary = {
        "model": settings.gemini_model,
        "queries_run": len(cases),
        "successful_api_calls": successful_calls,
        "api_success_rate": round(successful_calls / len(cases), 4) if cases else 0,
        "expected_fields_checked": field_total,
        "expected_fields_correct": field_passes,
        "field_accuracy": round(field_passes / field_total, 4) if field_total else 0,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"summary": summary, "results": results}, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"Saved: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Run only the first N preset queries")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    asyncio.run(run(args.limit, args.output))
