from functools import wraps

from flask import jsonify, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

from app.models.user import User, SystemRole


def _current_user():
    return User.query.get(int(get_jwt_identity()))


def login_required(fn):
    """Require a valid token; load the user onto flask.g.current_user.

    Like @jwt_required() but it also fetches the User so the view can use
    g.current_user without repeating the lookup.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = _current_user()
        if user is None:
            return jsonify(error="User not found."), 404
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn):
    """Require a system admin (the developer role)."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = _current_user()
        if user is None:
            return jsonify(error="User not found."), 404
        if user.system_role != SystemRole.admin:
            return jsonify(error="Admin privileges required."), 403
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def project_role_required(min_role="member"):
    """Factory: require the caller to be a member (or leader) of the project in
    the URL. The decorated route MUST have a <int:project_id> parameter.

    Usage:
        @projects_bp.post("/<int:project_id>/members")
        @project_role_required("leader")
        def add_member(project_id): ...

    On success it stashes g.current_user and g.membership for the view.
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = _current_user()
            if user is None:
                return jsonify(error="User not found."), 404

            # Imported here to avoid a circular import at module load time.
            from app.services.project_service import get_membership

            project_id = kwargs.get("project_id")
            membership = get_membership(project_id, user.id)
            if membership is None:
                return jsonify(error="You are not a member of this project."), 403
            if min_role == "leader" and membership.role.value != "leader":
                return jsonify(error="Leader privileges required."), 403

            g.current_user = user
            g.membership = membership
            return fn(*args, **kwargs)

        return wrapper

    return decorator
