from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import ChatMessage, Note, Question, QuizSession, QuizAnswer, QuizResult, QuizQuestionState, Topic, UserActivity
from app.services.ai_service import AIContentService

chatbot_bp = Blueprint('chatbot', __name__)
ai_service = AIContentService()


def _question_to_payload(question):
    return {
        'id': question.id,
        'question_text': question.question_text,
        'options': {
            'A': question.option_a,
            'B': question.option_b,
            'C': question.option_c,
            'D': question.option_d,
        }
    }


def _next_pending_state(quiz_session_id):
    return (
        QuizQuestionState.query
        .filter_by(quiz_session_id=quiz_session_id, is_completed=False)
        .order_by(QuizQuestionState.order_index.asc())
        .first()
    )


def _finalize_quiz_session(session):
    states = QuizQuestionState.query.filter_by(quiz_session_id=session.id).all()
    total = len(states)
    if total == 0:
        session.total_questions = 0
        session.correct_count = 0
        session.score = 0.0
        return

    weighted_score = 0.0
    correct_count = 0

    for state in states:
        if state.is_correct:
            correct_count += 1
            if state.first_attempt_option and state.first_attempt_option.upper() == state.question.correct_option.upper():
                weighted_score += 1.0
            elif state.second_attempt_option and state.second_attempt_option.upper() == state.question.correct_option.upper():
                weighted_score += 0.5

    session.total_questions = total
    session.correct_count = correct_count
    session.score = round(weighted_score / total, 4)


@chatbot_bp.route('/message', methods=['POST'])
@jwt_required()
def ask_chatbot():
    user_id = int(get_jwt_identity())

    data = request.get_json() or {}
    message = (data.get('message') or '').strip()
    note_id = data.get('note_id')

    if not message:
        return jsonify({'message': 'message is required'}), 400

    if note_id is not None:
        note = Note.query.filter_by(id=note_id, user_id=user_id).first()
        if not note:
            return jsonify({'message': 'Note not found'}), 404

    user_msg = ChatMessage(user_id=user_id, message=message, is_bot=False)
    db.session.add(user_msg)

    bot_reply = ai_service.answer_from_notes(message, note_id=note_id, user_id=user_id)
    bot_msg = ChatMessage(user_id=user_id, message=bot_reply, is_bot=True)
    db.session.add(bot_msg)

    db.session.commit()

    return jsonify({'reply': bot_reply}), 200


@chatbot_bp.route('/test/start', methods=['POST'])
@jwt_required()
def start_test():
    user_id = int(get_jwt_identity())

    data = request.get_json() or {}
    note_id = data.get('note_id')
    topic_id = data.get('topic_id')
    count = int(data.get('count', 10))
    count = min(max(count, 3), 20)

    if not note_id and not topic_id:
        return jsonify({'message': 'Provide note_id or topic_id'}), 400

    questions_query = Question.query
    if note_id:
        note = Note.query.filter_by(id=note_id, user_id=user_id).first()
        if not note:
            return jsonify({'message': 'Note not found'}), 404
        questions_query = questions_query.filter_by(note_id=note_id)
    elif topic_id:
        topic = Topic.query.get(topic_id)
        if not topic:
            return jsonify({'message': 'Topic not found'}), 404
        questions_query = questions_query.filter_by(topic_id=topic_id)

    questions = questions_query.order_by(Question.created_at.desc()).limit(count).all()

    if not questions and note_id:
        questions = ai_service.generate_mcqs_from_note(note, count=count)

    if not questions:
        return jsonify({'message': 'No questions found. Generate MCQs first.'}), 404

    session = QuizSession(
        user_id=user_id,
        note_id=note_id,
        topic_id=topic_id,
        score=0.0,
        correct_count=0,
        total_questions=len(questions)
    )
    db.session.add(session)
    db.session.flush()

    for idx, q in enumerate(questions):
        state = QuizQuestionState(
            quiz_session_id=session.id,
            question_id=q.id,
            order_index=idx,
            is_completed=False,
            is_correct=False
        )
        db.session.add(state)

    db.session.commit()

    first_state = _next_pending_state(session.id)
    first_question = first_state.question if first_state else None

    return jsonify({
        'message': 'Test ready',
        'quiz_session_id': session.id,
        'note_id': note_id,
        'topic_id': topic_id,
        'total_questions': len(questions),
        'current_question': _question_to_payload(first_question) if first_question else None,
        'questions': [_question_to_payload(q) for q in questions]
    }), 200


@chatbot_bp.route('/test/answer', methods=['POST'])
@jwt_required()
def answer_question():
    user_id = int(get_jwt_identity())

    data = request.get_json() or {}
    quiz_session_id = data.get('quiz_session_id')
    question_id = data.get('question_id')
    selected_option = (data.get('selected_option') or '').upper().strip()

    if not quiz_session_id or not question_id or selected_option not in ['A', 'B', 'C', 'D']:
        return jsonify({'message': 'quiz_session_id, question_id and valid selected_option(A/B/C/D) are required'}), 400

    session = QuizSession.query.filter_by(id=quiz_session_id, user_id=user_id).first()
    if not session:
        return jsonify({'message': 'Quiz session not found'}), 404

    state = QuizQuestionState.query.filter_by(
        quiz_session_id=session.id,
        question_id=question_id
    ).first()
    if not state:
        return jsonify({'message': 'Question not part of this quiz session'}), 404

    if state.is_completed:
        next_state = _next_pending_state(session.id)
        return jsonify({
            'message': 'This question is already completed',
            'next_question': _question_to_payload(next_state.question) if next_state else None,
            'quiz_completed': next_state is None
        }), 200

    question = state.question
    is_correct = selected_option == question.correct_option.upper()

    if state.first_attempt_option is None:
        state.first_attempt_option = selected_option
        if is_correct:
            state.is_correct = True
            state.is_completed = True
            ans = QuizAnswer(
                quiz_session_id=session.id,
                question_id=question.id,
                selected_option=selected_option,
                is_correct=True
            )
            db.session.add(ans)
            db.session.commit()

            next_state = _next_pending_state(session.id)
            if next_state:
                return jsonify({
                    'message': 'Correct answer on first attempt. Moving to next question.',
                    'result': 'correct_first_try',
                    'next_question': _question_to_payload(next_state.question),
                    'quiz_completed': False
                }), 200

            _finalize_quiz_session(session)
            if session.topic_id:
                db.session.add(QuizResult(user_id=user_id, topic_id=session.topic_id, score=session.score))
            db.session.add(UserActivity(user_id=user_id, activity_type='Quiz Taken', details=f"Scored {round(session.score * 100, 2)}%"))
            db.session.commit()
            return jsonify({
                'message': 'Quiz completed',
                'result': 'quiz_completed',
                'quiz_completed': True,
                'score': session.score,
                'correct': session.correct_count,
                'total': session.total_questions
            }), 200

        insight = ai_service.build_feedback_and_hint(question, selected_option)
        state.feedback = insight['feedback']
        state.hint = insight['hint']
        db.session.commit()

        return jsonify({
            'message': 'Incorrect answer. AI feedback generated. You have one more chance.',
            'result': 'second_chance',
            'feedback': state.feedback,
            'hint': state.hint,
            'second_chance_remaining': True,
            'question': _question_to_payload(question)
        }), 200

    if state.second_attempt_option is not None:
        return jsonify({'message': 'Second chance already used for this question'}), 400

    state.second_attempt_option = selected_option
    state.is_completed = True
    state.is_correct = is_correct

    ans = QuizAnswer(
        quiz_session_id=session.id,
        question_id=question.id,
        selected_option=selected_option,
        is_correct=is_correct
    )
    db.session.add(ans)

    response_payload = {
        'second_chance_remaining': False,
        'correct_option': question.correct_option.upper(),
    }

    if is_correct:
        response_payload['message'] = 'Correct on second chance. Moving to next question.'
        response_payload['result'] = 'correct_second_try'
    else:
        response_payload['message'] = 'Second chance also incorrect. Moving to next question.'
        response_payload['result'] = 'incorrect_after_second_try'
        response_payload['feedback'] = f"The correct option is {question.correct_option.upper()}. Review this concept before the next question."

    db.session.commit()

    next_state = _next_pending_state(session.id)
    if next_state:
        response_payload['next_question'] = _question_to_payload(next_state.question)
        response_payload['quiz_completed'] = False
        return jsonify(response_payload), 200

    _finalize_quiz_session(session)
    if session.topic_id:
        db.session.add(QuizResult(user_id=user_id, topic_id=session.topic_id, score=session.score))
    db.session.add(UserActivity(user_id=user_id, activity_type='Quiz Taken', details=f"Scored {round(session.score * 100, 2)}%"))
    db.session.commit()

    response_payload['quiz_completed'] = True
    response_payload['score'] = session.score
    response_payload['correct'] = session.correct_count
    response_payload['total'] = session.total_questions
    return jsonify(response_payload), 200


@chatbot_bp.route('/test/status/<int:quiz_session_id>', methods=['GET'])
@jwt_required()
def quiz_status(quiz_session_id):
    user_id = int(get_jwt_identity())

    session = QuizSession.query.filter_by(id=quiz_session_id, user_id=user_id).first()
    if not session:
        return jsonify({'message': 'Quiz session not found'}), 404

    next_state = _next_pending_state(session.id)
    completed = next_state is None

    return jsonify({
        'quiz_session_id': session.id,
        'quiz_completed': completed,
        'current_question': _question_to_payload(next_state.question) if next_state else None,
        'score': session.score,
        'correct': session.correct_count,
        'total': session.total_questions
    }), 200
