import argparse
from getpass import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import Profile, User


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", choices=["STAFF", "ADMIN"], required=True)
    args = parser.parse_args()

    email = input("Email: ").strip().lower()
    first_name = input("First name: ").strip()
    last_name = input("Last name: ").strip()
    password = getpass("Password (min 8 chars): ")
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters.")

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            raise SystemExit("Email already exists.")
        user = User(email=email, password_hash=hash_password(password), role=args.role)
        user.profile = Profile(first_name=first_name, last_name=last_name)
        db.add(user)
        db.commit()
        print(f"Created {args.role}: {email}")


if __name__ == "__main__":
    main()
