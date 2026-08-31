import enum
from datetime import datetime, timezone

from app.extensions import db


class SystemRole(enum.Enum):
    """A user's SYSTEM-wide role (not their role within a project).

    - admin: the developer (you). Elevated, system-level powers.
    - user:  every normal account. This is the default at signup.

    Project-level roles (leader/member) are NOT here -- they live per-project in
    the ProjectMember table, because the same person can be a leader in one
    project and a member in another.
    """

    admin = "admin"
    user = "user"


class User(db.Model):
    """A CollabPM user account. This class IS the `users` table."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)

    # bcrypt hash. Nullable because Google-sign-in-only accounts have none.
    password_hash = db.Column(db.String(255), nullable=True)

    # Google sign-in support: Google's stable, unique id for this user.
    # Set when the account was created via (or later linked to) Google.
    google_sub = db.Column(db.String(255), nullable=True, unique=True)

    # System role: admin or user. Everyone starts as a plain user; an admin is
    # promoted explicitly (via the `flask make-admin` command).
    system_role = db.Column(
        db.Enum(SystemRole, name="system_role"),
        nullable=False,
        default=SystemRole.user,
    )

    # active | banned -- set by admin action after a report is upheld.
    account_status = db.Column(db.String(20), nullable=False, default="active")

    # The user's IANA timezone (e.g. "Asia/Colombo"). We store it so we can show
    # each person their section deadlines in THEIR local time. Defaults to UTC.
    timezone = db.Column(db.String(64), nullable=False, default="UTC")

    # --- Email verification ---
    # Accounts start unverified; login is blocked until the emailed code is
    # confirmed. The code + its expiry are cleared once verified.
    is_verified = db.Column(db.Boolean, nullable=False, default=False)
    verification_code = db.Column(db.String(6), nullable=True)
    code_expires_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # --- Password reset ---
    reset_token = db.Column(db.String(64), nullable=True)
    reset_token_expires_at = db.Column(db.DateTime(timezone=True), nullable=True)

    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        """Serialize the SAFE fields for a JSON response. Never the hash."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "system_role": self.system_role.value,
            "timezone": self.timezone,
            "is_verified": self.is_verified,
            "account_status": self.account_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.username} ({self.system_role.value})>"