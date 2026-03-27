# AI Knowledge Gap Tutor - Backend

This backend implements a system for an AI Tutor that identifies student knowledge gaps based on quiz results and suggests topics to revise, using Scikit-Learn and PostgreSQL.

## Technologies Used

- **Flask**: Web framework for building the API endpoints.
- **SQLAlchemy/PostgreSQL**: Relational database ORM for managing Users, Topics, Quiz Results, and Knowledge Gaps.
- **Scikit-Learn**: Machine learning library to train and run the recommender model.
- **Flask-JWT-Extended**: Authentication for Admin, Mentor, and Student roles.

## Setup Instructions

1. **Install Virtual Environment and Dependencies**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure PostgreSQL**
   - Make sure you have PostgreSQL running.
   - Create a database called `knowledge_tutor` or define your own via `.env`.
   - Create `.env` file in the project directory:
     ```env
     DATABASE_URL=postgresql://username:password@localhost:5432/knowledge_tutor
     SECRET_KEY=your-secret-key
     JWT_SECRET_KEY=your-jwt-secret
     ```

3. **Initialize Database**

   ```bash
   flask db init
   flask db migrate -m "Initial migration."
   flask db upgrade
   ```

4. **Train the ML Model**
   Run the following script to generate dummy student data and train the Scikit-Learn Recommender Model:

   ```bash
   python train_model.py
   ```

   This saves the model inside `app/ml_models/`.

5. **Start the Development Server**
   ```bash
   python run.py
   ```
   The API will start at `http://127.0.0.1:5000`.

## API Endpoints Overview

### Auth

- `POST /api/auth/register` - Create user. Send `{ "username": "student1", "email": "s1@example.com", "password": "abc", "role": "Student" }`
- `POST /api/auth/login` - Get JWT. Send `{ "username": "student1", "password": "abc" }`

### Quiz & Topics

- `POST /api/quiz/topics` (Admin/Mentor) - Create a topic to be tested. `{ "name": "Python Loops", "description": "For/While loops" }`
- `GET /api/quiz/topics` - List all available topics.
- `POST /api/quiz/submit` (Student) - Submit a quiz result. `{ "topic_id": 1, "score": 0.45 }`

### AI Recommender

- `POST /api/recommend/analyze` (Student) - Trigger the Scikit-Learn model to analyze recent quiz results and find knowledge gaps.
- `GET /api/recommend/gaps` (Student) - Returns a list of predicted topics the student struggles with and needs revision.

### Library (Notes Upload)

- `POST /api/library/notes` (Student) - Upload note text as JSON (`title`, `content`) or multipart form (`title`, `file`).
- `GET /api/library/notes` (Student) - List notes uploaded by the logged-in user.
- `POST /api/library/notes/<note_id>/generate-mcq` (Student) - Generate MCQs from a note using Scikit-Learn text processing.

### Chatbot + Test Engine

- `POST /api/chatbot/message` (Student) - Ask the chatbot questions grounded in uploaded notes.
- `POST /api/chatbot/test/start` (Student) - Start a test and create `quiz_session_id`.
- `POST /api/chatbot/test/answer` (Student) - Submit one answer at a time. If first attempt is wrong, API returns AI feedback + hint and grants one second chance for the same question.
- `GET /api/chatbot/test/status/<quiz_session_id>` (Student) - Get current question or final score state.

Interactive behavior:

- First attempt wrong: AI feedback and hint are returned, same question remains active.
- Second attempt: whether correct or wrong, backend moves to the next question.
- If second attempt is correct, quiz continues normally.
- Final score uses weighted grading: first-try correct = 1.0, second-try correct = 0.5.

### Dashboard Analytics

- `GET /api/dashboard/activity?month=3&year=2026` (Student) - Returns activity calendar data for "days active" UI.
- `GET /api/dashboard/quiz-pie` (Student) - Returns pie chart dataset (`Weak/Average/Strong`) from quiz/test sessions.

## Implementation Details

The Recommender heavily utilizes Scikit-Learn (`RandomForestRegressor`) to predict a user's _gap severity_ based on recent topic scores and number of attempts. The logic resides in `app/services/ml_service.py`. The frontend AI Chatbot can use these identified `Knowledge Gaps` to retrieve RAG documents specifically targeting the user's weaknesses.

## Database Notes

New schema includes support for:

- Uploaded notes (Library)
- AI-generated MCQ questions
- Quiz sessions and per-question submitted answers
- Per-question two-attempt state (feedback + hint tracking)
- User activity logs for calendar/day tracking

After pulling latest backend changes, run migrations:

```bash
flask db migrate -m "Add note-based quiz session and analytics tables"
flask db upgrade
```
