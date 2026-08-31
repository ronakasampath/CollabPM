from flask import Blueprint, jsonify, g

from app.services.invitation_service import list_invitations_for_user, respond_invitation
from app.services.project_service import ServiceError
from app.utils.decorators import login_required

invitations_bp = Blueprint("invitations", __name__)


@invitations_bp.get("/invitations")
@login_required
def list_mine():
    invites = list_invitations_for_user(g.current_user.id)
    return jsonify(invitations=[i.to_dict() for i in invites]), 200


@invitations_bp.post("/invitations/<int:invitation_id>/accept")
@login_required
def accept(invitation_id):
    try:
        invite = respond_invitation(invitation_id, g.current_user, accept=True)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(invitation=invite.to_dict()), 200


@invitations_bp.post("/invitations/<int:invitation_id>/decline")
@login_required
def decline(invitation_id):
    try:
        invite = respond_invitation(invitation_id, g.current_user, accept=False)
    except ServiceError as e:
        return jsonify(error=e.message), e.status_code
    return jsonify(invitation=invite.to_dict()), 200