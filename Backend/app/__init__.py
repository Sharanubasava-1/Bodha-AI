from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from config import Config

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)

    # Register Blueprints
    from app.routes.auth import auth_bp
    from app.routes.quiz import quiz_bp
    from app.routes.recommender import recommender_bp
    from app.routes.library import library_bp
    from app.routes.chatbot import chatbot_bp
    from app.routes.dashboard import dashboard_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(quiz_bp, url_prefix='/api/quiz')
    app.register_blueprint(recommender_bp, url_prefix='/api/recommend')
    app.register_blueprint(library_bp, url_prefix='/api/library')
    app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

    @app.get('/')
    def root_status():
        return {
            'message': 'AI Tutor backend is running',
            'status': 'ok',
            'docs_hint': 'Use API routes like /api/auth/register and /api/library/notes'
        }, 200

    @app.get('/health')
    def health_check():
        return {'status': 'healthy'}, 200

    return app
