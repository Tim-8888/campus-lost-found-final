import os
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-secret-key-only-0123456789-abcdef"

import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Category, Location


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.add_all([Category(name="Charger"), Category(name="Phone")])
        db.add_all([Location(name="Library"), Location(name="Student Central")])
        db.commit()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_header(client):
    client.post("/api/v1/auth/register", json={
        "email": "student@example.com",
        "password": "StrongPass123",
        "first_name": "Test",
        "last_name": "Student"
    })
    response = client.post("/api/v1/auth/login", json={"email": "student@example.com", "password": "StrongPass123"})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
