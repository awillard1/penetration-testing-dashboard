"""Add auth tables and user auth columns."""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260827_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("username", sa.String(length=64), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("display_name", sa.String(length=128), nullable=True),
            sa.Column("hashed_password", sa.String(length=255), nullable=False),
            sa.Column("role", sa.String(length=32), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("client_id", sa.String(length=36), nullable=True),
            sa.Column("auth_provider", sa.String(length=32), nullable=False),
            sa.Column("external_subject", sa.String(length=255), nullable=True),
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
            sa.UniqueConstraint("external_subject"),
            sa.UniqueConstraint("username"),
        )
        op.create_index(op.f("ix_users_client_id"), "users", ["client_id"], unique=False)
        op.create_index(op.f("ix_users_username"), "users", ["username"], unique=False)
    else:
        columns = {column["name"] for column in inspector.get_columns("users")}
        with op.batch_alter_table("users") as batch_op:
            if "client_id" not in columns:
                batch_op.add_column(sa.Column("client_id", sa.String(length=36), nullable=True))
            if "auth_provider" not in columns:
                batch_op.add_column(
                    sa.Column("auth_provider", sa.String(length=32), nullable=False, server_default="local")
                )
            if "external_subject" not in columns:
                batch_op.add_column(sa.Column("external_subject", sa.String(length=255), nullable=True))
            if "last_login_at" not in columns:
                batch_op.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        user_indexes = {index["name"] for index in inspector.get_indexes("users")}
        if "ix_users_client_id" not in user_indexes:
            op.create_index("ix_users_client_id", "users", ["client_id"], unique=False)

    if "refresh_tokens" not in tables:
        op.create_table(
            "refresh_tokens",
            sa.Column("user_id", sa.String(length=36), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        op.create_index(
            op.f("ix_refresh_tokens_token_hash"),
            "refresh_tokens",
            ["token_hash"],
            unique=True,
        )
        op.create_index(
            op.f("ix_refresh_tokens_user_id"),
            "refresh_tokens",
            ["user_id"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "refresh_tokens" in tables:
        op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
        op.drop_index(op.f("ix_refresh_tokens_token_hash"), table_name="refresh_tokens")
        op.drop_table("refresh_tokens")
