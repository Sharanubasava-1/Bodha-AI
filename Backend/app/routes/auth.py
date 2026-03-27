import os
import re
from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models import User, UserActivity
from flask_jwt_extended import create_access_token
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

auth_bp = Blueprint('auth', __name__)


def _build_auth_response(user):
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role, 'username': user.username}
    )

    db.session.add(UserActivity(
        user_id=user.id,
        activity_type='Portal Active',
        details='Login session started'
    ))
    db.session.commit()

    return jsonify({
        'message': 'Login successful',
        'access_token': access_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'role': user.role
        }
    }), 200


def _slugify_username(value):
    slug = re.sub(r'[^a-z0-9_]+', '', value.lower())
    return slug[:24] if slug else 'student'


def _generate_unique_username(seed):
    base = _slugify_username(seed)
    candidate = base
    counter = 1

    while User.query.filter_by(username=candidate).first() is not None:
        suffix = f'{counter}'
        candidate = f'{base[:24 - len(suffix)]}{suffix}'
        counter += 1

    return candidate


def _find_user_by_identifier(identifier):
    user = User.query.filter_by(username=identifier).first()
    if user:
        return user

    return User.query.filter(func.lower(User.email) == identifier.lower()).first()

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not username or not password or not email:
        return jsonify({'message': 'username, email and password are required'}), 400

    role = data.get('role', 'Student')
    if role not in ['Admin', 'Mentor', 'Student']:
        return jsonify({'message': 'Invalid role'}), 400

    existing_email_user = User.query.filter(func.lower(User.email) == email).first()
    if existing_email_user:
        # If user was created through Google without password, allow account completion.
        if not existing_email_user.password_hash:
            conflicting_username = User.query.filter_by(username=username).first()
            if conflicting_username and conflicting_username.id != existing_email_user.id:
                return jsonify({'message': 'Username already exists'}), 400

            existing_email_user.username = username
            existing_email_user.role = role
            existing_email_user.set_password(password)
            db.session.commit()

            return jsonify({'message': 'Account completed successfully'}), 200

        return jsonify({'message': 'Email already exists'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 400

    new_user = User(username=username, email=email, role=role)
    new_user.set_password(password)

    db.session.add(new_user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    identifier = (data.get('username') or data.get('email') or '').strip()
    password = data.get('password')

    if not identifier or not password:
        return jsonify({'message': 'Missing fields'}), 400

    user = _find_user_by_identifier(identifier)
    if not user:
        return jsonify({'message': 'Invalid credentials'}), 401

    if not user.password_hash:
        return jsonify({'message': 'Use Google Account for this email'}), 401

    if not user.check_password(password):
        return jsonify({'message': 'Invalid credentials'}), 401

    return _build_auth_response(user)


@auth_bp.route('/google-login', methods=['POST'])
def google_login():
    data = request.get_json() or {}
    credential = data.get('credential')
    if not credential:
        return jsonify({'message': 'Missing Google credential'}), 400

    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    if not client_id:
        return jsonify({'message': 'Google login is not configured on the server'}), 500

    try:
        token_info = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id
        )
    except ValueError:
        return jsonify({'message': 'Invalid Google token'}), 401

    email = (token_info.get('email') or '').strip().lower()
    if not email:
        return jsonify({'message': 'Google account email not found'}), 400

    user = User.query.filter(func.lower(User.email) == email).first()
    if not user:
        name_seed = token_info.get('name') or email.split('@')[0]
        user = User(
            username=_generate_unique_username(name_seed),
            email=email,
            role='Student'
        )
        db.session.add(user)
        db.session.commit()

    return _build_auth_response(user)
