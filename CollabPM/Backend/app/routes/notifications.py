from flask import Blueprint, jsonify, g

from app.models.notification import Notification
from app.services import notification_service as ns
from app.utils.decorators import login_required

# Mounted at /api/notifications.
notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("")
@login_required
def list_notifications():
    """GET /api/notifications -> the caller's notifications + unread count."""
    items = ns.list_for_user(g.current_user.id)
    return jsonify(
        notifications=[n.to_dict() for n in items],
        unread=ns.unread_count(g.current_user.id),
    ), 200


@notifications_bp.post("/<int:notification_id>/read")
@login_required
def mark_read(notification_id):
    n = Notification.query.get(notification_id)
    if n is None or n.user_id != g.current_user.id:
        return jsonify(error="Notification not found."), 404
    ns.mark_read(n)
    return jsonify(notification=n.to_dict()), 200


@notifications_bp.post("/read-all")
@login_required
def read_all():
    ns.mark_all_read(g.current_user.id)
    return jsonify(unread=0), 200
