import secrets
from datetime import datetime, timedelta, timezone

from flask import current_app
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from app.extensions import db
from app.models.user import User, SystemRole
from app.utils.security import hash_password, verify_password
from app.services.email_service import send_email


class AuthError(Exception):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


UNVERIFIED_EXPIRY = timedelta(hours=1)


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


def _purge_expired_unverified(email=None, username=None):
    """Delete unverified accounts whose verification code has expired --
    freeing up their username/email for a new registration attempt."""
    cutoff = datetime.now(timezone.utc) - UNVERIFIED_EXPIRY
    query = User.query.filter(User.is_verified.is_(False), User.created_at < cutoff)
    if email:
        query = query.filter(db.or_(User.email == email, User.username == username))
    for stale_user in query.all():
        db.session.delete(stale_user)
    db.session.commit()


def register_user(username: str, email: str, password: str) -> User:
    """Create an UNVERIFIED user and email them a verification code."""
    _purge_expired_unverified(email=email, username=username)

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
    """Verify credentials. Blocks unverified and banned accounts."""
    user = User.query.filter_by(email=email).first()
    if user is None or user.password_hash is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password.", status_code=401)
    if not user.is_verified:
        raise AuthError("Please verify your email before logging in.", status_code=403)
    if user.account_status == "banned":
        raise AuthError("This account has been suspended.", status_code=403)
    return user


def request_password_reset(email: str):
    user = User.query.filter_by(email=email.strip().lower()).first()
    # Always behave the same whether or not the email exists, so attackers
    # can't use this endpoint to discover which emails are registered.
    if user is None:
        return
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.session.commit()

    reset_link = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={token}"
    send_email(
        user.email,
        "Reset your CollabPM password",
        f"Click the link below to reset your password. This link expires in 30 minutes.\n\n{reset_link}\n\nIf you didn't request this, ignore this email.",
    )


def reset_password(token: str, new_password: str):
    user = User.query.filter_by(reset_token=token).first()
    if user is None:
        raise AuthError("Invalid or expired reset link.", status_code=400)
    expires = user.reset_token_expires_at
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires is None or expires < datetime.now(timezone.utc):
        raise AuthError("Invalid or expired reset link.", status_code=400)
    if len(new_password) < 8:
        raise AuthError("Password must be at least 8 characters.", status_code=400)

    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.session.commit()


def _unique_username_from(base):
    base = "".join(c for c in base if c.isalnum() or c in "_-").strip() or "user"
    candidate = base
    n = 1
    while User.query.filter_by(username=candidate).first():
        n += 1
        candidate = f"{base}{n}"
    return candidate


def authenticate_with_google(credential: str) -> User:
    """Verify a Google ID token and log in / auto-register the user."""
    try:
        info = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), current_app.config["GOOGLE_CLIENT_ID"]
        )
    except ValueError:
        raise AuthError("Invalid Google credential.", status_code=401)

    google_sub = info["sub"]
    email = info.get("email", "").lower()
    email_verified = info.get("email_verified", False)
    name = info.get("name") or email.split("@")[0]

    if not email_verified:
        raise AuthError("Your Google email isn't verified.", status_code=403)

    user = User.query.filter_by(google_sub=google_sub).first()
    if user is None:
        # Maybe they registered with email/password first -- link the accounts.
        user = User.query.filter_by(email=email).first()
        if user is not None:
            user.google_sub = google_sub
            user.is_verified = True  # Google already verified this email
        else:
            username = _unique_username_from(name)
            user = User(
                username=username, email=email, password_hash=None,
                google_sub=google_sub, is_verified=True,
            )
            db.session.add(user)

    if user.account_status == "banned":
        raise AuthError("This account has been suspended.", status_code=403)

    if user.email in current_app.config.get("ADMIN_EMAILS", set()):
        user.system_role = SystemRole.admin

    db.session.commit()
    return user