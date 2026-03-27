from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import KnowledgeGap, Topic
from ..services.ml_service import RecommenderService

recommender_bp = Blueprint('recommender', __name__)
ml_service = RecommenderService()

@recommender_bp.route('/gaps', methods=['GET'])
@jwt_required()
def get_user_gaps():
    user_id = int(get_jwt_identity())

    # Fetch gaps from DB
    gaps = KnowledgeGap.query.filter_by(user_id=user_id).all()
    if not gaps:
        return jsonify({'message': 'No knowledge gaps found. Keep taking quizzes!'}), 200

    results = []
    for g in gaps:
        topic = Topic.query.get(g.topic_id)
        results.append({
            'topic_id': g.topic_id,
            'topic_name': topic.name,
            'gap_score': g.gap_score,
            'suggested_revision': g.suggested_revision,
            'created_at': g.created_at
        })

    return jsonify({'gaps': results}), 200

@recommender_bp.route('/analyze', methods=['POST'])
@jwt_required()
def analyze_gaps():
    user_id = int(get_jwt_identity())

    # Trigger ML service to predict new gaps from recently taken quizzes
    recommendations = ml_service.analyze_and_store_gaps(user_id)

    weak_topics = [
        {
            'topic_id': r['topic_id'],
            'topic_name': r['topic_name'],
            'gap_severity': round(float(r['gap_severity']), 4),
        }
        for r in recommendations
        if float(r['gap_severity']) >= 0.4
    ]

    return jsonify({
        'message': 'Analysis complete',
        'model_loaded': ml_service.is_model_loaded(),
        'recommendations': recommendations,
        'weak_topics': weak_topics,
    }), 200
