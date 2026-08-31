from app.extensions import db
from app.models.project_template import ProjectTemplate
from app.models.section import Section
from app.services.project_service import ServiceError


def _generic_title(path):
    """path is a list of 1-based sibling positions, e.g. [1] -> 'Section 1',
    [1, 2] -> 'Section 1.2', [1, 2, 1] -> 'Section 1.2.1'."""
    return "Section " + ".".join(str(p) for p in path)


def _section_to_structure(section, index_map, next_index, use_generic_names, path):
    my_index = next_index[0]
    index_map[section.id] = my_index
    next_index[0] += 1

    children = sorted(section.children, key=lambda s: s.order_index)
    return {
        "local_index": my_index,
        "title": _generic_title(path) if use_generic_names else section.title,
        "description": "" if use_generic_names else (section.description or ""),
        "duration_hours": section.duration_hours,
        "predecessor_indices": [],
        "children": [
            _section_to_structure(c, index_map, next_index, use_generic_names, path + [i + 1])
            for i, c in enumerate(children)
        ],
    }

def _fill_predecessor_indices(node, section_lookup, index_map):
    section = section_lookup[node["local_index"]]
    node["predecessor_indices"] = [index_map[p.id] for p in section.predecessors if p.id in index_map]
    for child_node in node["children"]:
        _fill_predecessor_indices(child_node, section_lookup, index_map)


def save_project_as_template(project, creator, name, description="", is_public=False):
    if not name or not name.strip():
        raise ServiceError("Template name is required.", 400)

    top_level = sorted(
        [s for s in project.sections if s.parent_id is None], key=lambda s: s.order_index
    )
    index_map = {}
    next_index = [0]
    structure = [_section_to_structure(s, index_map, next_index) for s in top_level]

    # Second pass: now that every section has a local index, resolve
    # predecessor links. Build a lookup from local_index -> Section by
    # walking the real tree the same way.
    section_lookup = {}

    def collect(node, section):
        section_lookup[node["local_index"]] = section
        for child_node, child_section in zip(
            node["children"], sorted(section.children, key=lambda s: s.order_index)
        ):
            collect(child_node, child_section)

    for node, section in zip(structure, top_level):
        collect(node, section)
    for node in structure:
        _fill_predecessor_indices(node, section_lookup, index_map)

    template = ProjectTemplate(
        name=name.strip(),
        description=(description or "").strip(),
        created_by=creator.id,
        is_public=bool(is_public),
        structure=structure,
    )
    db.session.add(template)
    db.session.commit()
    return template
def save_project_as_template(project, creator, name, description="", is_public=False, use_generic_names=False):
    if not name or not name.strip():
        raise ServiceError("Template name is required.", 400)

    top_level = sorted(
        [s for s in project.sections if s.parent_id is None], key=lambda s: s.order_index
    )
    index_map = {}
    next_index = [0]
    structure = [
        _section_to_structure(s, index_map, next_index, use_generic_names, [i + 1])
        for i, s in enumerate(top_level)
    ]

    section_lookup = {}

    def collect(node, section):
        section_lookup[node["local_index"]] = section
        for child_node, child_section in zip(
            node["children"], sorted(section.children, key=lambda s: s.order_index)
        ):
            collect(child_node, child_section)

    for node, section in zip(structure, top_level):
        collect(node, section)
    for node in structure:
        _fill_predecessor_indices(node, section_lookup, index_map)

    template = ProjectTemplate(
        name=name.strip(),
        description=(description or "").strip(),
        created_by=creator.id,
        is_public=bool(is_public),
        structure=structure,
    )
    db.session.add(template)
    db.session.commit()
    return template

def list_templates(user_id):
    """Public templates plus the user's own private ones."""
    return (
        ProjectTemplate.query.filter(
            db.or_(ProjectTemplate.is_public.is_(True), ProjectTemplate.created_by == user_id)
        )
        .order_by(ProjectTemplate.created_at.desc())
        .all()
    )


def get_template(template_id, user_id):
    template = ProjectTemplate.query.get(template_id)
    if template is None:
        raise ServiceError("Template not found.", 404)
    if template.is_public or template.created_by == user_id:
        return template
    has_access = TemplateAccess.query.filter_by(template_id=template.id, user_id=user_id).first()
    if not has_access:
        raise ServiceError("You don't have access to this template.", 403)
    return template


def delete_template(template_id, user_id):
    template = get_template(template_id, user_id)
    if template.created_by != user_id:
        raise ServiceError("Only the creator can delete this template.", 403)
    db.session.delete(template)
    db.session.commit()


def apply_template_to_project(project, template):
    """Create real sections from a template's structure under `project`,
    preserving nesting and predecessor links. Returns the created top-level
    Section objects.
    """
    index_to_section = {}

    def create_node(node, parent_id, order_index):
        section = Section(
            project_id=project.id,
            parent_id=parent_id,
            title=node["title"],
            description=node.get("description", ""),
            duration_hours=node.get("duration_hours"),
            order_index=order_index,
        )
        db.session.add(section)
        db.session.flush()  # assigns section.id before children reference it
        index_to_section[node["local_index"]] = section
        for i, child in enumerate(node.get("children", [])):
            create_node(child, section.id, i)
        return section

    created = [create_node(node, None, i) for i, node in enumerate(template.structure)]

    # Second pass: wire up predecessor links now that every section has a
    # real id. Must happen after all sections exist, since predecessors can
    # point across the tree (e.g. a subsection depending on a sibling's).
    def wire_predecessors(node):
        section = index_to_section[node["local_index"]]
        section.predecessors = [
            index_to_section[i] for i in node.get("predecessor_indices", []) if i in index_to_section
        ]
        for child in node.get("children", []):
            wire_predecessors(child)

    for node in template.structure:
        wire_predecessors(node)

    db.session.commit()
    return created



from app.models.template_access import TemplateAccess
from app.services.notification_service import notify


def list_my_templates(user_id):
    return (
        ProjectTemplate.query.filter_by(created_by=user_id)
        .order_by(ProjectTemplate.created_at.desc())
        .all()
    )


def list_shared_templates(user_id):
    """Templates someone else explicitly granted this user access to."""
    return (
        ProjectTemplate.query.join(TemplateAccess, TemplateAccess.template_id == ProjectTemplate.id)
        .filter(TemplateAccess.user_id == user_id, ProjectTemplate.created_by != user_id)
        .order_by(ProjectTemplate.created_at.desc())
        .all()
    )


def list_public_templates(user_id):
    """Explore: every public template NOT already created or shared with you."""
    own_ids = {t.id for t in list_my_templates(user_id)}
    shared_ids = {t.id for t in list_shared_templates(user_id)}
    return (
        ProjectTemplate.query.filter(
            ProjectTemplate.is_public.is_(True),
            ~ProjectTemplate.id.in_(own_ids | shared_ids) if (own_ids | shared_ids) else True,
        )
        .order_by(ProjectTemplate.created_at.desc())
        .all()
    )


def grant_template_access(template, granter, invitee):
    if template.created_by != granter.id:
        raise ServiceError("Only the template's creator can share it.", 403)
    if invitee.id == template.created_by:
        raise ServiceError("The creator already has access.", 400)
    existing = TemplateAccess.query.filter_by(template_id=template.id, user_id=invitee.id).first()
    if existing:
        raise ServiceError("That user already has access.", 409)

    access = TemplateAccess(template_id=template.id, user_id=invitee.id, granted_by=granter.id)
    db.session.add(access)
    db.session.commit()

    notify(
        invitee.id,
        "template_shared",
        f"{granter.username} shared a template with you: '{template.name}'",
        body=f"You now have access to the '{template.name}' template.",
        link="/templates",
        email=True,
    )
    return access


def adopt_public_template(template, user):
    """Explore -> My-adjacent 'Shared' list, by granting the current user
    explicit access to a public template they picked up, so it stays visible
    to them even if the owner later flips it to private.
    """
    existing = TemplateAccess.query.filter_by(template_id=template.id, user_id=user.id).first()
    if existing or template.created_by == user.id:
        return existing
    access = TemplateAccess(template_id=template.id, user_id=user.id, granted_by=template.created_by)
    db.session.add(access)
    db.session.commit()
    return access