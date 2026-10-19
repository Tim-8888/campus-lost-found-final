from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Claim, Profile, ReportStatusHistory, User


def register_and_login(client, email: str, first: str = "Test", last: str = "User"):
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "StrongPass123",
        "first_name": first,
        "last_name": last,
    })
    assert response.status_code == 201, response.text
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "StrongPass123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def create_privileged(client, email: str, role: str):
    with SessionLocal() as db:
        user = User(email=email, password_hash=hash_password("StrongPass123"), role=role)
        user.profile = Profile(first_name=role.title(), last_name="Tester")
        db.add(user)
        db.commit()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "StrongPass123"})
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def found_payload():
    return {
        "report_type": "FOUND",
        "category_id": 1,
        "description": "Black USB-C charger found close to the library entrance.",
        "item_date": "2026-09-05",
        "location_id": 1,
        "colour": "Black",
        "special_features": "White initials CW underneath the plug.",
        "verification_question": "What initials are written underneath the plug?",
        "is_public": True,
    }


def lost_payload():
    return {
        "report_type": "LOST",
        "category_id": 1,
        "description": "Black USB-C charger lost close to the library entrance.",
        "item_date": "2026-09-05",
        "location_id": 1,
        "colour": "Black",
        "special_features": "White initials CW underneath the plug.",
        "verification_question": None,
        "is_public": True,
    }


def test_found_report_requires_verification_and_claim_guards(client):
    owner = register_and_login(client, "owner-guard@example.com")
    claimant = register_and_login(client, "claimant-guard@example.com")

    invalid_found = found_payload()
    invalid_found["verification_question"] = None
    response = client.post("/api/v1/reports", json=invalid_found, headers=owner)
    assert response.status_code == 400

    created = client.post("/api/v1/reports", json=found_payload(), headers=owner)
    assert created.status_code == 201, created.text
    report_id = created.json()["id"]

    own_claim = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "The initials are CW."},
        headers=owner,
    )
    assert own_claim.status_code == 400

    submitted = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "The initials are CW.", "message": "This is mine."},
        headers=claimant,
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["status"] == "PENDING"

    duplicate = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "CW again"},
        headers=claimant,
    )
    assert duplicate.status_code == 409

    lost = client.post("/api/v1/reports", json=lost_payload(), headers=owner)
    assert lost.status_code == 201
    lost_claim = client.post(
        f"/api/v1/claims/reports/{lost.json()['id']}",
        json={"verification_answer": "Any answer"},
        headers=claimant,
    )
    assert lost_claim.status_code == 400


def test_claim_locks_report_evidence_and_approval_rejects_other_claims(client):
    owner = register_and_login(client, "owner-lock@example.com")
    claimant_one = register_and_login(client, "claimant-one@example.com")
    claimant_two = register_and_login(client, "claimant-two@example.com")
    staff = create_privileged(client, "staff-lock@example.com", "STAFF")

    created = client.post("/api/v1/reports", json=found_payload(), headers=owner)
    report_id = created.json()["id"]

    claim_one = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "The initials are CW."},
        headers=claimant_one,
    )
    claim_two = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "I think it says CW"},
        headers=claimant_two,
    )
    assert claim_one.status_code == 201
    assert claim_two.status_code == 201

    edit = client.patch(
        f"/api/v1/reports/{report_id}",
        json={"special_features": "Changed after Claim"},
        headers=owner,
    )
    assert edit.status_code == 409

    image = client.post(
        f"/api/v1/reports/{report_id}/images",
        files={"file": ("late.png", b"fake-png-content", "image/png")},
        headers=owner,
    )
    assert image.status_code == 409

    delete = client.delete(f"/api/v1/reports/{report_id}", headers=owner)
    assert delete.status_code == 409

    reviewed = client.post(
        f"/api/v1/staff/claims/{claim_one.json()['id']}/review",
        json={
            "decision": "APPROVED",
            "staff_note": "Verification matches.",
            "storage_note": "Security Desk locker A2.",
        },
        headers=staff,
    )
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["status"] == "APPROVED"
    assert reviewed.json()["report"]["status"] == "CLOSED"

    second = client.get("/api/v1/claims/mine", headers=claimant_two)
    assert second.status_code == 200
    assert second.json()[0]["status"] == "REJECTED"

    reopen = client.patch(
        f"/api/v1/reports/{report_id}/status",
        json={"status": "OPEN"},
        headers=owner,
    )
    assert reopen.status_code == 409

    direct_returned = client.patch(
        f"/api/v1/reports/{report_id}/status",
        json={"status": "RETURNED"},
        headers=staff,
    )
    assert direct_returned.status_code == 403


def test_handover_sets_returned_and_records_history(client):
    owner = register_and_login(client, "owner-handover@example.com")
    claimant = register_and_login(client, "claimant-handover@example.com")
    staff = create_privileged(client, "staff-handover@example.com", "STAFF")

    created = client.post("/api/v1/reports", json=found_payload(), headers=owner)
    report_id = created.json()["id"]

    claim = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "The initials are CW."},
        headers=claimant,
    )
    claim_id = claim.json()["id"]

    approved = client.post(
        f"/api/v1/staff/claims/{claim_id}/review",
        json={
            "decision": "APPROVED",
            "staff_note": "Correct identifying detail.",
            "storage_note": "Student Central counter.",
        },
        headers=staff,
    )
    assert approved.status_code == 200

    handover = client.post(
        f"/api/v1/staff/claims/{claim_id}/handover",
        json={"note": "Student ID checked and item collected."},
        headers=staff,
    )
    assert handover.status_code == 200, handover.text
    assert handover.json()["status"] == "COMPLETED"
    assert handover.json()["report"]["status"] == "RETURNED"
    assert handover.json()["handed_over_at"] is not None

    notices = client.get("/api/v1/notifications", headers=claimant)
    assert notices.status_code == 200
    assert any(n["notification_type"] == "HANDOVER_COMPLETED" for n in notices.json())

    with SessionLocal() as db:
        history = db.scalars(
            select(ReportStatusHistory).where(ReportStatusHistory.report_id == report_id)
        ).all()
        assert [(x.old_status, x.new_status) for x in history] == [
            ("OPEN", "CLOSED"),
            ("CLOSED", "RETURNED"),
        ]


def test_notification_preferences_are_respected(client):
    owner = register_and_login(client, "owner-pref@example.com")
    claimant = register_and_login(client, "claimant-pref@example.com")
    reporter = register_and_login(client, "reporter-pref@example.com")

    updated = client.patch(
        "/api/v1/profiles/me",
        json={
            "preferred_contact_method": "EMAIL",
            "notify_claim_updates": False,
            "notify_status_changes": False,
            "notify_handover": False,
        },
        headers=owner,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["preferred_contact_method"] == "EMAIL"
    assert updated.json()["notify_claim_updates"] is False

    created = client.post("/api/v1/reports", json=found_payload(), headers=owner)
    report_id = created.json()["id"]

    claim = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "The initials are CW."},
        headers=claimant,
    )
    assert claim.status_code == 201

    owner_notices = client.get("/api/v1/notifications", headers=owner)
    assert owner_notices.status_code == 200
    assert not any(n["notification_type"] == "CLAIM_SUBMITTED" for n in owner_notices.json())

    flagged = client.post(
        f"/api/v1/flags/reports/{report_id}",
        json={"reason": "MISLEADING", "details": "Test moderation notice."},
        headers=reporter,
    )
    assert flagged.status_code == 201

    owner_notices = client.get("/api/v1/notifications", headers=owner)
    assert any(n["notification_type"] == "MODERATION" for n in owner_notices.json())


def test_staff_admin_permissions_and_brief_aligned_stats(client):
    student = register_and_login(client, "student-permission@example.com")
    owner = register_and_login(client, "owner-stats@example.com")
    claimant = register_and_login(client, "claimant-stats@example.com")
    staff = create_privileged(client, "staff-stats@example.com", "STAFF")
    admin = create_privileged(client, "admin-stats@example.com", "ADMIN")

    assert client.get("/api/v1/staff/claims", headers=student).status_code == 403
    assert client.get("/api/v1/admin/stats", headers=student).status_code == 403

    lost = client.post("/api/v1/reports", json=lost_payload(), headers=owner)
    assert lost.status_code == 201
    found = client.post("/api/v1/reports", json=found_payload(), headers=owner)
    assert found.status_code == 201
    report_id = found.json()["id"]

    claim = client.post(
        f"/api/v1/claims/reports/{report_id}",
        json={"verification_answer": "The initials are CW."},
        headers=claimant,
    )
    assert claim.status_code == 201

    approved = client.post(
        f"/api/v1/staff/claims/{claim.json()['id']}/review",
        json={"decision": "APPROVED", "staff_note": "Match", "storage_note": "Desk"},
        headers=staff,
    )
    assert approved.status_code == 200

    stats = client.get("/api/v1/admin/stats", headers=admin)
    assert stats.status_code == 200, stats.text
    body = stats.json()
    assert body["lost_reports"] == 1
    assert body["found_reports"] == 1
    assert body["matched_reports"] == 1
    assert body["recovered_items"] == 0
    assert body["unresolved_cases"] == 1
    assert body["pending_claims"] == 0
    assert body["total_claims"] == 1
    assert body["active_users"] == body["total_users"]


def test_flag_and_admin_management(client):
    owner = register_and_login(client, "owner-flag@example.com")
    reporter = register_and_login(client, "reporter-flag@example.com")
    admin = create_privileged(client, "admin-flag@example.com", "ADMIN")

    created = client.post("/api/v1/reports", json=found_payload(), headers=owner)
    report_id = created.json()["id"]

    flagged = client.post(
        f"/api/v1/flags/reports/{report_id}",
        json={
            "reason": "MISLEADING",
            "details": "The location appears to be deliberately incorrect.",
        },
        headers=reporter,
    )
    assert flagged.status_code == 201, flagged.text
    flag_id = flagged.json()["id"]

    stats = client.get("/api/v1/admin/stats", headers=admin)
    assert stats.status_code == 200, stats.text
    assert stats.json()["open_flags"] == 1

    flags = client.get("/api/v1/admin/flags?status=OPEN", headers=admin)
    assert flags.status_code == 200
    assert len(flags.json()) == 1

    resolved = client.post(
        f"/api/v1/admin/flags/{flag_id}/resolve",
        json={"action": "HIDE_REPORT", "note": "Hidden while the owner corrects the listing."},
        headers=admin,
    )
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["status"] == "RESOLVED"

    public = client.get(f"/api/v1/reports/{report_id}")
    assert public.status_code == 404

    users = client.get("/api/v1/admin/users", headers=admin)
    assert users.status_code == 200
    assert any(u["role"] == "ADMIN" for u in users.json())

    categories = client.get("/api/v1/admin/categories", headers=admin)
    assert categories.status_code == 200
    assert any(c["name"] == "Charger" for c in categories.json())


def test_admin_can_add_rename_remove_and_restore_reference_data(client):
    admin = create_privileged(client, "admin-reference@example.com", "ADMIN")

    added_category = client.post("/api/v1/admin/categories", json={"name": "Tablet"}, headers=admin)
    assert added_category.status_code == 201, added_category.text
    category_id = added_category.json()["id"]

    renamed_category = client.patch(
        f"/api/v1/admin/categories/{category_id}",
        json={"name": "Tablets"},
        headers=admin,
    )
    assert renamed_category.status_code == 200
    assert renamed_category.json()["name"] == "Tablets"

    removed_category = client.patch(
        f"/api/v1/admin/categories/{category_id}",
        json={"is_active": False},
        headers=admin,
    )
    assert removed_category.status_code == 200
    public_categories = client.get("/api/v1/references/categories")
    assert all(item["id"] != category_id for item in public_categories.json())

    restored_category = client.patch(
        f"/api/v1/admin/categories/{category_id}",
        json={"is_active": True},
        headers=admin,
    )
    assert restored_category.status_code == 200
    assert any(item["id"] == category_id for item in client.get("/api/v1/references/categories").json())

    added_location = client.post("/api/v1/admin/locations", json={"name": "Quadrangle Building"}, headers=admin)
    assert added_location.status_code == 201, added_location.text
    location_id = added_location.json()["id"]

    renamed_location = client.patch(
        f"/api/v1/admin/locations/{location_id}",
        json={"name": "Quadrangle"},
        headers=admin,
    )
    assert renamed_location.status_code == 200
    assert renamed_location.json()["name"] == "Quadrangle"

    removed_location = client.patch(
        f"/api/v1/admin/locations/{location_id}",
        json={"is_active": False},
        headers=admin,
    )
    assert removed_location.status_code == 200
    assert all(item["id"] != location_id for item in client.get("/api/v1/references/locations").json())

    restored_location = client.patch(
        f"/api/v1/admin/locations/{location_id}",
        json={"is_active": True},
        headers=admin,
    )
    assert restored_location.status_code == 200
    assert any(item["id"] == location_id for item in client.get("/api/v1/references/locations").json())
