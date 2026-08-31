from datetime import datetime, timezone

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

    # Start the deadline clock the first time this section gets an assignee.
    if section.assignees and section.started_at is None and section.duration_hours is not None:
        section.started_at = datetime.now(timezone.utc)

    db.session.commit()

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


def submit_for_review(section: Section, user):
    if user.id not in {u.id for u in section.assignees}:
        raise ServiceError("Only an assignee can submit this for review.", 403)
    if section.status == SectionStatus.done:
        raise ServiceError("This is already marked done.", 409)
    section.status = SectionStatus.pending_review
    db.session.commit()

    from app.services.notification_service import notify_submitted_for_review
    notify_submitted_for_review(section, user)
    return section


def _maybe_complete_project(project):
    """If every top-level section is done, the project is finished on its
    own -- distinct from being manually discontinued."""
    top = [s for s in project.sections if s.parent_id is None]
    if top and all(s.status == SectionStatus.done for s in top):
        project.status = "completed"


def review_section(section: Section, approve: bool):
    if section.status != SectionStatus.pending_review:
        raise ServiceError("This section is not awaiting review.", 409)
    section.status = SectionStatus.done if approve else SectionStatus.in_progress
    if approve:
        section.completed_at = datetime.now(timezone.utc)
        _maybe_complete_project(section.project)
    db.session.commit()
    return section


def edit_section(section, title=None, description=None):
    if title is not None:
        if not title.strip():
            raise ServiceError("Title cannot be empty.", 400)
        section.title = title.strip()
    if description is not None:
        section.description = description.strip()
    db.session.commit()
    return section


def _subtree_ids(section):
    ids = [section.id]
    for c in section.children:
        ids.extend(_subtree_ids(c))
    return ids


def delete_section(section):
    from app.models.vote import Vote
    ids = _subtree_ids(section)
    # Detach any votes pointing at this section or its descendants rather than
    # leaving a dangling foreign key.
    Vote.query.filter(Vote.section_id.in_(ids)).update({Vote.section_id: None}, synchronize_session=False)
    db.session.delete(section)
    db.session.commit()



def set_schedule(section, predecessor_ids=None, due_at=None, duration_hours=None):
    """Update a section's scheduling info. Any of the three args left as None
    (Python default) means "don't touch this field" -- pass explicit values,
    including empty list / None-as-clear, to actually change something.
    """
    if predecessor_ids is not None:
        # Predecessors must belong to the same project, and a section can't
        # depend on itself.
        candidates = (
            Section.query.filter(Section.project_id == section.project_id, Section.id.in_(predecessor_ids))
            .all()
        )
        section.predecessors = [s for s in candidates if s.id != section.id]

    if due_at is not None:
        if due_at == "":
            section.due_at = None
        else:
            try:
                dt = datetime.fromisoformat(str(due_at).replace("Z", "+00:00"))
            except Exception:
                raise ServiceError("Invalid due_at (use ISO 8601).", 400)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            section.due_at = dt
            section.duration_hours = None  # explicit date overrides duration mode

    if duration_hours is not None:
        section.duration_hours = duration_hours if duration_hours != "" else None
        if section.duration_hours is not None:
            section.due_at = None  # duration mode overrides explicit date
            # If it has no predecessors, start the clock now (same rule as
            # assign_users already uses).
            if not section.predecessors and section.started_at is None:
                section.started_at = datetime.now(timezone.utc)

    db.session.commit()
    return section