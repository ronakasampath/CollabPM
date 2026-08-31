from flask import Blueprint, request, jsonify, g

from app.services import section_service as ss
from app.services import project_service as ps
from app.services.project_service import ServiceError
from app.utils.decorators import login_required

# Mounted at /api/sections. Section-level actions look up the section first,
# then check the caller's membership in that section's project.
sections_bp = Blueprint("sections", __name__)


def _load_and_check(section_id, need_manage=False, need_review=False):
    """Returns (section, error_response). Exactly one is not None."""
    section = ss.get_section(section_id)
    if section is None:
        return None, (jsonify(error="Section not found."), 404)
    membership = ps.get_membership(section.project_id, g.current_user.id)
    if membership is None:
        return None, (jsonify(error="You are not a member of this project."), 403)
    is_leader = membership.role.value == "leader"
    if need_manage and not (is_leader or membership.can_manage_sections):
        return None, (jsonify(error="Section-management privileges required."), 403)
    if need_review and not (is_leader or membership.can_review_work):
        return None, (jsonify(error="Review privileges required."), 403)
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
    """POST /api/sections/<id>/assign  body: {user_ids: [..]}  (leader or manager)."""
    section, err = _load_and_check(section_id, need_manage=True)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    ss.assign_users(section, data.get("user_ids", []))
    return jsonify(section=section.to_dict(recursive=False)), 200


@sections_bp.post("/<int:section_id>/submit")
@login_required
def submit(section_id):
    section, err = _load_and_check(section_id)
    if err:
        return err
    try:
        ss.submit_for_review(section, g.current_user)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(section=section.to_dict(recursive=False)), 200


@sections_bp.post("/<int:section_id>/review")
@login_required
def review(section_id):
    """POST /api/sections/<id>/review  body: {approve: true|false}  (leader or reviewer)."""
    section, err = _load_and_check(section_id, need_review=True)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        ss.review_section(section, bool(data.get("approve")))
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(section=section.to_dict(recursive=False)), 200

@sections_bp.patch("/<int:section_id>")
@login_required
def update_section(section_id):
    section, err = _load_and_check(section_id, need_manage=True)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        ss.edit_section(section, title=data.get("title"), description=data.get("description"))
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(section=section.to_dict(recursive=False)), 200


@sections_bp.delete("/<int:section_id>")
@login_required
def delete_section_route(section_id):
    section, err = _load_and_check(section_id, need_manage=True)
    if err:
        return err
    ss.delete_section(section)
    return jsonify(message="Section deleted."), 200


@sections_bp.patch("/<int:section_id>/schedule")
@login_required
def schedule(section_id):
    section, err = _load_and_check(section_id, need_manage=True)
    if err:
        return err
    data = request.get_json(silent=True) or {}
    try:
        ss.set_schedule(
            section,
            predecessor_ids=data.get("predecessor_ids"),
            due_at=data.get("due_at"),
            duration_hours=data.get("duration_hours"),
        )
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(section=section.to_dict(recursive=False)), 200