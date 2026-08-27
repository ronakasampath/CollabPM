from app.extensions import db
from app.models.user import User
from app.models.project import Project
from app.models.section import Section, SectionStatus
from app.services.project_service import ServiceError


def create_section(project: Project, *, title, description="", parent_id=None,
                   assignee_ids=None, duration_hours=None):
    if not title or not title.strip():
        raise ServiceError("Section title is required.", 400)

    if parent_id is not None:
        parent = Section.query.filter_by(id=parent_id, project_id=project.id).first()
        if parent is None:
            raise ServiceError("Parent section not found in this project.", 404)

    # New section goes to the end of its sibling group.
    sibling_count = Section.query.filter_by(project_id=project.id, parent_id=parent_id).count()

    section = Section(
        project_id=project.id,
        parent_id=parent_id,
        title=title.strip(),
        description=(description or "").strip(),
        order_index=sibling_count,
        duration_hours=duration_hours,
    )
    if assignee_ids:
        section.assignees = _members_only(project, assignee_ids)

    db.session.add(section)
    db.session.commit()
    return section


def top_level(project: Project):
    return (
        Section.query.filter_by(project_id=project.id, parent_id=None)
        .order_by(Section.order_index)
        .all()
    )


def project_tree(project: Project):
    return [s.to_dict() for s in top_level(project)]


def get_section(section_id):
    return Section.query.get(section_id)


def set_status(section: Section, status_value):
    try:
        section.status = SectionStatus(status_value)
    except ValueError:
        raise ServiceError("Invalid status.", 400)
    db.session.commit()
    return section


def assign_users(section: Section, user_ids):
    project = section.project
    before = {u.id for u in section.assignees}
    section.assignees = _members_only(project, user_ids)
    db.session.commit()

    # Notify only the NEWLY-assigned members (not ones already on it).
    newly = [u.id for u in section.assignees if u.id not in before]
    if newly:
        from app.services.notification_service import notify_assigned
        notify_assigned(section, newly)
    return section


def _members_only(project: Project, user_ids):
    """Keep only ids that are actually members of the project."""
    member_ids = {m.user_id for m in project.memberships}
    keep = [uid for uid in (user_ids or []) if uid in member_ids]
    return User.query.filter(User.id.in_(keep)).all() if keep else []
