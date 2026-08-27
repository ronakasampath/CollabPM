from flask import Blueprint, request, jsonify, g

from app.services import section_service as ss
from app.services import project_service as ps
from app.services.project_service import ServiceError
from app.utils.decorators import login_required

# Mounted at /api/sections. Section-level actions look up the section first,
# then check the caller's membership in that section's project.
sections_bp = Blueprint("sections", __name__)


def _load_and_check(section_id, need_leader=False):
    """Returns (section, error_response). Exactly one is not None."""
    section = ss.get_section(section_id)
    if section is None:
        return None, (jsonify(error="Section not found."), 404)
    membership = ps.get_membership(section.project_id, g.current_user.id)
    if membership is None:
        return None, (jsonify(error="You are not a member of this project."), 403)
    if need_leader and membership.role.value != "leader":
        return None, (jsonify(error="Leader privileges required."), 403)
    return section, None


@sections_bp.patch("/<int:section_id>/status")
@login_required
def set_status(section_id):
    """PATCH /api/sections/<id>/status  body: {status: done|in_progress|not_started}"""
    section, err = _load_and_check(section_id)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        ss.set_status(section, data.get("status"))
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(section=section.to_dict(recursive=False)), 200


@sections_bp.post("/<int:section_id>/assign")
@login_required
def assign(section_id):
    """POST /api/sections/<id>/assign  body: {user_ids: [..]}  (leader only)."""
    section, err = _load_and_check(section_id, need_leader=True)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    ss.assign_users(section, data.get("user_ids", []))
    return jsonify(section=section.to_dict(recursive=False)), 200
