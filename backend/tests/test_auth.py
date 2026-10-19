def test_health(client):
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_and_login(client):
    register = client.post("/api/v1/auth/register", json={
        "email": "one@example.com",
        "password": "StrongPass123",
        "first_name": "One",
        "last_name": "Student",
    })
    assert register.status_code == 201
    assert register.json()["role"] == "STUDENT"

    duplicate = client.post("/api/v1/auth/register", json={
        "email": "one@example.com",
        "password": "StrongPass123",
        "first_name": "One",
        "last_name": "Student",
    })
    assert duplicate.status_code == 409

    login = client.post("/api/v1/auth/login", json={"email": "one@example.com", "password": "StrongPass123"})
    assert login.status_code == 200
    assert login.json()["access_token"]
