from flask import Blueprint, jsonify

from app.utils.decorators import admin_required

# Mounted at /api/admin. A small blueprint to demonstrate (and later hold) the
# developer-only, system-level actions.
admin_bp = Blueprint("admin", __name__)


@admin_bp.get("/ping")
@admin_required
def ping():
    """GET /api/admin/ping -> 200 only for system admins.

    A regular logged-in user gets 403; a request with no token gets 401. Handy
    for confirming the @admin_required guard works end to end.
    """
    return jsonify(message="pong -- you are an admin"), 200
