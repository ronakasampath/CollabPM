import enum
from datetime import datetime, timedelta, timezone

from app.extensions import db


class SectionStatus(enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    pending_review = "pending_review"
    done = "done"


# Many-to-many: a section can be assigned to one OR several members.
section_assignees = db.Table(
    "section_assignees",
    db.Column("section_id", db.Integer, db.ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

# Many-to-many, self-referential: which sections must finish before this one
# can start. A section with no predecessors can start immediately (or on an
# explicit due_at); sections that share a predecessor run in parallel.
section_predecessors = db.Table(
    "section_predecessors",
    db.Column("section_id", db.Integer, db.ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True),
    db.Column("predecessor_id", db.Integer, db.ForeignKey("sections.id", ondelete="CASCADE"), primary_key=True),
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

    # Explicit deadline, set directly. If present, this overrides the
    # duration-based calculation in computed_deadline() below.
    due_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Set the moment a section is approved as done (see section_service.py's
    # review_section). Used as the "start clock" for anything that lists this
    # section as a predecessor.
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

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

    # Self-referential many-to-many: the sections that must complete before
    # this one can start. Deliberately NOT a backref -- "predecessor of" and
    # "successor of" are different directions and we only need one here.
    predecessors = db.relationship(
        "Section",
        secondary=section_predecessors,
        primaryjoin=id == section_predecessors.c.section_id,
        secondaryjoin=id == section_predecessors.c.predecessor_id,
    )

    def computed_deadline(self):
        """Resolve this section's effective deadline, in priority order:
        1. An explicit due_at, if set.
        2. started_at + duration_hours, if this section has no predecessors.
        3. (latest predecessor completion) + duration_hours, once ALL
           predecessors are done. Returns None if any predecessor is still
           outstanding, or if there isn't enough information yet.
        """
        if self.due_at is not None:
            return self.due_at
        if self.duration_hours is None:
            return None

        if not self.predecessors:
            base = self.started_at
        else:
            done_times = [p.completed_at for p in self.predecessors if p.completed_at is not None]
            if len(done_times) < len(self.predecessors):
                return None  # not every predecessor has finished yet
            base = max(done_times)

        if base is None:
            return None
        return base + timedelta(hours=self.duration_hours)

    def to_dict(self, recursive=True):
        deadline = self.computed_deadline()
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
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "predecessor_ids": [p.id for p in self.predecessors],
            "computed_deadline": deadline.isoformat() if deadline else None,
            "assignees": [{"user_id": u.id, "username": u.username} for u in self.assignees],
        }
        if recursive:
            kids = sorted(self.children, key=lambda s: s.order_index)
            data["children"] = [c.to_dict() for c in kids]
        return data