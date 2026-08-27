from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

# This module holds our extension objects, created bare (unbound to any app).
# Each is instantiated here and wired to a specific app later, inside
# create_app(), via <ext>.init_app(app). Keeping them here -- depending on
# nothing -- is what breaks the circular-import loop (models import `db` without
# importing the application).


# The ORM: maps our Python model classes to Postgres tables.
db = SQLAlchemy()

# JWTManager plugs token creation + verification into the app.
jwt = JWTManager()

# Migrate connects Alembic to our app + db. It powers the `flask db ...`
# commands that turn model changes into versioned SQL migration scripts.
migrate = Migrate()
