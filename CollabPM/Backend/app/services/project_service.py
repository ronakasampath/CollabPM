from app.extensions import db
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectRole


class ServiceError(Exception):
    """A business-rule failure the route turns into an HTTP error."""

    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def create_project(creator: User, name: str, description: str = "") -> Project:
    if not name or not name.strip():
        raise ServiceError("Project name is required.", 400)
    project = Project(name=name.strip(), description=(description or "").strip(), created_by=creator.id)
    db.session.add(project)
    db.session.flush()  # assigns project.id before we reference it below
    # The creator becomes the first leader.
    db.session.add(ProjectMember(project_id=project.id, user_id=creator.id, role=ProjectRole.leader))
    db.session.commit()
    return project


def get_membership(project_id, user_id):
    return ProjectMember.query.filter_by(project_id=project_id, user_id=user_id).first()


def user_projects(user_id):
    return (
        Project.query.join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )


def add_member(project: Project, user: User, role: ProjectRole = ProjectRole.member) -> ProjectMember:
    if get_membership(project.id, user.id):
        raise ServiceError("That user is already a member.", 409)
    m = ProjectMember(project_id=project.id, user_id=user.id, role=role)
    db.session.add(m)
    db.session.commit()

    # Alert the new member (in-app + email). Imported here to avoid a circular
    # import at module load time.
    from app.services.notification_service import notify_added_to_project
    notify_added_to_project(project, user.id)
    return m


def set_leader(project: Project, new_leader_user_id: int) -> ProjectMember:
    target = get_membership(project.id, new_leader_user_id)
    if not target:
        raise ServiceError("That user is not a member of the project.", 404)
    # Exactly one leader: demote everyone else, promote the target.
    for m in project.memberships:
        m.role = ProjectRole.leader if m.user_id == new_leader_user_id else ProjectRole.member
    db.session.commit()
    return target
