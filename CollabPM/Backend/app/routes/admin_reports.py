from flask import Blueprint, request, jsonify

from app.services import report_service as rs
from app.services.project_service import ServiceError
from app.utils.decorators import admin_required

admin_reports_bp = Blueprint("admin_reports", __name__)


@admin_reports_bp.get("/reports")
@admin_required
def list_reports():
    status = request.args.get("status", "open")
    reports = rs.list_all_reports() if status == "all" else rs.list_open_reports()
    return jsonify(reports=[r.to_dict() for r in reports]), 200


@admin_reports_bp.post("/reports/<int:report_id>/dismiss")
@admin_required
def dismiss(report_id):
    try:
        report = rs.dismiss_report(report_id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(report=report.to_dict()), 200


@admin_reports_bp.post("/reports/<int:report_id>/suspend-project")
@admin_required
def suspend_project_route(report_id):
    try:
        report = rs.suspend_project(report_id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(report=report.to_dict()), 200


@admin_reports_bp.post("/reports/<int:report_id>/ban-user")
@admin_required
def ban_user_route(report_id):
    try:
        report = rs.ban_user(report_id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(report=report.to_dict()), 200


@admin_reports_bp.post("/projects/<int:project_id>/reinstate")
@admin_required
def reinstate_route(project_id):
    try:
        project = rs.reinstate_project(project_id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(project=project.to_dict()), 200


@admin_reports_bp.post("/users/<int:user_id>/unban")
@admin_required
def unban_route(user_id):
    try:
        user = rs.unban_user(user_id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(user=user.to_dict()), 200