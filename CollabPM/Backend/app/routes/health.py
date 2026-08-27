from flask import Blueprint, jsonify

# A Blueprint is a self-contained collection of routes. We attach routes to it
# here, then "mount" it onto the real application in create_app(). This is what
# lets us split the API across many small files (auth.py, projects.py, ...)
# instead of one enormous file. The first arg ("health") is the blueprint's
# internal name; __name__ tells Flask where the blueprint lives on disk.
health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health():
    """GET /api/health -> a simple liveness check.

    Returns 200 with a small JSON body. Useful for confirming the server is up
    (and later, for deployment platforms that ping a health endpoint).

    jsonify(...) converts a Python dict into a JSON HTTP response and sets the
    Content-Type header to application/json. Returning a tuple (body, status)
    lets us set the HTTP status code explicitly.
    """
    return jsonify(status="ok", service="CollabPM API"), 200
