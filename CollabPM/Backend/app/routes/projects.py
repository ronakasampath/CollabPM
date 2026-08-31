from flask import Blueprint, request, jsonify, g

from app.models.user import User
from app.models.project import Project, ProjectRole
from app.services import project_service as ps
from app.services import section_service as ss
from app.services.project_service import ServiceError
from app.utils.decorators import login_required, project_role_required
from app.services import invitation_service as inv

# Mounted at /api/projects.
projects_bp = Blueprint("projects", __name__)


@projects_bp.post("")
@login_required
def create_project():
    """POST /api/projects -> create a project; the caller becomes its leader."""
    data = request.get_json(silent=True) or {}
    try:
        project = ps.create_project(g.current_user, data.get("name", ""), data.get("description", ""))
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(project=project.to_dict()), 201


@projects_bp.get("")
@login_required
def list_projects():
    """GET /api/projects -> the projects the caller belongs to."""
    projects = ps.user_projects(g.current_user.id)
    return jsonify(projects=[p.to_dict() for p in projects]), 200


@projects_bp.get("/<int:project_id>")
@project_role_required("member")
def get_project(project_id):
    """GET /api/projects/<id> -> project detail incl. members + section tree."""
    project = Project.query.get(project_id)
    data = project.to_dict()
    data["sections"] = ss.project_tree(project)
    return jsonify(project=data), 200


@projects_bp.post("/<int:project_id>/members")
@project_role_required("leader")
def add_member(project_id):
    """POST /api/projects/<id>/members -> leader adds a member (by user_id or email)."""
    data = request.get_json(silent=True) or {}
    user = None
    if data.get("user_id"):
        user = User.query.get(data["user_id"])
    elif data.get("email"):
        user = User.query.filter_by(email=data["email"].strip().lower()).first()
    if user is None:
        return jsonify(error="User not found."), 404

    role = ProjectRole.leader if data.get("role") == "leader" else ProjectRole.member
    try:
        member = ps.add_member(Project.query.get(project_id), user, role)
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(member=member.to_dict()), 201


@projects_bp.post("/<int:project_id>/leader")
@project_role_required("leader")
def reassign_leader(project_id):
    """POST /api/projects/<id>/leader -> hand leadership to another member."""
    data = request.get_json(silent=True) or {}
    if not data.get("user_id"):
        return jsonify(error="user_id is required."), 400
    try:
        ps.set_leader(Project.query.get(project_id), data["user_id"])
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(project=Project.query.get(project_id).to_dict()), 200


@projects_bp.post("/<int:project_id>/sections")
@project_role_required("member")
def create_section(project_id):
    """POST /api/projects/<id>/sections -> add a section/subsection."""
    data = request.get_json(silent=True) or {}
    try:
        section = ss.create_section(
            Project.query.get(project_id),
            title=data.get("title", ""),
            description=data.get("description", ""),
            parent_id=data.get("parent_id"),
            assignee_ids=data.get("assignee_ids"),
            duration_hours=data.get("duration_hours"),
        )
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(section=section.to_dict()), 201

@projects_bp.post("/<int:project_id>/invitations")
@project_role_required("leader")
def invite_member_route(project_id):
    data = request.get_json(silent=True) or {}
    user = User.query.get(data.get("user_id")) if data.get("user_id") else None
    if user is None:
        return jsonify(error="user_id is required and must be valid."), 400
    try:
        invite = inv.invite_member(
            Project.query.get(project_id), g.current_user, user, data.get("role", "member")
        )
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(invitation=invite.to_dict()), 201



@projects_bp.post("/<int:project_id>/permissions")
@project_role_required("leader")
def set_permissions_route(project_id):
    data = request.get_json(silent=True) or {}
    if not data.get("user_id"):
        return jsonify(error="user_id is required."), 400
    try:
        member = ps.set_member_permissions(
            Project.query.get(project_id),
            data["user_id"],
            can_manage_sections=data.get("can_manage_sections"),
            can_review_work=data.get("can_review_work"),
        )
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(member=member.to_dict()), 200


@projects_bp.post("/<int:project_id>/discontinue")
@project_role_required("leader")
def discontinue_route(project_id):
    project = ps.discontinue_project(Project.query.get(project_id))
    return jsonify(project=project.to_dict()), 200


@projects_bp.post("/<int:project_id>/reactivate")
@project_role_required("leader")
def reactivate_route(project_id):
    try:
        project = ps.reactivate_project(Project.query.get(project_id))
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(project=project.to_dict()), 200


@projects_bp.get("/<int:project_id>/sections/flat")
@project_role_required("member")
def list_sections_flat(project_id):
    def flatten(nodes):
        out = []
        for n in nodes:
            out.append(n)
            out.extend(flatten(n.children))
        return out
    project = Project.query.get(project_id)
    all_sections = flatten(project.sections)
    return jsonify(sections=[
        {"id": s.id, "title": s.title, "parent_id": s.parent_id} for s in all_sections
    ]), 200