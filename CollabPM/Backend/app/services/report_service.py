from datetime import datetime, timezone

from app.extensions import db
from app.models.report import Report, ReportTargetType, ReportStatus
from app.models.user import User, SystemRole
from app.services.project_service import ServiceError
from app.services.email_service import send_email
from app.services.notification_service import notify


def _admin_ids():
    return [u.id for u in User.query.filter_by(system_role=SystemRole.admin).all()]


def report_project(reporter, project, reason):
    if not reason or not reason.strip():
        raise ServiceError("Please explain why you're reporting this project.", 400)
    report = Report(
        reporter_id=reporter.id,
        target_type=ReportTargetType.project,
        target_project_id=project.id,
        reason=reason.strip(),
    )
    db.session.add(report)
    db.session.commit()
    _alert_admins(report, f"Project reported: '{project.name}'")
    return report


def report_user(reporter, target_user, reason):
    if not reason or not reason.strip():
        raise ServiceError("Please explain why you're reporting this user.", 400)
    if target_user.id == reporter.id:
        raise ServiceError("You can't report yourself.", 400)
    report = Report(
        reporter_id=reporter.id,
        target_type=ReportTargetType.user,
        target_user_id=target_user.id,
        reason=reason.strip(),
    )
    db.session.add(report)
    db.session.commit()
    _alert_admins(report, f"User reported: '{target_user.username}'")
    return report


def _alert_admins(report, title):
    body = f"Reported by {report.reporter.username}.\n\nReason:\n{report.reason}"
    for admin_id in _admin_ids():
        notify(
            admin_id,
            "report",
            title,
            body=body,
            link="/admin/reports",
            email=True,
        )


def list_open_reports():
    return Report.query.filter_by(status=ReportStatus.open).order_by(Report.created_at.desc()).all()


def list_all_reports():
    return Report.query.order_by(Report.created_at.desc()).all()


def _resolve(report):
    report.status = ReportStatus.resolved
    report.resolved_at = datetime.now(timezone.utc)


def dismiss_report(report_id):
    report = Report.query.get(report_id)
    if report is None:
        raise ServiceError("Report not found.", 404)
    report.status = ReportStatus.dismissed
    report.resolved_at = datetime.now(timezone.utc)
    db.session.commit()
    return report


def suspend_project(report_id):
    report = Report.query.get(report_id)
    if report is None or report.target_project is None:
        raise ServiceError("Report or project not found.", 404)
    report.target_project.status = "suspended"
    _resolve(report)
    db.session.commit()
    return report


def reinstate_project(project_id):
    from app.models.project import Project
    project = Project.query.get(project_id)
    if project is None:
        raise ServiceError("Project not found.", 404)
    project.status = "active"
    db.session.commit()
    return project


def ban_user(report_id):
    report = Report.query.get(report_id)
    if report is None or report.target_user is None:
        raise ServiceError("Report or user not found.", 404)
    report.target_user.account_status = "banned"
    _resolve(report)
    db.session.commit()
    return report


def unban_user(user_id):
    user = User.query.get(user_id)
    if user is None:
        raise ServiceError("User not found.", 404)
    user.account_status = "active"
    db.session.commit()
    return user