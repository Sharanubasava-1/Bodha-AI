from collections import Counter
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import extract

from app.models import UserActivity, QuizSession


dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/activity', methods=['GET'])
@jwt_required()
def activity_calendar():
    user_id = int(get_jwt_identity())

    now = datetime.utcnow()
    month = int(request.args.get('month', now.month))
    year = int(request.args.get('year', now.year))

    activities = (
        UserActivity.query
        .filter_by(user_id=user_id)
        .filter(extract('month', UserActivity.timestamp) == month)
        .filter(extract('year', UserActivity.timestamp) == year)
        .all()
    )

    day_counter = Counter()
    work_minutes_counter = Counter()

    def _shade_for_minutes(minutes: int) -> str:
        if minutes <= 0:
            return 'none'
        if minutes < 60:
            return 'green'
        if minutes == 60:
            return 'light_green'
        return 'dark_green'

    for act in activities:
        day_counter[act.timestamp.day] += 1
        if act.activity_type == 'Portal Active':
            # One heartbeat event is treated as one minute of active portal time.
            work_minutes_counter[act.timestamp.day] += 1

    days = sorted(day_counter.keys())

    return jsonify({
        'month': month,
        'year': year,
        'days_active': len(days),
        'activity_by_day': [
            {
                'day': day,
                'count': day_counter[day],
                'worked_minutes': work_minutes_counter.get(day, 0),
                'shade': _shade_for_minutes(work_minutes_counter.get(day, 0)),
            }
            for day in days
        ],
        'total_activities': len(activities)
    }), 200


@dashboard_bp.route('/heartbeat', methods=['POST'])
@jwt_required()
def track_portal_heartbeat():
    user_id = int(get_jwt_identity())
    now = datetime.utcnow()

    recent = (
        UserActivity.query
        .filter_by(user_id=user_id, activity_type='Portal Active')
        .order_by(UserActivity.timestamp.desc())
        .first()
    )

    # De-duplicate bursts from refreshes/multiple tabs within 50 seconds.
    if recent and recent.timestamp and (now - recent.timestamp).total_seconds() < 50:
        return jsonify({'message': 'Heartbeat already recorded recently'}), 200

    activity = UserActivity(
        user_id=user_id,
        activity_type='Portal Active',
        details='User active in portal dashboard',
        timestamp=now,
    )
    from app import db
    db.session.add(activity)
    db.session.commit()

    return jsonify({'message': 'Heartbeat recorded'}), 201


@dashboard_bp.route('/quiz-pie', methods=['GET'])
@jwt_required()
def quiz_pie_data():
    user_id = int(get_jwt_identity())

    sessions = QuizSession.query.filter_by(user_id=user_id).all()
    if not sessions:
        return jsonify({
            'labels': ['Weak', 'Average', 'Strong'],
            'values': [0, 0, 0],
            'percentages': [0, 0, 0],
            'message': 'No quiz sessions found'
        }), 200

    weak = 0
    average = 0
    strong = 0

    for s in sessions:
        if s.score < 0.4:
            weak += 1
        elif s.score < 0.7:
            average += 1
        else:
            strong += 1

    total = len(sessions)
    values = [weak, average, strong]
    percentages = [round((v / total) * 100, 2) for v in values]

    return jsonify({
        'labels': ['Weak', 'Average', 'Strong'],
        'values': values,
        'percentages': percentages,
        'total_tests': total
    }), 200
