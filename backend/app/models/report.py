from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    report_type: Mapped[str] = mapped_column(String(10), index=True)  # LOST / FOUND
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    description: Mapped[str] = mapped_column(Text)
    item_date: Mapped[date] = mapped_column(Date, index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    colour: Mapped[str] = mapped_column(String(80), index=True)
    special_features: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_question: Mapped[str | None] = mapped_column(String(500), nullable=True)
    storage_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="reports")
    category = relationship("Category", back_populates="reports")
    location = relationship("Location", back_populates="reports")
    images = relationship("ReportImage", back_populates="report", cascade="all, delete-orphan", order_by="ReportImage.id")
    claims = relationship("Claim", back_populates="report", cascade="all, delete-orphan", order_by="Claim.created_at")
    flags = relationship("ReportFlag", back_populates="report", cascade="all, delete-orphan")
    status_history = relationship("ReportStatusHistory", back_populates="report", cascade="all, delete-orphan")


class ReportImage(Base):
    __tablename__ = "report_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    report = relationship("Report", back_populates="images")
