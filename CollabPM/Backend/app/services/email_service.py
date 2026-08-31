import smtplib
import ssl
from email.message import EmailMessage

from flask import current_app


def send_email(to_address, subject, body):
    """Send a plain-text email via SMTP.

    If MAIL_USERNAME / MAIL_PASSWORD are not configured, we DON'T fail -- we log
    the email to the server console instead, so the whole verification /
    notification flow is testable locally without real credentials.
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
        context = ssl.create_default_context()
        with smtplib.SMTP(cfg["MAIL_SERVER"], cfg["MAIL_PORT"], timeout=15) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(username, password)
            server.send_message(msg)
        current_app.logger.info("Email sent to %s: %s", to_address, subject)
        return True
    except smtplib.SMTPAuthenticationError:
        current_app.logger.error(
            "SMTP authentication failed for %s. Check MAIL_USERNAME/MAIL_PASSWORD "
            "(Gmail requires an App Password, not your normal password).",
            username,
        )
        return False
    except Exception as exc:  # noqa: BLE001 - log everything, never crash the caller
        current_app.logger.error("Failed to send email to %s: %s", to_address, exc)
        return False