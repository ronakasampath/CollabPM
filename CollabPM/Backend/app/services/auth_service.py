import secrets
from datetime import datetime, timezone

from flask import current_app

from app.extensions import db
from app.models.user import User, SystemRole
from app.utils.security import hash_password, verify_password
from app.services.email_service import send_email


class AuthError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _new_code():
    # A 6-digit numeric code (secrets = cryptographically strong randomness).
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_code(user):
    code = _new_code()
    ttl = current_app.config["VERIFICATION_CODE_TTL"]
    user.verification_code = code
    user.code_expires_at = datetime.now(timezone.utc) + ttl
    db.session.commit()
    send_email(
        user.email,
        "Your CollabPM verification code",
        f"Your verification code is {code}. It expires in {int(ttl.total_seconds() // 60)} minutes.",
    )


def register_user(username: str, email: str, password: str) -> User:
    """Create an UNVERIFIED user and email them a verification code."""
    if User.query.filter_by(username=username).first():
        raise AuthError("That username is already taken.", status_code=409)
    existing = User.query.filter_by(email=email).first()
    if existing:
        if existing.is_verified:
            raise AuthError("That email is already registered.", status_code=409)
        # Unverified re-register: refresh password + resend a code.
        existing.password_hash = hash_password(password)
        existing.username = username
        db.session.commit()
        _send_code(existing)
        return existing

    user = User(username=username, email=email, password_hash=hash_password(password), is_verified=False)
    db.session.add(user)
    db.session.commit()
    _send_code(user)
    return user


def verify_email(email: str, code: str) -> User:
    """Confirm the emailed code, mark verified, and auto-promote admins."""
    user = User.query.filter_by(email=email).first()
    if user is None:
        raise AuthError("No account with that email.", status_code=404)
    if user.is_verified:
        return user
    if not user.verification_code or user.verification_code != (code or "").strip():
        raise AuthError("Incorrect verification code.", status_code=400)

    expires = user.code_expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is not None and expires < datetime.now(timezone.utc):
        raise AuthError("That code has expired. Request a new one.", status_code=400)

    user.is_verified = True
    user.verification_code = None
    user.code_expires_at = None
    # Auto-promote configured admin emails.
    if user.email in current_app.config.get("ADMIN_EMAILS", set()):
        user.system_role = SystemRole.admin
    db.session.commit()
    return user


def resend_code(email: str):
    user = User.query.filter_by(email=email).first()
    if user is None:
        raise AuthError("No account with that email.", status_code=404)
    if user.is_verified:
        raise AuthError("That account is already verified.", status_code=409)
    _send_code(user)


def authenticate(email: str, password: str) -> User:
    """Verify credentials. Blocks unverified accounts."""
    user = User.query.filter_by(email=email).first()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password.", status_code=401)
    if not user.is_verified:
        raise AuthError("Please verify your email before logging in.", status_code=403)
    return user
