import enum
from datetime import datetime, timezone

from app.extensions import db


class ReportTargetType(enum.Enum):
    project = "project"
    user = "user"


class ReportStatus(enum.Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    target_type = db.Column(db.Enum(ReportTargetType, name="report_target_type"), nullable=False)
    target_project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=True)
    target_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(ReportStatus, name="report_status"), nullable=False, default=ReportStatus.open)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    resolved_at = db.Column(db.DateTime(timezone=True), nullable=True)

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    target_project = db.relationship("Project", foreign_keys=[target_project_id])
    target_user = db.relationship("User", foreign_keys=[target_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "reporter_id": self.reporter_id,
            "reporter_username": self.reporter.username if self.reporter else None,
            "target_type": self.target_type.value,
            "target_project_id": self.target_project_id,
            "target_project_name": self.target_project.name if self.target_project else None,
            "target_user_id": self.target_user_id,
            "target_username": self.target_user.username if self.target_user else None,
            "reason": self.reason,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }