from datetime import datetime, timezone

from app.extensions import db
from app.models.vote import Vote, VoteBallot
from app.models.section import Section
from app.services.project_service import ServiceError


def _subtree_assignee_ids(section):
    ids = set()
    def walk(s):
        for u in s.assignees:
            ids.add(u.id)
        for c in s.children:
            walk(c)
    walk(section)
    return ids


def _top_ancestor(section):
    while section.parent is not None:
        section = section.parent
    return section


def resolve_audience(project, section, scope):
    """Turn the chosen scope into a concrete list of user_ids allowed to vote."""
    if scope == "subsection" and section is not None:
        return sorted(_subtree_assignee_ids(section))
    if scope == "main_section" and section is not None:
        return sorted(_subtree_assignee_ids(_top_ancestor(section)))
    return sorted({m.user_id for m in project.memberships})  # all_members


def _parse_closes(value):
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        raise ServiceError("Invalid closes_at (use ISO 8601).", 400)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def call_vote(project, caller, *, section_id, title, description, scope, options, anonymous, closes_at):
    if not title or not title.strip():
        raise ServiceError("Vote title is required.", 400)

    clean = [o for o in (options or []) if (o.get("text") or "").strip()]
    if len(clean) < 2:
        raise ServiceError("Provide at least two options.", 400)

    section = None
    if section_id is not None:
        section = Section.query.filter_by(id=section_id, project_id=project.id).first()
        if section is None:
            raise ServiceError("Section not found in this project.", 404)

    if not closes_at:
        raise ServiceError("A closing time is required.", 400)
    dt = _parse_closes(closes_at)

    if scope not in ("all_members", "main_section", "subsection"):
        scope = "all_members"
    audience = resolve_audience(project, section, scope)

    vote = Vote(
        project_id=project.id,
        section_id=section.id if section else None,
        title=title.strip(),
        description=(description or "").strip(),
        created_by=caller.id,
        anonymous=bool(anonymous),
        scope=scope,
        audience=audience,
        closes_at=dt,
        options=[
            {
                "id": f"opt{i + 1}",
                "text": o["text"].strip(),
                "image": (o.get("image") or "").strip(),
                "link": (o.get("link") or "").strip(),
                "count": 0,
            }
            for i, o in enumerate(clean)
        ],
    )
    db.session.add(vote)
    db.session.commit()
    return vote


def cast_ballot(vote_id, user, option_id):
    """The ONLY way a count changes. Locks the vote row, verifies eligibility
    and no prior ballot, increments the chosen option, records the ballot.
    """
    # with_for_update locks this vote's row on Postgres so two simultaneous
    # casts can't both read the same count and lose an increment.
    vote = db.session.query(Vote).filter_by(id=vote_id).with_for_update().first()
    if vote is None:
        raise ServiceError("Vote not found.", 404)

    closes = vote.closes_at
    if closes.tzinfo is None:
        closes = closes.replace(tzinfo=timezone.utc)
    if closes <= datetime.now(timezone.utc):
        raise ServiceError("This vote has closed.", 409)

    if user.id not in (vote.audience or []):
        raise ServiceError("You are not eligible to vote in this poll.", 403)

    if VoteBallot.query.filter_by(vote_id=vote.id, user_id=user.id).first():
        raise ServiceError("You have already voted.", 409)

    # Reassign a NEW options list (not an in-place edit) so SQLAlchemy detects
    # the JSON change and writes it back.
    found = False
    new_options = []
    for o in vote.options:
        if o["id"] == option_id:
            o = {**o, "count": o["count"] + 1}
            found = True
        new_options.append(o)
    if not found:
        raise ServiceError("Unknown option.", 400)

    vote.options = new_options
    db.session.add(VoteBallot(vote_id=vote.id, user_id=user.id))
    db.session.commit()
    return vote


def project_votes(project_id):
    return Vote.query.filter_by(project_id=project_id).order_by(Vote.created_at.desc()).all()
