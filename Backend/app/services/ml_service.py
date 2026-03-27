import os
import joblib
import pandas as pd
from app import db
from app.models import KnowledgeGap, QuizResult, Topic

class RecommenderService:
    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(__file__), '..', 'ml_models', 'gap_recommender.pkl')
        self.model = None

    def load_model(self):
        if self.model is None and os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
        return self.model

    def is_model_loaded(self):
        return self.load_model() is not None

    def predict_gap(self, user_id, topic_id):
        # Fetch user's history on this topic
        results = QuizResult.query.filter_by(user_id=user_id, topic_id=topic_id).order_by(QuizResult.timestamp.desc()).all()

        attempts = len(results)
        recent_score = results[0].score if results else 0.5

        model = self.load_model()
        if not model:
            # Fallback if model not trained yet
            return (1.0 - recent_score) + (attempts * 0.05)

        # Predict using scikit-learn
        X_new = pd.DataFrame([[topic_id, recent_score, attempts]], columns=['topic_id', 'recent_score', 'attempts'])
        gap_severity = model.predict(X_new)[0]

        # Clip values to 0.0 - 1.0 range
        return min(max(gap_severity, 0.0), 1.0)

    def summarize_topic_performance(self, user_id):
        """Return average score and attempts per topic for a user."""
        topics = Topic.query.all()
        out = []

        for t in topics:
            results = (
                QuizResult.query
                .filter_by(user_id=user_id, topic_id=t.id)
                .order_by(QuizResult.timestamp.desc())
                .all()
            )
            if not results:
                continue

            attempts = len(results)
            avg_score = sum(r.score for r in results) / attempts
            out.append({
                'topic_id': t.id,
                'topic_name': t.name,
                'attempts': attempts,
                'avg_score': round(avg_score, 4),
            })

        return sorted(out, key=lambda x: x['avg_score'])

    def generate_recommendations(self, user_id):
        topics = Topic.query.all()
        scored_topics = []

        for t in topics:
            severity = self.predict_gap(user_id, t.id)
            scored_topics.append({'topic_id': t.id, 'topic_name': t.name, 'gap_severity': severity})

        # Sort by severity descending (highest gaps first)
        scored_topics.sort(key=lambda x: x['gap_severity'], reverse=True)

        return scored_topics

    def analyze_and_store_gaps(self, user_id):
        # Calculates gaps and saves to DB for dashboard usage
        recommendations = self.generate_recommendations(user_id)
        
        # Clear old gaps
        KnowledgeGap.query.filter_by(user_id=user_id).delete()

        new_gaps = []
        for rec in recommendations:
            if rec['gap_severity'] > 0.4: # Only save substantial gaps
                suggested_revision = f"Revise materials for {rec['topic_name']} due to high gap score."
                gap = KnowledgeGap(
                    user_id=user_id,
                    topic_id=rec['topic_id'],
                    gap_score=rec['gap_severity'],
                    suggested_revision=suggested_revision
                )
                db.session.add(gap)
                new_gaps.append(gap)
                
        db.session.commit()
        return recommendations

    def get_adaptive_topic_ids(self, user_id, max_topics=3):
        """Pick weak topics for adaptive quizzes based on current stored gaps."""
        gaps = (
            KnowledgeGap.query
            .filter_by(user_id=user_id)
            .order_by(KnowledgeGap.gap_score.desc(), KnowledgeGap.created_at.desc())
            .all()
        )

        topic_ids = []
        for gap in gaps:
            if gap.topic_id not in topic_ids:
                topic_ids.append(gap.topic_id)
            if len(topic_ids) >= max_topics:
                break

        return topic_ids
