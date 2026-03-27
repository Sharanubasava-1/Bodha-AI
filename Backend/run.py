from app import create_app, db
from app.models import User, Topic, QuizResult, KnowledgeGap, Note, Question, ChatMessage, UserActivity, QuizSession, QuizAnswer, QuizQuestionState

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'User': User,
        'Topic': Topic,
        'QuizResult': QuizResult,
        'KnowledgeGap': KnowledgeGap,
        'Note': Note,
        'Question': Question,
        'ChatMessage': ChatMessage,
        'UserActivity': UserActivity,
        'QuizSession': QuizSession,
        'QuizAnswer': QuizAnswer,
        'QuizQuestionState': QuizQuestionState
    }

if __name__ == '__main__':
    app.run(debug=True, port=5000)
