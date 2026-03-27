from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import Note, UserActivity
from app.services.ai_service import AIContentService

library_bp = Blueprint('library', __name__)
ai_service = AIContentService()


@library_bp.route('/notes', methods=['POST'])
@jwt_required()
def upload_note():
    user_id = int(get_jwt_identity())

    title = None
    content = None

    if request.content_type and 'multipart/form-data' in request.content_type:
        title = request.form.get('title')
        file = request.files.get('file')
        if file:
            content = file.read().decode('utf-8', errors='ignore')
    else:
        data = request.get_json() or {}
        title = data.get('title')
        content = data.get('content')

    if not title or not content:
        return jsonify({'message': 'title and content (or text file) are required'}), 400

    note = Note(user_id=user_id, title=title.strip(), content=content.strip())
    db.session.add(note)

    activity = UserActivity(
        user_id=user_id,
        activity_type='Note Uploaded',
        details=f'Uploaded note: {title.strip()[:100]}'
    )
    db.session.add(activity)

    db.session.commit()

    return jsonify({
        'message': 'Note uploaded successfully',
        'note': {
            'id': note.id,
            'title': note.title,
            'created_at': note.created_at
        }
    }), 201


@library_bp.route('/notes', methods=['GET'])
@jwt_required()
def get_notes():
    user_id = int(get_jwt_identity())

    notes = Note.query.filter_by(user_id=user_id).order_by(Note.created_at.desc()).all()
    return jsonify([
        {
            'id': n.id,
            'title': n.title,
            'created_at': n.created_at,
            'content_preview': n.content[:200]
        }
        for n in notes
    ]), 200


@library_bp.route('/notes/<int:note_id>/generate-mcq', methods=['POST'])
@jwt_required()
def generate_mcq_from_note(note_id):
    user_id = int(get_jwt_identity())

    note = Note.query.filter_by(id=note_id, user_id=user_id).first()
    if not note:
        return jsonify({'message': 'Note not found'}), 404

    data = request.get_json() or {}
    count = int(data.get('count', 10))
    count = min(max(count, 3), 20)

    questions = ai_service.generate_mcqs_from_note(note, count=count)
    if not questions:
        return jsonify({'message': 'Could not generate MCQs. Add richer note content.'}), 400

    return jsonify({
        'message': 'MCQs generated',
        'note_id': note.id,
        'questions_count': len(questions)
    }), 200
