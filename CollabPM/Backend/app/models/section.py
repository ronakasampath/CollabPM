import enum
from datetime import datetime, timezone

from app.extensions import db


class SectionStatus(enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


# Many-to-many: a section can be assigned to one OR several members.
section_assignees = db.Table(
    "section_assignees",
    db.Column("section_id", db.Integer, db.ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Section(db.Model):
    """One box in the recursive work breakdown. `parent_id` points at another
    section, so the table references itself -> arbitrary nesting.
    """

    __tablename__ = "sections"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=True, index=True)

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    order_index = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(
        db.Enum(SectionStatus, name="section_status"),
        nullable=False,
        default=SectionStatus.not_started,
    )
    # Duration model: store an amount; each assignee's personal deadline is
    # started_at + duration in their own timezone.
    duration_hours = db.Column(db.Integer, nullable=True)
    started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    project = db.relationship("Project", back_populates="sections")
    # Self-referential: children point back to this row via parent_id.
    children = db.relationship(
        "Section",
        backref=db.backref("parent", remote_side=[id]),
        cascade="all, delete-orphan",
        order_by="Section.order_index",
    )
    assignees = db.relationship("User", secondary=section_assignees)

    def to_dict(self, recursive=True):
        data = {
            "id": self.id,
            "project_id": self.project_id,
            "parent_id": self.parent_id,
            "title": self.title,
            "description": self.description or "",
            "order_index": self.order_index,
            "status": self.status.value,
            "duration_hours": self.duration_hours,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "assignees": [{"user_id": u.id, "username": u.username} for u in self.assignees],
        }
        if recursive:
            kids = sorted(self.children, key=lambda s: s.order_index)
            data["children"] = [c.to_dict() for c in kids]
        return data
