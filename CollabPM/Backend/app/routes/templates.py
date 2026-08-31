from flask import Blueprint, request, jsonify, g

from app.models.project import Project
from app.models.user import User
from app.services import template_service as ts
from app.services.project_service import ServiceError
from app.services.invitation_service import search_users
from app.utils.decorators import login_required, project_role_required

templates_bp = Blueprint("templates", __name__)


@templates_bp.get("/templates/mine")
@login_required
def list_mine():
    return jsonify(templates=[t.to_dict() for t in ts.list_my_templates(g.current_user.id)]), 200


@templates_bp.get("/templates/shared")
@login_required
def list_shared():
    return jsonify(templates=[t.to_dict() for t in ts.list_shared_templates(g.current_user.id)]), 200


@templates_bp.get("/templates/explore")
@login_required
def list_explore():
    return jsonify(templates=[t.to_dict() for t in ts.list_public_templates(g.current_user.id)]), 200


@templates_bp.get("/templates/<int:template_id>")
@login_required
def get_one(template_id):
    try:
        template = ts.get_template(template_id, g.current_user.id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(template=template.to_dict()), 200


@templates_bp.delete("/templates/<int:template_id>")
@login_required
def delete_one(template_id):
    try:
        ts.delete_template(template_id, g.current_user.id)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(message="Template deleted."), 200


@templates_bp.post("/templates/<int:template_id>/adopt")
@login_required
def adopt(template_id):
    try:
        template = ts.get_template(template_id, g.current_user.id)
        ts.adopt_public_template(template, g.current_user)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(template=template.to_dict()), 200


@templates_bp.post("/templates/<int:template_id>/share")
@login_required
def share(template_id):
    data = request.get_json(silent=True) or {}
    invitee = User.query.get(data.get("user_id")) if data.get("user_id") else None
    if invitee is None:
        return jsonify(error="user_id is required and must be valid."), 400
    try:
        template = ts.get_template(template_id, g.current_user.id)
        ts.grant_template_access(template, g.current_user, invitee)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(message="Access granted."), 201


@templates_bp.get("/templates/<int:template_id>/user-search")
@login_required
def user_search(template_id):
    q = request.args.get("q", "")
    results = search_users(q)  # no project scoping needed here
    return jsonify(users=[{"id": u.id, "username": u.username, "email": u.email} for u in results]), 200


@templates_bp.post("/projects/<int:project_id>/save-as-template")
@project_role_required("leader")
def save_as_template(project_id):
    data = request.get_json(silent=True) or {}
    try:
        template = ts.save_project_as_template(
            Project.query.get(project_id),
            g.current_user,
            data.get("name", ""),
            data.get("description", ""),
            data.get("is_public", False),
            data.get("use_generic_names", False),
        )
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(template=template.to_dict()), 201


@templates_bp.post("/projects/<int:project_id>/apply-template")
@project_role_required("leader")
def apply_template_route(project_id):
    data = request.get_json(silent=True) or {}
    if not data.get("template_id"):
        return jsonify(error="template_id is required."), 400
    try:
        template = ts.get_template(data["template_id"], g.current_user.id)
        ts.apply_template_to_project(Project.query.get(project_id), template)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    project = Project.query.get(project_id)
    return jsonify(project=project.to_dict()), 200