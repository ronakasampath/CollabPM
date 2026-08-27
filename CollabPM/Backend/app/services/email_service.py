import smtplib
from email.message import EmailMessage

from flask import current_app


def send_email(to_address, subject, body):
    """Send a plain-text email via SMTP.

    If MAIL_USERNAME / MAIL_PASSWORD are not configured, we DON'T fail -- we log
    the email to the server console instead, so the whole verification /
    notification flow is testable locally without real credentials. Add Gmail
    SMTP settings to .env to switch on real delivery.

    Never let an email failure break the request that triggered it: we catch
    and log, and return a bool for whether it actually sent.
    """
    cfg = current_app.config
    username = cfg.get("MAIL_USERNAME")
    password = cfg.get("MAIL_PASSWORD")

    if not username or not password:
        current_app.logger.info(
            "[email:console] To: %s | Subject: %s\n%s", to_address, subject, body
        )
        print(f"\n--- EMAIL (console fallback) ---\nTo: {to_address}\nSubject: {subject}\n{body}\n--------------------------------\n")
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg.get("MAIL_FROM", username)
    msg["To"] = to_address
    msg.set_content(body)

    try:
        with smtplib.SMTP(cfg["MAIL_SERVER"], cfg["MAIL_PORT"], timeout=15) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001 - we log everything and move on
        current_app.logger.error("Failed to send email to %s: %s", to_address, exc)
        return False
