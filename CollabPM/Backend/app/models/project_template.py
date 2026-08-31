from datetime import datetime, timezone

from app.extensions import db


class ProjectTemplate(db.Model):
    __tablename__ = "project_templates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    is_public = db.Column(db.Boolean, nullable=False, default=False)
    # The whole section tree, structure only (titles, nesting, predecessor
    # links by local index, durations) -- no assignees, no real IDs.
    structure = db.Column(db.JSON, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "created_by": self.created_by,
            "is_public": self.is_public,
            "structure": self.structure,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }