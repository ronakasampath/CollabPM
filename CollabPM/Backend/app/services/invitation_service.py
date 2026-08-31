from datetime import datetime, timezone

from app.extensions import db
from app.models.user import User
from app.models.invitation import Invitation, InvitationStatus
from app.models.project import Project, ProjectMember, ProjectRole
from app.services.project_service import ServiceError, get_membership
from app.services.notification_service import notify


def search_users(query, exclude_project_id=None, limit=10):
    q = (query or "").strip()
    if not q:
        return []
    like = f"%{q}%"
    base = User.query.filter(db.or_(User.username.ilike(like), User.email.ilike(like)))
    if exclude_project_id is not None:
        member_ids = {m.user_id for m in ProjectMember.query.filter_by(project_id=exclude_project_id).all()}
        pending_ids = {
            i.invited_user_id
            for i in Invitation.query.filter_by(
                project_id=exclude_project_id, status=InvitationStatus.pending
            ).all()
        }
        exclude_ids = member_ids | pending_ids
        if exclude_ids:
            base = base.filter(~User.id.in_(exclude_ids))
    return base.order_by(User.username).limit(limit).all()


def invite_member(project: Project, inviter: User, invitee: User, role="member"):
    if get_membership(project.id, invitee.id):
        raise ServiceError("That user is already a member.", 409)
    existing = Invitation.query.filter_by(
        project_id=project.id, invited_user_id=invitee.id, status=InvitationStatus.pending
    ).first()
    if existing:
        raise ServiceError("An invitation is already pending for that user.", 409)

    role = "leader" if role == "leader" else "member"
    invite = Invitation(project_id=project.id, invited_user_id=invitee.id, invited_by=inviter.id, role=role)
    db.session.add(invite)
    db.session.commit()

    notify(
        invitee.id,
        "project_invite",
        f"{inviter.username} invited you to '{project.name}'",
        body=f"Join '{project.name}' as a {role}.",
        link=f"/project?project={project.id}",
        project_id=project.id,
    )
    return invite


def list_invitations_for_user(user_id):
    return (
        Invitation.query.filter_by(invited_user_id=user_id, status=InvitationStatus.pending)
        .order_by(Invitation.created_at.desc())
        .all()
    )


def respond_invitation(invitation_id, user, accept: bool):
    invite = Invitation.query.get(invitation_id)
    if invite is None or invite.invited_user_id != user.id:
        raise ServiceError("Invitation not found.", 404)
    if invite.status != InvitationStatus.pending:
        raise ServiceError("This invitation has already been responded to.", 409)

    invite.responded_at = datetime.now(timezone.utc)
    if accept:
        invite.status = InvitationStatus.accepted
        role = ProjectRole.leader if invite.role == "leader" else ProjectRole.member
        db.session.add(ProjectMember(project_id=invite.project_id, user_id=user.id, role=role))
    else:
        invite.status = InvitationStatus.declined

    db.session.commit()
    return invite