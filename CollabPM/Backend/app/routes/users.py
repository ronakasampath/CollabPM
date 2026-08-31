from flask import Blueprint, request, jsonify

from app.services.invitation_service import search_users
from app.utils.decorators import login_required

users_bp = Blueprint("users", __name__)


@users_bp.get("/search")
@login_required
def search():
    """GET /api/users/search?q=...&project_id=... -> matching users."""
    q = request.args.get("q", "")
    project_id = request.args.get("project_id", type=int)
    results = search_users(q, exclude_project_id=project_id)
    return jsonify(users=[
        {"id": u.id, "username": u.username, "email": u.email} for u in results
    ]), 200

from app.services import report_service as rs
from app.models.user import User

@users_bp.post("/<int:user_id>/report")
@login_required
def report_user_route(user_id):
    data = request.get_json(silent=True) or {}
    target = User.query.get(user_id)
    if target is None:
        return jsonify(error="User not found."), 404
    try:
        report = rs.report_user(g.current_user, target, data.get("reason", ""))
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(report=report.to_dict()), 201