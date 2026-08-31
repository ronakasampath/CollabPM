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