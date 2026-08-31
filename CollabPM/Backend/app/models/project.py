import enum
from datetime import datetime, timezone

from app.extensions import db


class ProjectRole(enum.Enum):
    """A user's role WITHIN a project (not their system role)."""

    leader = "leader"
    member = "member"


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    memberships = db.relationship(
        "ProjectMember", back_populates="project", cascade="all, delete-orphan"
    )
    sections = db.relationship(
        "Section", back_populates="project", cascade="all, delete-orphan"
    )

    def leader_membership(self):
        return next((m for m in self.memberships if m.role == ProjectRole.leader), None)

    def to_dict(self, with_members=True):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if with_members:
            data["members"] = [m.to_dict() for m in self.memberships]
        return data

    status = db.Column(db.String(20), nullable=False, default="active")


class ProjectMember(db.Model):
    """Join row between a user and a project, carrying the project-level role.
    One person can be a leader in one project and a member in another, which is
    why this can't live on the User row.
    """

    __tablename__ = "project_members"
    __table_args__ = (
        db.UniqueConstraint("project_id", "user_id", name="uq_project_user"),
    )

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    role = db.Column(
        db.Enum(ProjectRole, name="project_role"),
        nullable=False,
        default=ProjectRole.member,
    )
    can_manage_sections = db.Column(db.Boolean, nullable=False, default=False)
    can_review_work = db.Column(db.Boolean, nullable=False, default=False)

    project = db.relationship("Project", back_populates="memberships")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "email": self.user.email if self.user else None,
            "role": self.role.value,
            "can_manage_sections": self.can_manage_sections,
            "can_review_work": self.can_review_work,
        }

