"""Claim and handover workflow schema

Revision ID: 20260905_02
Revises: 20260813_01
"""
from alembic import op
import sqlalchemy as sa

revision = "20260905_02"
down_revision = "20260813_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("verification_question", sa.String(500), nullable=True))
    op.add_column("reports", sa.Column("storage_note", sa.Text(), nullable=True))

    op.add_column(
        "profiles",
        sa.Column("preferred_contact_method", sa.String(20), nullable=False, server_default="IN_APP"),
    )
    op.add_column(
        "profiles",
        sa.Column("notify_claim_updates", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "profiles",
        sa.Column("notify_status_changes", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "profiles",
        sa.Column("notify_handover", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "claims",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("claimant_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("verification_answer", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("staff_note", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("report_id", "claimant_id", name="uq_claim_report_claimant"),
    )
    op.create_index("ix_claims_report_id", "claims", ["report_id"])
    op.create_index("ix_claims_claimant_id", "claims", ["claimant_id"])
    op.create_index("ix_claims_status", "claims", ["status"])

    op.create_table(
        "handover_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("claim_id", sa.Integer(), sa.ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("handed_over_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_handover_records_claim_id", "handover_records", ["claim_id"], unique=True)
    op.create_index("ix_handover_records_staff_id", "handover_records", ["staff_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_type", sa.String(40), nullable=False, server_default="SYSTEM"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_type", "notifications", ["notification_type"])
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])

    op.create_table(
        "report_flags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(40), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="OPEN"),
        sa.Column("resolved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("report_id", "reporter_id", name="uq_flag_report_reporter"),
    )
    op.create_index("ix_report_flags_report_id", "report_flags", ["report_id"])
    op.create_index("ix_report_flags_reporter_id", "report_flags", ["reporter_id"])
    op.create_index("ix_report_flags_reason", "report_flags", ["reason"])
    op.create_index("ix_report_flags_status", "report_flags", ["status"])

    op.create_table(
        "report_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("old_status", sa.String(20), nullable=False),
        sa.Column("new_status", sa.String(20), nullable=False),
        sa.Column("changed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(255), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_report_status_history_report_id", "report_status_history", ["report_id"])


def downgrade() -> None:
    op.drop_table("report_status_history")
    op.drop_table("report_flags")
    op.drop_table("notifications")
    op.drop_table("handover_records")
    op.drop_table("claims")

    op.drop_column("profiles", "notify_handover")
    op.drop_column("profiles", "notify_status_changes")
    op.drop_column("profiles", "notify_claim_updates")
    op.drop_column("profiles", "preferred_contact_method")

    op.drop_column("reports", "storage_note")
    op.drop_column("reports", "verification_question")
