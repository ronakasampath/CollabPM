import enum
from datetime import datetime, timezone

from app.extensions import db


class InvitationStatus(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class Invitation(db.Model):
    __tablename__ = "invitations"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    invited_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    invited_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="member")
    status = db.Column(
        db.Enum(InvitationStatus, name="invitation_status"),
        nullable=False,
        default=InvitationStatus.pending,
    )
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    responded_at = db.Column(db.DateTime(timezone=True), nullable=True)

    project = db.relationship("Project")
    invitee = db.relationship("User", foreign_keys=[invited_user_id])
    inviter = db.relationship("User", foreign_keys=[invited_by])

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "project_name": self.project.name if self.project else None,
            "invited_by": self.invited_by,
            "inviter_username": self.inviter.username if self.inviter else None,
            "role": self.role,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }