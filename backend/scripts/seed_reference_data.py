from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Category, Location

CATEGORIES = ["Charger", "Clothing", "ID Card", "Keys", "Laptop", "Phone", "Textbook", "Wallet", "Other"]
LOCATIONS = ["Library", "Computer Lab", "Student Central", "Cafeteria", "Car Park", "Lecture Theatre", "Recreation Centre", "Other"]


def seed():
    with SessionLocal() as db:
        for name in CATEGORIES:
            if db.scalar(select(Category).where(Category.name == name)) is None:
                db.add(Category(name=name))
        for name in LOCATIONS:
            if db.scalar(select(Location).where(Location.name == name)) is None:
                db.add(Location(name=name))
        db.commit()
    print("Reference data is ready.")


if __name__ == "__main__":
    seed()
