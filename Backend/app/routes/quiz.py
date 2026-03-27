from flask import Blueprint, request, jsonify
from app import db
from app.models import QuizResult, Topic, User, KnowledgeGap, Question, UserActivity
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.services.ml_service import RecommenderService

quiz_bp = Blueprint('quiz', __name__)
ml_service = RecommenderService()


def _normalize_score(raw_score):
    score = float(raw_score)
    if score > 1.0:
        score = score / 100.0
    return min(max(score, 0.0), 1.0)


def _get_weak_topics_for_response(user_id, threshold=0.4, limit=5):
    gaps = (
        KnowledgeGap.query
        .filter_by(user_id=user_id)
        .order_by(KnowledgeGap.gap_score.desc(), KnowledgeGap.created_at.desc())
        .all()
    )

    out = []
    for gap in gaps:
        if gap.gap_score < threshold:
            continue
        topic = Topic.query.get(gap.topic_id)
        if not topic:
            continue
        out.append({
            'topic_id': topic.id,
            'topic_name': topic.name,
            'gap_score': round(float(gap.gap_score), 4),
            'suggested_revision': gap.suggested_revision,
        })
        if len(out) >= limit:
            break

    return out

@quiz_bp.route('/topics', methods=['GET'])
def get_topics():
    topics = Topic.query.all()
    return jsonify([{'id': t.id, 'name': t.name, 'description': t.description} for t in topics]), 200

@quiz_bp.route('/topics', methods=['POST'])
@jwt_required()
def add_topic():
    claims = get_jwt()
    if claims.get('role') not in ['Admin', 'Mentor']:
        return jsonify({'message': 'Unauthorized'}), 403

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'message': 'Missing topic name'}), 400

    topic = Topic(name=data['name'], description=data.get('description', ''))
    db.session.add(topic)
    db.session.commit()
    return jsonify({'message': 'Topic added', 'topic': {'id': topic.id, 'name': topic.name}}), 201

@quiz_bp.route('/submit', methods=['POST'])
@jwt_required()
def submit_quiz():
    user_id = int(get_jwt_identity())

    data = request.get_json() or {}

    topic_scores = data.get('topic_scores')
    if topic_scores is None:
        if 'topic_id' not in data or 'score' not in data:
            return jsonify({'message': 'Invalid data. Provide topic_id+score or topic_scores[]'}), 400
        topic_scores = [{'topic_id': data.get('topic_id'), 'score': data.get('score')}]

    if not isinstance(topic_scores, list) or len(topic_scores) == 0:
        return jsonify({'message': 'topic_scores must be a non-empty list'}), 400

    created_results = []
    normalized_scores = []

    for item in topic_scores:
        topic_id = item.get('topic_id')
        raw_score = item.get('score')
        if topic_id is None or raw_score is None:
            return jsonify({'message': 'Each topic_scores item must include topic_id and score'}), 400

        topic = Topic.query.get(int(topic_id))
        if not topic:
            return jsonify({'message': f'Topic not found: {topic_id}'}), 404

        score = _normalize_score(raw_score)
        normalized_scores.append(score)
        quiz_result = QuizResult(user_id=user_id, topic_id=topic.id, score=score)
        db.session.add(quiz_result)
        created_results.append({
            'result_id': quiz_result,
            'topic_id': topic.id,
            'topic_name': topic.name,
            'score': round(score * 100, 2),
        })

    db.session.flush()

    recommendations = ml_service.analyze_and_store_gaps(user_id)
    weak_topics = _get_weak_topics_for_response(user_id)

    adaptive_topic_ids = ml_service.get_adaptive_topic_ids(user_id, max_topics=3)

    avg_score = round((sum(normalized_scores) / len(normalized_scores)) * 100, 2)
    db.session.add(UserActivity(user_id=user_id, activity_type='Quiz Taken', details=f"Average score: {avg_score}%"))
    db.session.commit()

    return jsonify({
        'message': 'Quiz submitted and AI analysis complete',
        'score': avg_score,
        'weak_topics': [w['topic_name'] for w in weak_topics],
        'weak_topics_detailed': weak_topics,
        'recommendations': recommendations[:5],
        'next_quiz_available': len(adaptive_topic_ids) > 0,
        'adaptive_topics': adaptive_topic_ids,
        'model_loaded': ml_service.is_model_loaded(),
        'results_created': [
            {
                'result_id': x['result_id'].id,
                'topic_id': x['topic_id'],
                'topic_name': x['topic_name'],
                'score': x['score'],
            }
            for x in created_results
        ]
    }), 201


@quiz_bp.route('/adaptive', methods=['GET'])
@jwt_required()
def get_adaptive_quiz():
    user_id = int(get_jwt_identity())
    count = int(request.args.get('count', 10))
    count = min(max(count, 3), 20)

    topic_ids = ml_service.get_adaptive_topic_ids(user_id, max_topics=3)
    if not topic_ids:
        return jsonify({
            'message': 'No weak topics found yet. Submit a quiz first.',
            'questions': [],
            'adaptive_topics': []
        }), 200

    questions = (
        Question.query
        .filter(Question.topic_id.in_(topic_ids))
        .order_by(Question.created_at.desc())
        .limit(count)
        .all()
    )

    if not questions:
        topic_map = {t.id: t for t in Topic.query.filter(Topic.id.in_(topic_ids)).all()}
        synthetic = []
        for idx in range(count):
            topic_id = topic_ids[idx % len(topic_ids)]
            topic = topic_map.get(topic_id)
            if not topic:
                continue

            synthetic.append({
                'id': f'adaptive-{topic_id}-{idx + 1}',
                'topic_id': topic.id,
                'topic_name': topic.name,
                'question_text': f"Adaptive: Which statement best explains {topic.name}?",
                'options': {
                    'A': f"{topic.name} is a core concept requiring revision due to recent quiz performance.",
                    'B': f"{topic.name} is unrelated to your recent quiz weaknesses.",
                    'C': f"{topic.name} is only useful for UI styling.",
                    'D': f"{topic.name} applies only to hardware operations.",
                },
                'source': 'adaptive-fallback'
            })

        return jsonify({
            'message': 'Adaptive quiz generated from weak topics (fallback questions).',
            'adaptive_topics': topic_ids,
            'questions': synthetic
        }), 200

    payload = []
    for q in questions:
        topic = Topic.query.get(q.topic_id) if q.topic_id else None
        payload.append({
            'id': q.id,
            'topic_id': q.topic_id,
            'topic_name': topic.name if topic else None,
            'question_text': q.question_text,
            'options': {
                'A': q.option_a,
                'B': q.option_b,
                'C': q.option_c,
                'D': q.option_d,
            },
            'source': 'adaptive-db'
        })

    return jsonify({
        'message': 'Adaptive quiz generated from weak topics.',
        'adaptive_topics': topic_ids,
        'questions': payload
    }), 200
