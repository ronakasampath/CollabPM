import os
from datetime import timedelta

from dotenv import load_dotenv

# load_dotenv() reads the key=value pairs in Backend/.env and pushes them into
# the process environment (os.environ). This is how secrets (DB password, JWT
# key) stay OUT of source code and out of git. Called once, at import time.
load_dotenv()


class Config:
    """Central configuration for the Flask app.

    Why a class instead of loose constants?
      - Flask loads it in one call: app.config.from_object(Config)
      - We can subclass later (DevConfig / ProdConfig) to change behaviour per
        environment without rewriting anything else.
      - Every setting lives in one obvious place.

    Every value is read from an environment variable, with a safe fallback for
    local development so the app still boots if a var is missing.
    """

    # Flask uses SECRET_KEY to cryptographically sign things like session
    # cookies. Must be long, random, and secret in production.
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")

    # --- Database ---
    # The full PostgreSQL connection string, read from .env. Flask-SQLAlchemy
    # reads THIS exact key name to know what database to talk to. Format:
    #   postgresql://<user>:<password>@<host>:<port>/<dbname>
    # For CollabPM this points at your Supabase Postgres.
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")

    # SQLAlchemy has an event system that fires on every object change. We don't
    # use it, and leaving it on wastes memory, so we explicitly disable it.
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,  # test each connection with a lightweight query before use
        "pool_recycle": 280,  # proactively recycle connections before Supabase's idle timeout
    }

    # --- JWT (auth tokens) ---
    # The secret used to SIGN access tokens. Anyone who has this key can forge
    # valid tokens, so treat it like a password: long, random, secret in prod.
    # Falls back to SECRET_KEY, then a dev value, so the app still boots locally.
    JWT_SECRET_KEY = os.environ.get(
        "JWT_SECRET_KEY", os.environ.get("SECRET_KEY", "dev-only-change-me")
    )

    # How long an access token stays valid after login. After this, the client
    # must log in again (or use a refresh token, which we may add later).
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)

    # --- Admin accounts ---
    # Comma-separated emails that are auto-promoted to system admin on signup.
    ADMIN_EMAILS = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "rssamaraweera1104@gmail.com").split(",")
        if e.strip()
    }

    # --- Email (verification codes + notification alerts) ---
    # SMTP settings, read from .env. For Gmail: MAIL_SERVER=smtp.gmail.com,
    # MAIL_PORT=587, MAIL_USERNAME=<your gmail>, MAIL_PASSWORD=<app password>.
    # If username/password are unset, the email service logs to the console
    # instead of sending, so the whole flow is testable without real email.
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_FROM = os.environ.get("MAIL_FROM") or os.environ.get("MAIL_USERNAME") or "no-reply@collabpm.local"

    # How long an email verification code stays valid.
    VERIFICATION_CODE_TTL = timedelta(minutes=15)
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

