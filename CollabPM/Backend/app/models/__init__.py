# Importing the models here means that as soon as the `app.models` package is
# imported (which the factory does), SQLAlchemy -- and Alembic's autogenerate --
# become aware of every table. Add new model imports here as we create them.
from app.models.user import User, SystemRole  # noqa: F401
from app.models.project import Project, ProjectMember, ProjectRole  # noqa: F401
from app.models.section import Section, SectionStatus, section_assignees  # noqa: F401
from app.models.vote import Vote, VoteBallot  # noqa: F401
from app.models.notification import Notification  # noqa: F401
