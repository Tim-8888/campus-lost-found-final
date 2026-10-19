def create_payload():
    return {
        "report_type": "LOST",
        "category_id": 1,
        "description": "Black USB-C charger with a small white label on the cable.",
        "item_date": "2026-08-13",
        "location_id": 1,
        "colour": "Black",
        "special_features": "White initials CW on the hidden side.",
        "is_public": True,
    }


def test_report_create_search_edit_status(client, auth_header):
    created = client.post("/api/v1/reports", json=create_payload(), headers=auth_header)
    assert created.status_code == 201, created.text
    report = created.json()
    report_id = report["id"]
    assert report["special_features"] is not None

    search = client.get("/api/v1/reports/search?keyword=charger&status=OPEN")
    assert search.status_code == 200
    assert search.json()["total"] == 1
    assert "special_features" not in search.json()["items"][0]

    updated = client.patch(
        f"/api/v1/reports/{report_id}",
        json={"colour": "Black and grey", "description": "Black and grey USB-C charger lost close to the library entrance."},
        headers=auth_header,
    )
    assert updated.status_code == 200
    assert updated.json()["colour"] == "Black and grey"

    closed = client.patch(f"/api/v1/reports/{report_id}/status", json={"status": "CLOSED"}, headers=auth_header)
    assert closed.status_code == 200
    assert closed.json()["status"] == "CLOSED"

    returned = client.patch(f"/api/v1/reports/{report_id}/status", json={"status": "RETURNED"}, headers=auth_header)
    assert returned.status_code == 403


def test_image_upload(client, auth_header):
    created = client.post("/api/v1/reports", json=create_payload(), headers=auth_header)
    report_id = created.json()["id"]
    response = client.post(
        f"/api/v1/reports/{report_id}/images",
        files={"file": ("test.png", b"fake-png-content", "image/png")},
        headers=auth_header,
    )
    assert response.status_code == 201
    assert response.json()["url"].startswith("/uploads/reports/")


def test_search_supports_status_filter_and_multiple_keywords(client, auth_header):
    first = client.post("/api/v1/reports", json=create_payload(), headers=auth_header)
    assert first.status_code == 201

    second_payload = create_payload()
    second_payload["description"] = "Blue USB-C charger lost near Student Central."
    second_payload["location_id"] = 2
    second_payload["colour"] = "Blue"
    second = client.post("/api/v1/reports", json=second_payload, headers=auth_header)
    assert second.status_code == 201
    second_id = second.json()["id"]

    close = client.patch(
        f"/api/v1/reports/{second_id}/status",
        json={"status": "CLOSED"},
        headers=auth_header,
    )
    assert close.status_code == 200

    open_only = client.get("/api/v1/reports/search?keyword=black%20charger&status=OPEN")
    assert open_only.status_code == 200
    assert open_only.json()["total"] == 1

    all_statuses = client.get("/api/v1/reports/search?keyword=charger")
    assert all_statuses.status_code == 200
    assert all_statuses.json()["total"] == 2


def test_report_rejects_blank_required_text_and_found_blank_verification(client, auth_header):
    blank_description = create_payload()
    blank_description["description"] = "          "
    response = client.post("/api/v1/reports", json=blank_description, headers=auth_header)
    assert response.status_code == 422

    blank_colour = create_payload()
    blank_colour["colour"] = "   "
    response = client.post("/api/v1/reports", json=blank_colour, headers=auth_header)
    assert response.status_code == 422

    found = create_payload()
    found["report_type"] = "FOUND"
    found["verification_question"] = "   "
    found["special_features"] = "White initials CW underneath the item."
    response = client.post("/api/v1/reports", json=found, headers=auth_header)
    assert response.status_code == 400

    found["verification_question"] = "What initials are on the item?"
    found["special_features"] = "   "
    response = client.post("/api/v1/reports", json=found, headers=auth_header)
    assert response.status_code == 400


def test_lost_report_can_be_marked_as_found_without_changing_report_type(client, auth_header):
    created = client.post("/api/v1/reports", json=create_payload(), headers=auth_header)
    assert created.status_code == 201
    report_id = created.json()["id"]

    marked = client.post(f"/api/v1/reports/{report_id}/mark-found", headers=auth_header)
    assert marked.status_code == 200, marked.text
    assert marked.json()["report_type"] == "LOST"
    assert marked.json()["status"] == "CLOSED"

    reopened = client.patch(f"/api/v1/reports/{report_id}/status", json={"status": "OPEN"}, headers=auth_header)
    assert reopened.status_code == 200
    assert reopened.json()["report_type"] == "LOST"
    assert reopened.json()["status"] == "OPEN"
