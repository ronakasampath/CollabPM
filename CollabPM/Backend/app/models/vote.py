from datetime import datetime, timezone

from app.extensions import db


class Vote(db.Model):
    """A poll called on a section (or the whole project).

    Design constraints from the spec:
      - Options and their running COUNTS live in ONE JSON column, because the
        number of options varies per vote.
      - Only counts are stored as results -- never who chose what.
      - There is NO endpoint that edits options or counts. The only thing that
        can change a count is a legitimate ballot (see vote_service.cast_ballot),
        so results cannot be tampered with, not even by a leader or admin.
    """

    __tablename__ = "votes"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    section_id = db.Column(db.Integer, db.ForeignKey("sections.id"), nullable=True)

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    anonymous = db.Column(db.Boolean, nullable=False, default=False)
    scope = db.Column(db.String(20), nullable=False, default="all_members")

    # Resolved list of user_ids allowed to vote (from the scope at creation).
    audience = db.Column(db.JSON, nullable=False, default=list)
    # [{id, text, image, link, count}] -- results are the `count`s.
    options = db.Column(db.JSON, nullable=False, default=list)

    closes_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self, user_id=None):
        total = sum(o.get("count", 0) for o in self.options)
        voted = False
        if user_id is not None:
            voted = (
                VoteBallot.query.filter_by(vote_id=self.id, user_id=user_id).first()
                is not None
            )
        return {
            "id": self.id,
            "project_id": self.project_id,
            "section_id": self.section_id,
            "title": self.title,
            "description": self.description or "",
            "created_by": self.created_by,
            "anonymous": self.anonymous,
            "scope": self.scope,
            "closes_at": self.closes_at.isoformat() if self.closes_at else None,
            "audience_size": len(self.audience or []),
            "total_votes": total,
            "options": [
                {
                    "id": o["id"],
                    "text": o["text"],
                    "image": o.get("image", ""),
                    "link": o.get("link", ""),
                    "count": o.get("count", 0),
                }
                for o in self.options
            ],
            "you_voted": voted,
        }


class VoteBallot(db.Model):
    """Records THAT a user voted in a poll -- never WHICH option. This is what
    enforces one-vote-per-person while keeping the vote count-only and (when
    anonymous) unlinkable to a choice. The unique constraint is the real guard
    against double voting.
    """

    __tablename__ = "vote_ballots"
    __table_args__ = (
        db.UniqueConstraint("vote_id", "user_id", name="uq_vote_user"),
    )

    id = db.Column(db.Integer, primary_key=True)
    vote_id = db.Column(db.Integer, db.ForeignKey("votes.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
