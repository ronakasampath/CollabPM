from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from app.models.user import User
from app.services.auth_service import (
    register_user,
    authenticate,
    verify_email,
    resend_code,
    request_password_reset,
    reset_password,
    authenticate_with_google,
    AuthError,
)

# Mounted at /api/auth in the factory, so /register -> POST /api/auth/register.
auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    """POST /api/auth/register -> create a new user.

    Expects a JSON body: {"username": ..., "email": ..., "password": ...}

    The route's job is thin and specific:
      1. Read and lightly validate the incoming JSON (shape checks).
      2. Hand the real work to the service.
      3. Translate the result (or a service error) into an HTTP response.
    """
    # get_json(silent=True) returns None instead of raising if the body isn't
    # valid JSON; `or {}` then gives us an empty dict to safely .get() from.
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()  # emails are case-insensitive
    password = data.get("password") or ""

    # --- shape validation ---
    if not username or not email or not password:
        return jsonify(error="username, email and password are all required."), 400
    if len(password) < 8:
        return jsonify(error="password must be at least 8 characters."), 400

    # --- delegate to the service ---
    try:
        register_user(username, email, password)
    except AuthError as err:
        return jsonify(error=err.message), err.status_code

    # No token yet -- the account is unverified. The client should now prompt
    # for the code we just emailed and call /verify.
    return jsonify(
        message="Verification code sent. Check your email to finish signing up.",
        email=email,
        verification_required=True,
    ), 201


@auth_bp.post("/verify")
def verify():
    """POST /api/auth/verify  {email, code} -> mark verified, return a token."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return jsonify(error="email and code are required."), 400
    try:
        user = verify_email(email, code)
    except AuthError as err:
        return jsonify(error=err.message), err.status_code
    # Log them straight in on success.
    access_token = create_access_token(identity=str(user.id))
    return jsonify(access_token=access_token, user=user.to_dict()), 200


@auth_bp.post("/resend")
def resend():
    """POST /api/auth/resend  {email} -> email a fresh code."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify(error="email is required."), 400
    try:
        resend_code(email)
    except AuthError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(message="A new code has been sent."), 200


@auth_bp.post("/login")
def login():
    """POST /api/auth/login -> verify credentials and hand back an access token.

    Expects: {"email": ..., "password": ...}
    On success returns {"access_token": "<jwt>", "user": {...}}.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify(error="email and password are required."), 400

    try:
        user = authenticate(email, password)
    except AuthError as err:
        return jsonify(error=err.message), err.status_code

    # create_access_token builds a signed JWT. `identity` is whatever we want to
    # remember about the logged-in user -- here the user id. In Flask-JWT-Extended
    # 4.x the identity (the token's "sub" claim) must be a STRING, so we cast it.
    access_token = create_access_token(identity=str(user.id))

    return jsonify(access_token=access_token, user=user.to_dict()), 200


@auth_bp.get("/me")
@jwt_required()  # this route rejects any request without a valid access token
def me():
    """GET /api/auth/me -> the currently-logged-in user's details.

    A "protected" route. @jwt_required() makes Flask-JWT-Extended check the
    Authorization: Bearer <token> header, verify the token's signature and
    expiry, and reject (401) if it's missing/invalid BEFORE this code runs.
    """
    # get_jwt_identity() returns exactly what we put in as identity (the id
    # string). We cast back to int to look the user up.
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if user is None:
        # Token was valid but the user was since deleted.
        return jsonify(error="User not found."), 404
    return jsonify(user=user.to_dict()), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify(error="email is required."), 400
    request_password_reset(email)
    # Same response either way -- don't reveal whether the email exists.
    return jsonify(message="If that email is registered, a reset link has been sent."), 200


@auth_bp.post("/reset-password")
def reset_password_route():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    new_password = data.get("password") or ""
    if not token or not new_password:
        return jsonify(error="token and password are required."), 400
    try:
        reset_password(token, new_password)
    except AuthError as err:
        return jsonify(error=err.message), err.status_code
    return jsonify(message="Password reset. You can now log in."), 200

@auth_bp.post("/google")
def google_login():
    data = request.get_json(silent=True) or {}
    credential = data.get("credential")
    if not credential:
        return jsonify(error="credential is required."), 400
    try:
        user = authenticate_with_google(credential)
    except AuthError as err:
        return jsonify(error=err.message), err.status_code
    access_token = create_access_token(identity=str(user.id))
    return jsonify(access_token=access_token, user=user.to_dict()), 200