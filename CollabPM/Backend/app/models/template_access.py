from datetime import datetime, timezone

from app.extensions import db


class TemplateAccess(db.Model):
    """Grants one user access to one private (or public, though redundant
    there) template, distinct from the creator and distinct from is_public.
    """
    __tablename__ = "template_access"
    __table_args__ = (
        db.UniqueConstraint("template_id", "user_id", name="uq_template_user"),
    )

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey("project_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    granted_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship("User", foreign_keys=[user_id])