from datetime import datetime, timezone, timedelta

from app.extensions import db
from app.models.user import User
from app.models.notification import Notification
from app.models.section import Section, SectionStatus
from app.services.email_service import send_email


def notify(user_id, type_, title, body="", link=None, project_id=None, email=True, commit=True):
    """Create an in-app notification and (best-effort) email the user."""
    n = Notification(
        user_id=user_id, type=type_, title=title, body=body or "", link=link, project_id=project_id
    )
    db.session.add(n)
    if commit:
        db.session.commit()

    if email:
        user = User.query.get(user_id)
        if user and user.email:
            send_email(user.email, title, (body or title) + (f"\n\n{link}" if link else ""))
    return n


# --- event triggers used by other services ---

def notify_added_to_project(project, user_id):
    notify(
        user_id,
        "added_to_project",
        f"You were added to '{project.name}'",
        body=f"You are now a member of the project '{project.name}'.",
        link=f"/project?project={project.id}",
        project_id=project.id,
    )


def notify_assigned(section, user_ids):
    project = section.project
    for uid in user_ids:
        notify(
            uid,
            "assigned",
            f"New work assigned: {section.title}",
            body=f"You were assigned '{section.title}' in '{project.name}'.",
            link=f"/project?project={project.id}",
            project_id=project.id,
        )


# --- deadline scanning (run on a schedule) ---

def scan_deadlines(within_hours=24):
    """Create a 'deadline' notification for each assignee of an unfinished
    section whose personal deadline (started_at + duration) is within
    `within_hours`, if we haven't already alerted them for that section.
    Returns how many notifications were created. Meant to be run periodically.
    """
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(hours=within_hours)
    created = 0

    sections = (
        Section.query.filter(
            Section.status != SectionStatus.done,
            Section.started_at.isnot(None),
            Section.duration_hours.isnot(None),
        ).all()
    )
    for s in sections:
        started = s.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        deadline = started + timedelta(hours=s.duration_hours)
        if deadline > horizon:
            continue  # not near yet
        for u in s.assignees:
            already = Notification.query.filter_by(
                user_id=u.id, type="deadline", project_id=s.project_id
            ).filter(Notification.title.like(f"%{s.title}%")).first()
            if already:
                continue
            notify(
                u.id,
                "deadline",
                f"Deadline near: {s.title}",
                body=f"'{s.title}' in '{s.project.name}' is due by {deadline.isoformat()}.",
                link=f"/project?project={s.project_id}",
                project_id=s.project_id,
                commit=False,
            )
            created += 1
    db.session.commit()
    return created


# --- queries ---

def list_for_user(user_id, limit=50):
    return (
        Notification.query.filter_by(user_id=user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


def unread_count(user_id):
    return Notification.query.filter_by(user_id=user_id, read=False).count()


def mark_read(notification, read=True):
    notification.read = read
    db.session.commit()


def mark_all_read(user_id):
    Notification.query.filter_by(user_id=user_id, read=False).update({"read": True})
    db.session.commit()
