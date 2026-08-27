from datetime import datetime, timezone

from app.extensions import db


class Notification(db.Model):
    """An in-app alert for one user. Also emailed at creation time (best-effort).
    Kinds so far: 'added_to_project', 'assigned', 'deadline', 'vote'. New kinds
    just use a new `type` string.
    """

    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, default="")
    link = db.Column(db.String(300), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "body": self.body or "",
            "link": self.link,
            "project_id": self.project_id,
            "read": self.read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
