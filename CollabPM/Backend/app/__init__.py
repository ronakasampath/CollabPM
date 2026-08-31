import click
from flask import Flask
from flask_cors import CORS

from config import Config
from app.extensions import db, jwt, migrate




def create_app(config_class=Config):
    """Application factory: builds and returns a configured Flask app.

    Instead of a module-level `app = Flask(__name__)` that springs into
    existence the moment this file is imported, we build the app INSIDE a
    function. That matters because:

      1. Tests can call create_app() to get a fresh, isolated app each time,
         so state from one test can't leak into the next.
      2. Extensions (database, JWT, ...) get initialised in a controlled order
         inside this function, which avoids circular-import problems as the app
         grows.
      3. Nothing with side effects runs just because a module got imported.

    `config_class` is a parameter so tests can pass a different config later.
    """
    app = Flask(__name__)

    # Copy every UPPERCASE attribute from the Config class into app.config.
    app.config.from_object(config_class)

    # --- Initialise extensions ---
    # db was created (empty) in extensions.py. init_app binds it to THIS app,
    # reading SQLALCHEMY_DATABASE_URI from the config we just loaded. This is
    # the moment SQLAlchemy learns which database to connect to.
    db.init_app(app)

    # Bind the JWT manager to this app. It now reads JWT_SECRET_KEY from config
    # and can sign/verify tokens and power the @jwt_required() decorator.
    jwt.init_app(app)

    # Connect Alembic (migrations) to this app and db. Enables `flask db ...`.
    migrate.init_app(app, db)

    # --- CORS ---
    # Browsers block a page served from one origin (our frontend at
    # http://localhost:3000) from calling an API on a DIFFERENT origin
    # (http://localhost:5000) unless the API explicitly opts in with CORS
    # (Cross-Origin Resource Sharing) response headers. This line adds those
    # headers for our /api/* routes so the Next.js app is allowed to call them.
    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000"]}})

    # Import the models package so SQLAlchemy registers every table. Without
    # this, db.create_all() below wouldn't know the `users` table exists.
    from app import models  # noqa: F401

    # --- Register blueprints ---
    # A blueprint is a group of related routes defined in its own file. We
    # import it here (not at the top) to keep import order predictable and
    # avoid circular imports. url_prefix means every route in this blueprint
    # is served under /api (so /health becomes /api/health).
    from app.routes.health import health_bp
    app.register_blueprint(health_bp, url_prefix="/api")

    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from app.routes.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    from app.routes.projects import projects_bp
    app.register_blueprint(projects_bp, url_prefix="/api/projects")

    from app.routes.sections import sections_bp
    app.register_blueprint(sections_bp, url_prefix="/api/sections")

    from app.routes.votes import votes_bp
    app.register_blueprint(votes_bp, url_prefix="/api")

    from app.routes.notifications import notifications_bp
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")

    from app.routes.users import users_bp
    app.register_blueprint(users_bp, url_prefix="/api/users")

    from app.routes.invitations import invitations_bp
    app.register_blueprint(invitations_bp, url_prefix="/api")

    from app.routes.templates import templates_bp
    app.register_blueprint(templates_bp, url_prefix="/api")

    # --- Custom CLI command ---
    # Registers `flask init-db`. Running it creates every table that doesn't
    # already exist. This is a simple stand-in for real migrations; later we'll
    # upgrade to Flask-Migrate/Alembic so schema CHANGES are versioned too.
    @app.cli.command("init-db")
    def init_db():
        db.create_all()
        print("Database tables created.")

    # Promote a user to system admin (the developer role). Run with:
    #   flask --app run make-admin you@example.com
    @app.cli.command("make-admin")
    @click.argument("email")
    def make_admin(email):
        from app.models.user import User, SystemRole

        user = User.query.filter_by(email=email.strip().lower()).first()
        if user is None:
            print(f"No user found with email {email!r}.")
            return
        user.system_role = SystemRole.admin
        db.session.commit()
        print(f"{user.email} is now a system admin.")

    # Scan for sections whose deadline is near and create/email alerts.
    # Run periodically (cron / a scheduled task): flask --app run scan-deadlines
    @app.cli.command("scan-deadlines")
    def scan_deadlines_cmd():
        from app.services.notification_service import scan_deadlines

        created = scan_deadlines(within_hours=24)
        print(f"Created {created} deadline notification(s).")

    return app


    # Scan for sections whose deadline is near and create/email alerts.
    # Run periodically (cron / a scheduled task): flask --app run scan-deadlines
    @app.cli.command("scan-deadlines")
    def scan_deadlines_cmd():
        from app.services.notification_service import scan_deadlines

        created = scan_deadlines(within_hours=24)
        print(f"Created {created} deadline notification(s).")

    # Scan for sections whose deadline has already passed and create/email
    # overdue alerts. Run periodically: flask --app run scan-overdue
    @app.cli.command("scan-overdue")
    def scan_overdue_cmd():
        from app.services.notification_service import scan_overdue

        created = scan_overdue()
        print(f"Created {created} overdue notification(s).")

    return app

    @app.cli.command("scan-overdue")
    def scan_overdue_cmd():
        from app.services.notification_service import scan_overdue

        created = scan_overdue()
        print(f"Created {created} overdue notification(s).")
