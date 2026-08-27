from flask import Blueprint, request, jsonify, g

from app.models.vote import Vote
from app.models.project import Project
from app.services import vote_service as vs
from app.services import project_service as ps
from app.services.project_service import ServiceError
from app.utils.decorators import login_required, project_role_required

# Registered at /api (routes carry their own full paths).
votes_bp = Blueprint("votes", __name__)


@votes_bp.post("/projects/<int:project_id>/votes")
@project_role_required("member")
def create_vote(project_id):
    """Any project member can call a vote on a section (or the whole project)."""
    data = request.get_json(silent=True) or {}
    try:
        vote = vs.call_vote(
            Project.query.get(project_id),
            g.current_user,
            section_id=data.get("section_id"),
            title=data.get("title", ""),
            description=data.get("description", ""),
            scope=data.get("scope", "all_members"),
            options=data.get("options"),
            anonymous=data.get("anonymous", False),
            closes_at=data.get("closes_at"),
        )
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(vote=vote.to_dict(g.current_user.id)), 201


@votes_bp.get("/projects/<int:project_id>/votes")
@project_role_required("member")
def list_votes(project_id):
    votes = vs.project_votes(project_id)
    return jsonify(votes=[v.to_dict(g.current_user.id) for v in votes]), 200


@votes_bp.get("/votes/<int:vote_id>")
@login_required
def get_vote(vote_id):
    vote = Vote.query.get(vote_id)
    if vote is None:
        return jsonify(error="Vote not found."), 404
    if ps.get_membership(vote.project_id, g.current_user.id) is None:
        return jsonify(error="You are not a member of this project."), 403
    return jsonify(vote=vote.to_dict(g.current_user.id)), 200


@votes_bp.post("/votes/<int:vote_id>/ballot")
@login_required
def cast_ballot(vote_id):
    """Cast one ballot. Increments a count; there is no way to edit counts."""
    data = request.get_json(silent=True) or {}
    if not data.get("option_id"):
        return jsonify(error="option_id is required."), 400
    try:
        vote = vs.cast_ballot(vote_id, g.current_user, data["option_id"])
    except ServiceError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(vote=vote.to_dict(g.current_user.id)), 200
